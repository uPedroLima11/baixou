-- "Histórico de preços anunciados": um resumo por anúncio e dia de São Paulo dos preços que a PRÓPRIA LOJA publicou
-- (canais no Telegram), separado de price_history/price_daily (verificações). Nunca usado em estatísticas verificadas,
-- referência de mercado, evidência de queda ou alertas. Centavos (int4) para economia.
-- Deduplicação: o mesmo post é lido em várias coletas; só conta uma vez (post_key único por dia e anúncio).
begin;
create table if not exists public.announced_daily(
 offer_id text not null references public.offers(id) on delete cascade,
 day date not null,
 min_cents integer not null check(min_cents>0),
 min_posted_at timestamptz not null,
 min_post text not null,
 last_cents integer not null check(last_cents>0),
 last_posted_at timestamptz not null,
 last_post text not null,
 posts smallint not null default 1,
 primary key(offer_id,day)
);
create index if not exists announced_daily_day on public.announced_daily(day);
alter table public.announced_daily enable row level security;
drop policy if exists public_announced_daily on public.announced_daily;
create policy public_announced_daily on public.announced_daily for select to anon,authenticated using(true);
grant select on public.announced_daily to anon,authenticated;
grant all on public.announced_daily to service_role;

create or replace function public.record_announcement(p_offer text,p_price numeric,p_posted_at timestamptz,p_post text)
returns void language plpgsql security definer set search_path='' as $$
declare c integer := round(p_price*100)::integer; d date := (p_posted_at at time zone 'America/Sao_Paulo')::date;
begin
 if c<=0 or p_post is null or length(p_post)>120 then return; end if;
 insert into public.announced_daily as a(offer_id,day,min_cents,min_posted_at,min_post,last_cents,last_posted_at,last_post,posts)
 values(p_offer,d,c,p_posted_at,p_post,c,p_posted_at,p_post,1)
 on conflict(offer_id,day) do update set
  min_cents=case when excluded.min_cents<a.min_cents then excluded.min_cents else a.min_cents end,
  min_posted_at=case when excluded.min_cents<a.min_cents then excluded.min_posted_at else a.min_posted_at end,
  min_post=case when excluded.min_cents<a.min_cents then excluded.min_post else a.min_post end,
  last_cents=case when excluded.last_posted_at>a.last_posted_at then excluded.last_cents else a.last_cents end,
  last_post=case when excluded.last_posted_at>a.last_posted_at then excluded.last_post else a.last_post end,
  posts=case when excluded.last_posted_at>a.last_posted_at and excluded.last_post<>a.last_post then least(a.posts+1,32767) else a.posts end,
  last_posted_at=greatest(a.last_posted_at,excluded.last_posted_at);
end $$;
revoke all on function public.record_announcement(text,numeric,timestamptz,text) from public,anon,authenticated;
grant execute on function public.record_announcement(text,numeric,timestamptz,text) to service_role;
commit;
