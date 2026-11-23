begin;
create table public.collection_state(store text primary key references public.store_registry(id),cursor integer not null default 0,failures integer not null default 0,next_allowed_at timestamptz not null default now(),last_success_at timestamptz);
create table public.collection_pages(store text not null references public.store_registry(id),url text not null check(length(url)<2048),last_attempt_at timestamptz,next_attempt_at timestamptz not null default now(),primary key(store,url));
create table public.product_candidates(store text not null references public.store_registry(id),url text not null check(length(url)<2048),category text not null default 'other',discovered_at timestamptz not null default now(),last_attempt_at timestamptz,next_attempt_at timestamptz not null default now(),failures integer not null default 0,primary key(store,url));
create index candidates_due on public.product_candidates(store,next_attempt_at,last_attempt_at);
create index pages_due on public.collection_pages(store,next_attempt_at,last_attempt_at);
create index offers_revalidation on public.offers(store,last_attempt_at,checked_at);
create table public.collection_runs(id bigint generated always as identity primary key,store text not null,started_at timestamptz not null default now(),finished_at timestamptz,discovered integer not null default 0,verified integer not null default 0,failed integer not null default 0,message text);
alter table public.collection_state enable row level security;
alter table public.collection_pages enable row level security;
alter table public.product_candidates enable row level security;
alter table public.collection_runs enable row level security;
revoke all on public.collection_state,public.collection_pages,public.product_candidates,public.collection_runs from anon,authenticated;
grant all on public.collection_state,public.collection_pages,public.product_candidates,public.collection_runs to service_role;
grant usage,select on sequence public.collection_runs_id_seq to service_role;
insert into public.product_candidates(store,url,category,last_attempt_at,next_attempt_at) select store,url,category,last_attempt_at,least(expires_at,now()) from public.offers on conflict do nothing;
-- Candidates remain partial until hosted parsing AND persisted offers have been verified.
update public.store_registry set homepage=case id when 'waz' then 'https://www.waz.com.br' when 'oficinadosbits' then 'https://www.oficinadosbits.com.br' when 'guerradigital' then 'https://www.guerradigital.com.br' when 'patoloco' then 'https://patoloco.com.br' end,status='partial' where id in ('waz','oficinadosbits','guerradigital','patoloco');
commit;
