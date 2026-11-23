-- Maior preço efetivamente observado (mesma janela/regras da mediana). Permite mostrar que um preço "de"
-- anunciado nunca foi praticado no período monitorado. Só é gravado com histórico suficiente (>=5 amostras, >=3 dias).
begin;
alter table public.offers add column if not exists historical_max numeric(12,2);
drop function if exists public.price_history_stats(text);
create function public.price_history_stats(p_offer_id text)
returns table(median numeric, samples integer, days integer, max numeric)
language sql stable security invoker set search_path = ''
as $$
  select percentile_cont(0.5) within group (order by h.price)::numeric,
         count(*)::integer,
         count(distinct (h.observed_at at time zone 'UTC')::date)::integer,
         max(h.price)::numeric
  from public.price_history h
  where h.offer_id = p_offer_id
    and h.price > 0
    and h.observed_at < now() - interval '1 hour'
    and h.observed_at > now() - interval '30 days'
$$;
revoke execute on function public.price_history_stats(text) from public, anon, authenticated;
grant execute on function public.price_history_stats(text) to service_role;
create or replace view public.catalog_offers with (security_invoker=true) as
 select id,store,url,title,category,brand,mpn,image,images,price,original_price,available,seller,sold,rating,review_count,
  (specs - 'Descrição do fabricante'::text) as specs,checked_at,expires_at,historical_median,historical_samples,historical_days,
  discount,evidence,discoveries,coupon_hint,coupon_validated,payment_note,product_id,gtin,variant,last_attempt_at,verification_status,
  market_median,market_lowest,market_stores,market_checked_at,market_highest,market_expires_at,seller_key,payment_basis,historical_max
 from public.offers;
commit;
