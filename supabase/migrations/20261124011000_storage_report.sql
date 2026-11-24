-- Tamanho do banco e do histórico para o relatório do Actions (somente service_role). Plano gratuito: 500 MB.
begin;
create or replace function public.storage_report()
returns table(database_bytes bigint,history_bytes bigint,history_rows bigint,daily_bytes bigint,daily_rows bigint,daily_days integer)
language sql stable security definer set search_path='' as $$
 select pg_database_size(current_database()),pg_total_relation_size('public.price_history'),(select count(*) from public.price_history),
  pg_total_relation_size('public.price_daily'),(select count(*) from public.price_daily),(select count(distinct day)::integer from public.price_daily)
$$;
revoke all on function public.storage_report() from public,anon,authenticated;
grant execute on function public.storage_report() to service_role;
commit;
