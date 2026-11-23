begin;
create extension if not exists pgcrypto;
create extension if not exists unaccent;
create table public.offers (
 id text primary key,store text not null check(store in ('kabum','terabyte','pichau')),url text not null,title text not null,category text not null,brand text,mpn text,
 image text,images jsonb not null default '[]',price numeric(12,2) not null check(price>0),original_price numeric(12,2),available boolean not null default false,seller text not null,
 sold integer,rating numeric(3,2),review_count integer,specs jsonb not null default '{}',checked_at timestamptz not null,expires_at timestamptz not null,
 historical_median numeric(12,2),historical_samples integer not null default 0,historical_days integer not null default 0,discount integer not null default 0,evidence text not null default 'none' check(evidence in ('history','retailer','none')));
create index offers_catalog on public.offers(available,expires_at,discount desc);
create index offers_mpn on public.offers(mpn) where mpn is not null;
create table public.price_history(id bigint generated always as identity primary key,offer_id text not null references public.offers(id) on delete cascade,price numeric(12,2) not null check(price>0),observed_at timestamptz not null default now(),bucket text not null,unique(offer_id,bucket));
create index history_lookup on public.price_history(offer_id,observed_at desc);
create table public.source_status(store text primary key,status text not null,checked_at timestamptz not null default now(),message text not null,products integer not null default 0);
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,name text not null default '',avatar_url text,email_enabled boolean not null default false,global_max_price numeric(12,2),unsubscribe_token uuid not null default gen_random_uuid());
create table public.wishlist(user_id uuid not null references auth.users(id) on delete cascade,offer_id text not null references public.offers(id) on delete cascade,created_at timestamptz not null default now(),primary key(user_id,offer_id));
create table public.alerts(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,category text not null default 'all',offer_id text references public.offers(id) on delete cascade,max_price numeric(12,2) not null check(max_price>0),min_discount integer not null default 5 check(min_discount between 5 and 95),enabled boolean not null default true,created_at timestamptz not null default now(),check(length(category)<=30));
create index alerts_user on public.alerts(user_id);
create table public.notification_log(id bigint generated always as identity primary key,user_id uuid not null references auth.users(id) on delete cascade,offer_id text not null references public.offers(id) on delete cascade,price numeric(12,2) not null,day date not null default current_date,status text not null default 'pending',attempts integer not null default 0,updated_at timestamptz not null default now(),unique(user_id,offer_id,day));
create or replace function public.create_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,name) values(new.id,left(coalesce(new.raw_user_meta_data->>'name',''),80));return new;end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();
revoke all on function public.create_profile() from public;
alter table public.offers enable row level security;alter table public.price_history enable row level security;alter table public.source_status enable row level security;alter table public.profiles enable row level security;alter table public.wishlist enable row level security;alter table public.alerts enable row level security;alter table public.notification_log enable row level security;
create policy public_offers on public.offers for select to anon,authenticated using(true);
create policy public_history on public.price_history for select to anon,authenticated using(true);
create policy public_sources on public.source_status for select to anon,authenticated using(true);
create policy own_profile_read on public.profiles for select to authenticated using((select auth.uid())=id);
create policy own_profile_update on public.profiles for update to authenticated using((select auth.uid())=id) with check((select auth.uid())=id);
create policy own_wishlist on public.wishlist for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy own_alerts on public.alerts for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
grant select on public.offers,public.price_history,public.source_status to anon,authenticated;
grant select,update on public.profiles to authenticated;
grant select,insert,update,delete on public.wishlist,public.alerts to authenticated;
revoke all on public.notification_log from anon,authenticated;
grant all on all tables in schema public to service_role;grant usage,select on all sequences in schema public to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('avatars','avatars',true,1048576,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy avatar_read on storage.objects for select using(bucket_id='avatars');
create policy avatar_insert on storage.objects for insert to authenticated with check(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatar_update on storage.objects for update to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatar_delete on storage.objects for delete to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
