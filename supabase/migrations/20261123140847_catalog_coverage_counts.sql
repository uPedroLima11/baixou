begin;
create function public.catalog_coverage() returns jsonb language sql stable security invoker set search_path=pg_catalog,public as $$
 select jsonb_build_object('generated_at',now(),'stores',coalesce(jsonb_agg(t),'[]'::jsonb)) from (
  select store,count(*) as collected,
   count(*) filter(where available and expires_at>now() and verification_status<>'excluded') as available,
   count(*) filter(where available and expires_at>now() and verification_status<>'excluded' and evidence in ('history','retailer') and discount>=5) as displayable,
   count(*) filter(where available and expires_at<=now() and verification_status<>'excluded') as expired_awaiting_check
  from public.offers group by store order by store
 )t;
$$;
revoke all on function public.catalog_coverage() from public;
grant execute on function public.catalog_coverage() to anon,authenticated,service_role;
commit;
