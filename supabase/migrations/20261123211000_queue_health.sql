-- Saúde da fila de rechecagem por loja (somente leitura, service_role): disponíveis no TTL, devidos,
-- disponíveis já vencidos sem nova confirmação e atraso (min) desde next_attempt_at.
create or replace function public.queue_health()
returns table(store text,live integer,due_live integer,expired_available integer,avg_lag_min numeric,max_lag_min numeric)
language sql stable security invoker set search_path='' as $$
 select c.store,
  (count(*) filter(where o.available and o.expires_at>now()))::integer,
  (count(*) filter(where o.available and c.next_attempt_at<=now()))::integer,
  (count(*) filter(where o.available and o.expires_at<=now()))::integer,
  round(coalesce(avg(extract(epoch from now()-c.next_attempt_at)/60) filter(where o.available and c.next_attempt_at<=now()),0)::numeric,1),
  round(coalesce(max(extract(epoch from now()-c.next_attempt_at)/60) filter(where o.available and c.next_attempt_at<=now()),0)::numeric,1)
 from public.product_candidates c join public.offers o on o.url=c.url
 group by c.store order by c.store
$$;
revoke execute on function public.queue_health() from public,anon,authenticated;
grant execute on function public.queue_health() to service_role;
