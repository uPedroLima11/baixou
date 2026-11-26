-- WhatsApp com remetente central (Baileys, sessão de aparelho conectado) em vez de chave por usuário (CallMeBot removido).
-- Tudo aqui é só do servidor: RLS ligado e nenhuma política/privilégio para anon/authenticated.
-- 1) whatsapp_auth: estado da sessão (credenciais e chaves Signal) CRIPTOGRAFADO na aplicação (AES-256-GCM, chave fora do banco).
-- 2) whatsapp_sender: situação do número remetente (sem segredo; código de pareamento expira em minutos).
-- 3) whatsapp_contacts: o usuário confirma enviando "BAIXOU <código>" ao remetente; guardamos o JID de quem escreveu.
-- 4) notification_log: fila de saída do canal WhatsApp ('queued' + body); 'accepted' = servidor do WhatsApp aceitou,
--    'delivered' = recibo de entrega observado. Nunca marcar entregue sem recibo.

create table if not exists public.whatsapp_auth(
 id text primary key check (length(id) between 1 and 300),
 value text not null,
 updated_at timestamptz not null default now()
);
alter table public.whatsapp_auth enable row level security;
revoke all on public.whatsapp_auth from anon,authenticated;

create table if not exists public.whatsapp_sender(
 id smallint primary key default 1 check (id=1),
 phone text check (phone ~ '^55[1-9][0-9]{9,10}$'),
 status text not null default 'unlinked' check (status in ('unlinked','pairing','connected','logged_out','error')),
 pairing_code text,
 pairing_expires_at timestamptz,
 last_connected_at timestamptz,
 last_error text,
 updated_at timestamptz not null default now()
);
insert into public.whatsapp_sender(id) values(1) on conflict do nothing;
alter table public.whatsapp_sender enable row level security;
revoke all on public.whatsapp_sender from anon,authenticated;

alter table public.whatsapp_contacts alter column api_key drop not null;
alter table public.whatsapp_contacts drop constraint if exists whatsapp_contacts_api_key_check;
alter table public.whatsapp_contacts drop constraint if exists whatsapp_contacts_provider_check;
alter table public.whatsapp_contacts alter column provider set default 'baileys';
update public.whatsapp_contacts set provider='baileys',api_key=null,status='pending',enabled=false,code_hash=null,code_expires_at=null,confirmed_at=null,updated_at=now();
alter table public.whatsapp_contacts add constraint whatsapp_contacts_provider_check check (provider in ('baileys'));
alter table public.whatsapp_contacts add column if not exists jid text;
create index if not exists whatsapp_contacts_phone on public.whatsapp_contacts(phone);

alter table public.notification_log add column if not exists body text;
alter table public.notification_log drop constraint if exists notification_log_status_check;
alter table public.notification_log add constraint notification_log_status_check
 check (status in ('pending','queued','sending','sent','accepted','delivered','failed','unknown'));
create index if not exists notification_log_whatsapp_queue on public.notification_log(updated_at) where channel='whatsapp' and status='queued';
