begin;
create table public.job_leases(name text primary key,expires_at timestamptz not null);
alter table public.job_leases enable row level security;
revoke all on public.job_leases from anon,authenticated;
grant all on public.job_leases to service_role;
create function public.claim_collector_lease(lease_name text,ttl_seconds integer) returns boolean language plpgsql security definer set search_path=public as $$
declare claimed text;
begin insert into public.job_leases(name,expires_at) values(lease_name,now()+make_interval(secs=>least(greatest(ttl_seconds,30),660))) on conflict(name) do update set expires_at=excluded.expires_at where job_leases.expires_at<now() returning name into claimed;return claimed is not null;end $$;
create function public.release_collector_lease(lease_name text) returns void language sql security definer set search_path=public as $$ delete from public.job_leases where name=lease_name; $$;
revoke all on function public.claim_collector_lease(text,integer),public.release_collector_lease(text) from public,anon,authenticated;
grant execute on function public.claim_collector_lease(text,integer),public.release_collector_lease(text) to service_role;
commit;
