-- Preço habitual NÃO contaminado pela promoção atual: mediana/mín./máx. das observações verificadas com mais de 24 h
-- (até 30 dias). Uma queda iniciada hoje não entra na própria referência. Usado pelo Baixou Score (lib/score.ts).
-- Gravado em cada verificação pelo coletor/conectores (evidenceFromStats); só observações reais de price_history.
begin;
alter table public.offers add column if not exists reference_median numeric(12,2),
 add column if not exists reference_samples integer,
 add column if not exists reference_days integer,
 add column if not exists reference_min numeric(12,2),
 add column if not exists reference_max numeric(12,2);
drop function if exists public.price_history_stats(text);
create function public.price_history_stats(p_offer_id text)
returns table(median numeric,samples integer,days integer,max numeric,ref_median numeric,ref_samples integer,ref_days integer,ref_min numeric,ref_max numeric)
language sql stable security invoker set search_path='' as $$
 with h as (select price,observed_at from public.price_history
            where offer_id=p_offer_id and price>0 and observed_at<now()-interval '1 hour' and observed_at>now()-interval '30 days'),
 r as (select * from h where observed_at<now()-interval '24 hours')
 select (select percentile_cont(0.5) within group (order by price) from h)::numeric,
        (select count(*) from h)::integer,
        (select count(distinct (observed_at at time zone 'UTC')::date) from h)::integer,
        (select max(price) from h)::numeric,
        (select percentile_cont(0.5) within group (order by price) from r)::numeric,
        (select count(*) from r)::integer,
        (select count(distinct (observed_at at time zone 'UTC')::date) from r)::integer,
        (select min(price) from r)::numeric,
        (select max(price) from r)::numeric
$$;
revoke execute on function public.price_history_stats(text) from public,anon,authenticated;
grant execute on function public.price_history_stats(text) to service_role;
create or replace view public.catalog_offers with (security_invoker=true) as
 select id,store,url,title,category,brand,mpn,image,images,price,original_price,available,seller,sold,rating,review_count,
  (specs - 'Descrição do fabricante'::text) as specs,checked_at,expires_at,historical_median,historical_samples,historical_days,
  discount,evidence,discoveries,coupon_hint,coupon_validated,payment_note,product_id,gtin,variant,last_attempt_at,verification_status,
  market_median,market_lowest,market_stores,market_checked_at,market_highest,market_expires_at,seller_key,payment_basis,historical_max,
  reference_median,reference_samples,reference_days,reference_min,reference_max
 from public.offers;
commit;
