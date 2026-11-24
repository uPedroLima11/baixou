-- Série diária de um grupo de produtos equivalentes (ids calculados no servidor por lib/stats.ts).
-- Por dia de São Paulo: anúncios observados, menor preço do dia (e qual anúncio), mediana dos menores diários e,
-- para amostra consistente, a mediana da razão menor(d)/menor(d-1) dos MESMOS anúncios observados nos dois dias.
-- Usa a chave primária (offer_id, day) de price_daily; no máximo 600 ids e 400 dias.
begin;
create or replace function public.group_daily(p_ids text[],p_days integer)
returns table(day date,offers integer,lowest numeric,lowest_offer text,median_low numeric,pairs integer,ratio numeric)
language sql stable security invoker set search_path='' as $$
 with t as (select (now() at time zone 'America/Sao_Paulo')::date as today),
 d as (select x.offer_id,x.day,x.min_cents from public.price_daily x,t
       where x.offer_id=any(p_ids[1:600]) and x.day>=t.today-least(greatest(p_days,1),400))
 select a.day,count(*)::integer,min(a.min_cents)/100.0,(array_agg(a.offer_id order by a.min_cents,a.offer_id))[1],
  (percentile_cont(0.5) within group (order by a.min_cents))::numeric/100.0,count(b.offer_id)::integer,
  (percentile_cont(0.5) within group (order by a.min_cents::numeric/nullif(b.min_cents,0)) filter (where b.offer_id is not null))::numeric
 from d a left join d b on b.offer_id=a.offer_id and b.day=a.day-1
 group by a.day order by a.day
$$;
revoke all on function public.group_daily(text[],integer) from public;
grant execute on function public.group_daily(text[],integer) to anon,authenticated,service_role;
commit;
