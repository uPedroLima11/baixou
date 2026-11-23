-- Referência de preço de mercado: compara cada oferta com o MESMO produto canônico (marca + código do fabricante
-- ou GTIN + variantes compatíveis, via resolve_catalog_product) vendido agora em OUTRAS lojas.
-- Um valor por loja (o menor dela) para que uma loja com vários anúncios não domine; mediana robusta entre lojas.
-- Só ofertas disponíveis, verificadas e dentro do TTL. As cinco fontes publicam preço à vista/Pix (comparáveis).
alter table public.offers
  add column if not exists market_median numeric,
  add column if not exists market_lowest numeric,
  add column if not exists market_stores integer not null default 0,
  add column if not exists market_checked_at timestamptz;

create or replace function public.refresh_market_reference()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare updated integer;
begin
  with live as (
    select id, product_id, store, price from public.offers
    where product_id is not null and available and expires_at > now() and verification_status = 'verified'
  ), per_store as (
    select product_id, store, min(price) as p from live group by product_id, store
  ), ref as (
    select l.id,
           (select percentile_cont(0.5) within group (order by ps.p) from per_store ps where ps.product_id = l.product_id and ps.store <> l.store) as med,
           (select min(ps.p) from per_store ps where ps.product_id = l.product_id and ps.store <> l.store) as lo,
           (select count(*) from per_store ps where ps.product_id = l.product_id and ps.store <> l.store)::integer as n
    from live l
  )
  update public.offers o
     set market_median = r.med, market_lowest = r.lo, market_stores = r.n, market_checked_at = now()
    from ref r
   where o.id = r.id;
  get diagnostics updated = row_count;
  -- Sem comparação atual: limpa referências antigas para não exibir mercado vencido.
  update public.offers
     set market_median = null, market_lowest = null, market_stores = 0, market_checked_at = now()
   where (market_stores <> 0 or market_median is not null)
     and not (product_id is not null and available and expires_at > now() and verification_status = 'verified');
  return updated;
end $$;

revoke execute on function public.refresh_market_reference() from public, anon, authenticated;
grant execute on function public.refresh_market_reference() to service_role;

-- A listagem pública passa a expor a referência (colunas novas só podem ser acrescentadas ao fim da view).
create or replace view public.catalog_offers with (security_invoker = true) as
select id, store, url, title, category, brand, mpn, image, images, price, original_price, available,
       seller, sold, rating, review_count, (specs - 'Descrição do fabricante') as specs,
       checked_at, expires_at, historical_median, historical_samples, historical_days, discount,
       evidence, discoveries, coupon_hint, coupon_validated, payment_note, product_id, gtin, variant,
       last_attempt_at, verification_status, market_median, market_lowest, market_stores, market_checked_at
from public.offers;

select public.refresh_market_reference();
