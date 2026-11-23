begin;
create table public.discovery_sources(id text primary key,name text not null,kind text not null check(kind in ('telegram','webhook','feed')),enabled boolean not null default false,permission_note text not null default '',secret_hash text,channel_id text,attribution_url text);
create table public.discovery_events(id bigint generated always as identity primary key,source_id text not null references public.discovery_sources(id),external_id text not null,original_url text not null,posted_at timestamptz not null,received_at timestamptz not null default now(),coupon_hint text,status text not null default 'pending',canonical_url text,offer_id text references public.offers(id),error text,attempts integer not null default 0,unique(source_id,external_id,original_url));
create index discovery_priority on public.discovery_events(status,received_at desc);
alter table public.discovery_sources enable row level security;
alter table public.discovery_events enable row level security;
revoke all on public.discovery_sources,public.discovery_events from anon,authenticated;
grant all on public.discovery_sources,public.discovery_events to service_role;
grant usage,select on all sequences in schema public to service_role;
insert into public.discovery_sources(id,name,kind,permission_note,attribution_url) values
('linksbr-telegram','LinksBR · Telegram','telegram','Desativada: depende de bot adicionado ao canal autorizado e condições de reutilização. Não há API/feed público identificado.','https://t.me/LinksBrazil'),
('linksbr-discord','LinksBR · Discord','webhook','Desativada: requer permissão da comunidade e bridge de bot oficial; sem self-bot nem Gateway em Vercel.','https://discord.gg/LinksBrazil'),
('authorized-feed','Feed autorizado','feed','Habilitar apenas após registrar URL oficial, licença, cache e validade.','');
alter table public.offers add column discoveries jsonb not null default '[]';
alter table public.offers add column coupon_hint text;
alter table public.offers add column coupon_validated boolean not null default false;
alter table public.offers add column payment_note text not null default 'Preço à vista informado pela loja. Confira o pagamento e o frete na origem.';
commit;
