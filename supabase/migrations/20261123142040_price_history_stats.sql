-- Agrega o histórico no banco para o coletor: evita baixar até 720 linhas por verificação
-- (egress do plano gratuito). Mesma regra de lib/types.ts calculateEvidence: exclui a última hora,
-- janela de 30 dias, mediana com média dos dois centrais (percentile_cont) e dias distintos em UTC.
create or replace function public.price_history_stats(p_offer_id text)
returns table(median numeric, samples integer, days integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select percentile_cont(0.5) within group (order by h.price)::numeric,
         count(*)::integer,
         count(distinct (h.observed_at at time zone 'UTC')::date)::integer
  from public.price_history h
  where h.offer_id = p_offer_id
    and h.price > 0
    and h.observed_at < now() - interval '1 hour'
    and h.observed_at > now() - interval '30 days'
$$;

revoke execute on function public.price_history_stats(text) from public, anon, authenticated;
grant execute on function public.price_history_stats(text) to service_role;
