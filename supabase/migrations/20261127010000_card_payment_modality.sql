-- Modalidade de pagamento como parte da inteligência de preço (Pix/à vista × cartão de crédito).
-- Regras: o preço no cartão é SEMPRE o informado pela loja (total explícito ou parcelas sem juros N×valor publicadas);
-- nunca estimado por porcentagem sobre o Pix. Sem dado: NULL ("não informado"). Histórico do cartão começa nesta data;
-- nada é preenchido para trás. Pix e cartão nunca se misturam em histórico, preço habitual ou comparação entre lojas.
begin;

alter table public.offers
 add column if not exists card_price numeric(12,2) check (card_price is null or card_price>0),
 add column if not exists card_installments smallint check (card_installments is null or card_installments between 1 and 48),
 add column if not exists card_installment_value numeric(12,2) check (card_installment_value is null or card_installment_value>0),
 add column if not exists card_interest_free boolean,
 add column if not exists card_reference_median numeric(12,2),
 add column if not exists card_reference_samples integer,
 add column if not exists card_reference_days integer,
 add column if not exists card_reference_min numeric(12,2),
 add column if not exists card_reference_max numeric(12,2),
 add column if not exists card_historical_max numeric(12,2),
 add column if not exists card_market_median numeric(12,2),
 add column if not exists card_market_lowest numeric(12,2),
 add column if not exists card_market_highest numeric(12,2),
 add column if not exists card_market_stores integer not null default 0,
 add column if not exists card_market_expires_at timestamptz;

alter table public.price_history add column if not exists card_price numeric(12,2) check (card_price is null or card_price>0);
alter table public.price_daily
 add column if not exists card_min_cents integer check (card_min_cents is null or card_min_cents>0),
 add column if not exists card_max_cents integer,
 add column if not exists card_close_cents integer,
 add column if not exists card_samples smallint not null default 0;

create or replace function public.roll_price_daily() returns trigger language plpgsql security definer set search_path='' as $$
declare c integer := round(new.price*100)::integer; k integer := case when new.card_price>0 then round(new.card_price*100)::integer end;
begin
 insert into public.price_daily as p(offer_id,day,min_cents,max_cents,close_cents,samples,card_min_cents,card_max_cents,card_close_cents,card_samples)
 values(new.offer_id,(new.observed_at at time zone 'America/Sao_Paulo')::date,c,c,c,1,k,k,k,case when k is null then 0 else 1 end)
 on conflict(offer_id,day) do update set
  min_cents=least(p.min_cents,excluded.min_cents),
  max_cents=greatest(p.max_cents,excluded.max_cents),
  close_cents=excluded.close_cents,
  samples=least(p.samples+1,32767),
  card_min_cents=case when excluded.card_min_cents is null then p.card_min_cents else least(coalesce(p.card_min_cents,excluded.card_min_cents),excluded.card_min_cents) end,
  card_max_cents=case when excluded.card_max_cents is null then p.card_max_cents else greatest(coalesce(p.card_max_cents,excluded.card_max_cents),excluded.card_max_cents) end,
  card_close_cents=coalesce(excluded.card_close_cents,p.card_close_cents),
  card_samples=least(p.card_samples+case when excluded.card_min_cents is null then 0 else 1 end,32767);
 return null;
end $$;
revoke all on function public.roll_price_daily() from public,anon,authenticated;

-- Preço habitual NO CARTÃO: mesma regra do Pix (mediana dos menores preços diários de dias completos anteriores, 30 dias),
-- só sobre dias com preço de cartão observado.
create or replace function public.card_price_stats(p_offer_id text)
returns table(max numeric, ref_median numeric, ref_samples integer, ref_days integer, ref_min numeric, ref_max numeric)
language sql stable set search_path to '' as $$
 with t as (select (now() at time zone 'America/Sao_Paulo')::date as today),
 h as (select card_price from public.price_history where offer_id=p_offer_id and card_price>0 and observed_at<now()-interval '1 hour' and observed_at>now()-interval '30 days'),
 r as (select d.* from public.price_daily d,t where d.offer_id=p_offer_id and d.card_min_cents is not null and d.day<t.today and d.day>=t.today-30)
 select (select max(card_price) from h)::numeric,
        (select percentile_cont(0.5) within group (order by card_min_cents) from r)::numeric/100,
        (select coalesce(sum(card_samples),0) from r)::integer,
        (select count(*) from r)::integer,
        (select min(card_min_cents) from r)::numeric/100,
        (select max(card_max_cents) from r)::numeric/100
$$;
revoke all on function public.card_price_stats(text) from public,anon,authenticated;
grant execute on function public.card_price_stats(text) to service_role;

-- Referência de mercado por modalidade: a do Pix fica como estava; a do cartão compara só totais no cartão informados
-- pelas lojas (mesmo produto canônico, vendedores independentes, mesma deduplicação e validade).
create or replace function public.refresh_market_reference()
 returns integer language plpgsql set search_path to '' as $function$
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
 )
 update public.offers o set market_median=r.med,market_lowest=r.lo,market_highest=r.hi,
  market_stores=r.n,market_expires_at=case when r.n>0 then r.expires end,
  card_market_median=r.kmed,card_market_lowest=r.klo,card_market_highest=r.khi,card_market_stores=r.kn,
  card_market_expires_at=case when r.kn>0 then r.expires end,market_checked_at=now()
 from (select o.id,r.med,r.lo,r.hi,coalesce(r.n,0) as n,r.kmed,r.klo,r.khi,coalesce(r.kn,0) as kn,r.expires from public.offers o left join ref r on r.id=o.id) r
 where o.id=r.id;
 get diagnostics updated=row_count;
 return updated;
end $function$;

-- Novas colunas no fim da view pública (create or replace view só permite acrescentar no fim).
create or replace view public.catalog_offers with (security_invoker=true) as
 select id,store,url,title,category,brand,mpn,image,images,price,original_price,available,seller,sold,rating,review_count,
  (specs - 'Descrição do fabricante'::text) as specs,checked_at,expires_at,historical_median,historical_samples,historical_days,
  discount,evidence,discoveries,coupon_hint,coupon_validated,payment_note,product_id,gtin,variant,last_attempt_at,
  verification_status,market_median,market_lowest,market_stores,market_checked_at,market_highest,market_expires_at,
  seller_key,payment_basis,historical_max,reference_median,reference_samples,reference_days,reference_min,reference_max,
  card_price,card_installments,card_installment_value,card_interest_free,card_reference_median,card_reference_samples,
  card_reference_days,card_reference_min,card_reference_max,card_historical_max,card_market_median,card_market_lowest,
  card_market_highest,card_market_stores,card_market_expires_at
 from public.offers;

-- Alertas por modalidade (existentes = Pix, comportamento preservado) e preferência salva do usuário.
alter table public.alerts add column if not exists payment text not null default 'pix';
alter table public.alerts drop constraint if exists alerts_payment_check;
alter table public.alerts add constraint alerts_payment_check check (payment in ('pix','card'));
alter table public.profiles add column if not exists payment_preference text not null default 'pix';
alter table public.profiles drop constraint if exists profiles_payment_preference_check;
alter table public.profiles add constraint profiles_payment_preference_check check (payment_preference in ('pix','card'));
commit;
