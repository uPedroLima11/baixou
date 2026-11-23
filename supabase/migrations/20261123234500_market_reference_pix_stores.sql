-- Lojas novas com preço Pix conferido no DOM pelo adaptador (iByte, ChipArt, Shopinfo) entram na referência de mercado.
-- Nenhum outro critério muda (mesmo produto canônico, variante, vendedor independente, validade de 15 min).
CREATE OR REPLACE FUNCTION public.refresh_market_reference()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare updated integer;
begin
 with live as materialized (
  select o.id,o.product_id,o.price,o.expires_at,
   public.market_seller(o.store,o.seller,o.seller_key) as vendor
  from public.offers o join public.catalog_products c on c.id=o.product_id
  where o.available and o.expires_at>now() and o.verification_status='verified' and o.price>0
   and (o.payment_basis='cash' or o.store in ('kabum','waz','guerradigital','patoloco','ibyte','chipart','shopinfo'))
   and (regexp_replace(upper(o.mpn),'[^A-Z0-9]','','g')=c.mpn or (o.gtin is not null and o.gtin=c.gtin))
   and not exists(select 1 from jsonb_each(o.variant) v where c.variant ? v.key and c.variant->v.key<>v.value)
 ), per_vendor as (
  select product_id,vendor,min(price) as p,min(expires_at) as expires from live
  where vendor is not null group by product_id,vendor
 ), ref as (
  select l.id,percentile_cont(0.5) within group(order by v.p) as med,min(v.p) as lo,
   max(v.p) as hi,count(v.vendor)::integer as n,
   least(min(v.expires),now()+interval '15 minutes') as expires
  from live l left join per_vendor v on v.product_id=l.product_id and v.vendor<>l.vendor
  where l.vendor is not null group by l.id
 )
 update public.offers o set market_median=r.med,market_lowest=r.lo,market_highest=r.hi,
  market_stores=r.n,market_expires_at=case when r.n>0 then r.expires end,market_checked_at=now()
 from (select o.id,r.med,r.lo,r.hi,coalesce(r.n,0) as n,r.expires from public.offers o left join ref r on r.id=o.id) r
 where o.id=r.id;
 get diagnostics updated=row_count;
 return updated;
end $function$
;
