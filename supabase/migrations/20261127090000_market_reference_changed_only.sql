-- refresh_market_reference(): gravar só linhas cujos valores de mercado mudam.
-- Antes: UPDATE em TODAS as ofertas (10.801 linhas em 27/11/2026, só 182 com referência) a cada execução, com
-- market_checked_at=now() em todas. Efeitos: tempo crescente (média 2,7 s, máx. 6,3 s; 57014 no limite de 8 s do
-- PostgREST no job report) e a tabela inteira aparecendo no delta do catálogo (market_checked_at), o que inflava o
-- egresso e o custo de cada atualização do índice. Mesma regra de cálculo; muda apenas o conjunto gravado e o plano.
create or replace function public.refresh_market_reference()
 returns integer
 language plpgsql
 set search_path to ''
 -- O CTE materializado é estimado em 1 linha e o planejador escolhia nested loop live × per_vendor (3.132² linhas,
 -- ~3,5 s de 4,5 s). Hash join por configuração da própria função; nada muda fora dela.
 set enable_nestloop to 'off'
as $function$
declare updated integer;
begin
 with live as materialized (
  select o.id,o.product_id,o.price,o.card_price,o.expires_at,
   o.payment_basis='cash' or o.store in ('kabum','waz','guerradigital','patoloco','ibyte','chipart','shopinfo') as cash_ok,
   public.market_seller(o.store,o.seller,o.seller_key) as vendor
  from public.offers o join public.catalog_products c on c.id=o.product_id
  where o.available and o.expires_at>now() and o.verification_status='verified' and o.price>0
   and (regexp_replace(upper(o.mpn),'[^A-Z0-9]','','g')=c.mpn or (o.gtin is not null and o.gtin=c.gtin))
   and not exists(select 1 from jsonb_each(o.variant) v where c.variant ? v.key and c.variant->v.key<>v.value)
 ), per_vendor as (
  select product_id,vendor,min(price) filter (where cash_ok) as p,min(card_price) as k,min(expires_at) as expires from live
  where vendor is not null group by product_id,vendor
 ), ref as (
  select l.id,
   percentile_cont(0.5) within group(order by v.p) filter (where l.cash_ok and v.p is not null) as med,
   min(v.p) filter (where l.cash_ok) as lo,max(v.p) filter (where l.cash_ok) as hi,
   (count(v.p) filter (where l.cash_ok))::integer as n,
   percentile_cont(0.5) within group(order by v.k) filter (where l.card_price is not null and v.k is not null) as kmed,
   min(v.k) filter (where l.card_price is not null) as klo,max(v.k) filter (where l.card_price is not null) as khi,
   (count(v.k) filter (where l.card_price is not null))::integer as kn,
   least(min(v.expires),now()+interval '15 minutes') as expires
  from live l left join per_vendor v on v.product_id=l.product_id and v.vendor<>l.vendor
  where l.vendor is not null group by l.id
 ), target as (
  -- Linhas com referência calculada agora + linhas que ainda guardam referência antiga (para limpar).
  select o.id,r.med,r.lo,r.hi,coalesce(r.n,0) as n,r.kmed,r.klo,r.khi,coalesce(r.kn,0) as kn,r.expires
  from public.offers o left join ref r on r.id=o.id
  where (r.id is not null and (r.n>0 or r.kn>0)) or o.market_stores>0 or o.card_market_stores>0
     or o.market_expires_at is not null or o.card_market_expires_at is not null
     or o.market_median is not null or o.card_market_median is not null
 )
 update public.offers o set market_median=t.med,market_lowest=t.lo,market_highest=t.hi,
  market_stores=t.n,market_expires_at=case when t.n>0 then t.expires end,
  card_market_median=t.kmed,card_market_lowest=t.klo,card_market_highest=t.khi,card_market_stores=t.kn,
  card_market_expires_at=case when t.kn>0 then t.expires end,market_checked_at=now()
 from target t
 where o.id=t.id and (
  o.market_median is distinct from t.med or o.market_lowest is distinct from t.lo or o.market_highest is distinct from t.hi
  or coalesce(o.market_stores,0)<>t.n or o.market_expires_at is distinct from (case when t.n>0 then t.expires end)
  or o.card_market_median is distinct from t.kmed or o.card_market_lowest is distinct from t.klo or o.card_market_highest is distinct from t.khi
  or coalesce(o.card_market_stores,0)<>t.kn or o.card_market_expires_at is distinct from (case when t.kn>0 then t.expires end));
 get diagnostics updated=row_count;
 return updated;
end $function$;
