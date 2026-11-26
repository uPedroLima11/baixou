-- 1) Preço habitual por DIA, não por verificação.
-- Antes: mediana de todas as verificações horárias com mais de 24 h. Um dia com muitas verificações pesava mais e
-- um preço praticado só ~1,5 dia (RTX 5060 KaBuM, R$ 6.678,23 em 23–24/11) virava "habitual" por ter 27 de 34 amostras.
-- Agora: um valor por dia de São Paulo = MENOR preço verificado no dia (o mesmo ponto do gráfico diário), somente
-- dias COMPLETOS anteriores a hoje (a promoção de hoje nunca entra), até 30 dias. Preço habitual = mediana desses
-- valores diários. Um preço que já se repetia em dias anteriores (ex.: alternância R$ 1.194,99/R$ 1.299,99) não é queda.
-- Usa price_daily (resumo de 400 dias), então a referência sobrevive à retenção de 21 dias do histórico bruto.
-- Mantém as colunas de saída: median/samples/days/max (janela completa, bruto) e ref_* (janela de referência diária).
begin;
create or replace function public.price_history_stats(p_offer_id text)
returns table(median numeric,samples integer,days integer,max numeric,ref_median numeric,ref_samples integer,ref_days integer,ref_min numeric,ref_max numeric)
language sql stable security invoker set search_path='' as $$
 with h as (select price,observed_at from public.price_history
            where offer_id=p_offer_id and price>0 and observed_at<now()-interval '1 hour' and observed_at>now()-interval '30 days'),
 t as (select (now() at time zone 'America/Sao_Paulo')::date as today),
 r as (select d.* from public.price_daily d,t where d.offer_id=p_offer_id and d.day<t.today and d.day>=t.today-30)
 select (select percentile_cont(0.5) within group (order by price) from h)::numeric,
        (select count(*) from h)::integer,
        (select count(distinct (observed_at at time zone 'America/Sao_Paulo')::date) from h)::integer,
        (select max(price) from h)::numeric,
        (select percentile_cont(0.5) within group (order by min_cents) from r)::numeric/100,
        (select coalesce(sum(samples),0) from r)::integer,
        (select count(*) from r)::integer,
        (select min(min_cents) from r)::numeric/100,
        (select max(max_cents) from r)::numeric/100
$$;
revoke execute on function public.price_history_stats(text) from public,anon,authenticated;
grant execute on function public.price_history_stats(text) to service_role;

-- 2) Recalcula agora a referência e a evidência de todos os anúncios (mesma regra de evidenceFromStats em lib/types.ts),
-- para não esperar a próxima rechecagem. Só campos derivados do histórico; preço, estoque, TTL e checked_at intocados.
with s as (
 select o.id,o.price,o.original_price,x.*
 from public.offers o cross join lateral public.price_history_stats(o.id) x
 where o.verification_status<>'announced'
), v as (
 select s.*, (ref_samples>=5 and ref_days>=3 and ref_median>0) as enough,
  case when ref_median>0 then (1-price/ref_median)*100 else 0 end as pct,
  case when original_price>price then round((1-price/original_price)*100) else 0 end as announced
 from s
)
update public.offers o set
 reference_median=case when v.ref_samples>0 and v.ref_median>0 then round(v.ref_median,2) end,
 reference_samples=v.ref_samples, reference_days=v.ref_days,
 reference_min=case when v.ref_min>0 then v.ref_min end, reference_max=case when v.ref_max>0 then v.ref_max end,
 historical_median=case when v.enough then round(v.ref_median,2) end,
 historical_samples=v.ref_samples, historical_days=v.ref_days,
 historical_max=case when v.enough and v.max>0 then v.max end,
 discount=case when v.enough and v.pct>=5 then floor(v.pct+1e-9) else v.announced end,
 evidence=case when v.enough and v.pct>=5 then 'history' when v.announced>=5 then 'retailer' else 'none' end
from v where o.id=v.id;

-- 3) Favoritos x alertas: por padrão, um alerta ATIVO que cobre o produto (mesma categoria/produto/marca/specs)
-- define o limite de compra; a lista de desejos não avisa fora dele. Só com esta opção marcada pelo usuário.
alter table public.profiles add column if not exists wishlist_ignore_alert_limits boolean not null default false;
commit;
