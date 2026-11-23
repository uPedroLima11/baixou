-- Vendedores independentes, pagamento equivalente e validade dos preços de referência.
begin;
alter table public.offers add column market_highest numeric,
 add column market_expires_at timestamptz, add column seller_key text, add column payment_basis text;
update public.offers set payment_basis='cash' where store in ('kabum','waz','guerradigital','patoloco');
create or replace function public.market_seller(p_store text,p_seller text,p_key text)
returns text language sql immutable security invoker set search_path='' as $$
 select case when p_store<>'mercadolivre' then p_store
 when p_seller='KaBuM! (loja oficial no Mercado Livre)' then 'kabum'
 when p_seller='Pichau (loja oficial no Mercado Livre)' then 'pichau'
 else p_key end
$$;
revoke all on function public.market_seller(text,text,text) from public,anon,authenticated;
grant execute on function public.market_seller(text,text,text) to service_role;
create or replace function public.refresh_market_reference() returns integer
language plpgsql security invoker set search_path='' as $$
declare updated integer;
begin
 with live as materialized (
  select o.id,o.product_id,o.price,o.expires_at,
   public.market_seller(o.store,o.seller,o.seller_key) as vendor
  from public.offers o join public.catalog_products c on c.id=o.product_id
  where o.available and o.expires_at>now() and o.verification_status='verified' and o.price>0
   and (o.payment_basis='cash' or o.store in ('kabum','waz','guerradigital','patoloco'))
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
end $$;
revoke all on function public.refresh_market_reference() from public,anon,authenticated;
grant execute on function public.refresh_market_reference() to service_role;
create or replace view public.catalog_offers with(security_invoker=true) as
select id,store,url,title,category,brand,mpn,image,images,price,original_price,available,
 seller,sold,rating,review_count,(specs-'Descrição do fabricante') as specs,
 checked_at,expires_at,historical_median,historical_samples,historical_days,discount,
 evidence,discoveries,coupon_hint,coupon_validated,payment_note,product_id,gtin,variant,
 last_attempt_at,verification_status,market_median,market_lowest,market_stores,market_checked_at,
 market_highest,market_expires_at,seller_key,payment_basis from public.offers;
select public.refresh_market_reference();
commit;
