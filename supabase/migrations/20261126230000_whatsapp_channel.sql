-- Canal WhatsApp opcional para os mesmos alertas do e-mail (decisão única em lib/notifications.ts).
-- 1) Deduplicação e reserva independentes por canal: e-mail e WhatsApp não bloqueiam um ao outro.
-- 2) Contato do WhatsApp só no servidor: RLS ligado e NENHUMA política para anon/authenticated; a UI usa
--    /api/whatsapp (verifica o JWT do usuário e devolve só o número mascarado). A chave do provedor nunca volta ao cliente.
-- 3) 'accepted' = aceito pelo provedor para envio (CallMeBot não confirma entrega). Nunca gravar como entregue.

alter table public.notification_log add column if not exists channel text not null default 'email';
do $$ begin
 if not exists (select 1 from pg_constraint where conname='notification_log_channel_check') then
  alter table public.notification_log add constraint notification_log_channel_check check (channel in ('email','whatsapp'));
 end if;
end $$;
alter table public.notification_log drop constraint if exists notification_log_status_check;
alter table public.notification_log add constraint notification_log_status_check
 check (status in ('pending','sending','sent','accepted','failed','unknown'));

alter table public.notification_log drop constraint if exists notification_log_user_id_offer_id_day_key;
drop index if exists public.notification_product_day;
create unique index if not exists notification_log_offer_day_channel on public.notification_log(user_id,offer_id,day,channel);
create unique index if not exists notification_product_day_channel on public.notification_log(user_id,notification_key,day,channel);

alter table public.notification_state add column if not exists channel text not null default 'email';
alter table public.notification_state drop constraint if exists notification_state_pkey;
alter table public.notification_state add constraint notification_state_pkey primary key (user_id,notification_key,channel);

create table if not exists public.whatsapp_contacts(
 user_id uuid primary key references auth.users(id) on delete cascade,
 phone text not null check (phone ~ '^55[1-9][0-9]{9,10}$'),
 provider text not null default 'callmebot' check (provider in ('callmebot')),
 api_key text not null check (length(api_key) between 4 and 64),
 status text not null default 'pending' check (status in ('pending','confirmed','error')),
 enabled boolean not null default false,
 consent_at timestamptz not null,
 code_hash text,
 code_expires_at timestamptz,
 code_attempts integer not null default 0,
 codes_sent jsonb not null default '[]'::jsonb,
 confirmed_at timestamptz,
 failures integer not null default 0,
 last_error text,
 updated_at timestamptz not null default now()
);
alter table public.whatsapp_contacts enable row level security;
revoke all on public.whatsapp_contacts from anon,authenticated;

drop function if exists public.claim_notification(uuid,text,text,numeric,text);
create or replace function public.claim_notification(p_user uuid,p_key text,p_offer text,p_price numeric,p_reason text,p_channel text default 'email')
returns bigint language plpgsql security definer set search_path=public as $$
declare v_id bigint; v_day date := (now() at time zone 'America/Sao_Paulo')::date;
begin
 if p_channel not in ('email','whatsapp') then raise exception 'canal inválido'; end if;
 update notification_log set status='unknown',updated_at=now()
  where user_id=p_user and notification_key=p_key and day=v_day and channel=p_channel and status='sending' and updated_at<now()-interval '15 minutes';
 begin
  insert into notification_log(user_id,offer_id,notification_key,price,day,status,attempts,reason,channel,updated_at)
  values(p_user,p_offer,p_key,p_price,v_day,'sending',1,left(p_reason,40),p_channel,now())
  on conflict (user_id,notification_key,day,channel) do update
   set status='sending',attempts=notification_log.attempts+1,offer_id=excluded.offer_id,price=excluded.price,
       reason=excluded.reason,last_error=null,updated_at=now()
   where notification_log.status='failed' and notification_log.attempts<3
     and coalesce(notification_log.next_attempt_at,now())<=now()
  returning id into v_id;
 exception when unique_violation then
  return null;
 end;
 return v_id;
end $$;

drop function if exists public.finish_notification(bigint,boolean,boolean,text,text);
create or replace function public.finish_notification(p_id bigint,p_ok boolean,p_permanent boolean default false,p_error text default null,p_message_id text default null,p_accepted_only boolean default false)
returns void language plpgsql security definer set search_path=public as $$
declare r notification_log;
begin
 select * into r from notification_log where id=p_id and status='sending' for update;
 if not found then return; end if;
 if p_ok then
  update notification_log set status=case when p_accepted_only then 'accepted' else 'sent' end,sent_at=now(),updated_at=now(),last_error=null,message_id=left(p_message_id,200) where id=p_id;
  insert into notification_state(user_id,notification_key,channel,last_price,last_sent_at) values(r.user_id,r.notification_key,r.channel,r.price,now())
   on conflict (user_id,notification_key,channel) do update set last_price=excluded.last_price,last_sent_at=excluded.last_sent_at;
 else
  update notification_log set status='failed',updated_at=now(),last_error=left(p_error,200),
   attempts=case when p_permanent then greatest(attempts,3) else attempts end,
   next_attempt_at=now()+interval '10 minutes'*power(2,greatest(r.attempts,1)-1)
  where id=p_id;
 end if;
end $$;

revoke all on function public.claim_notification(uuid,text,text,numeric,text,text) from public,anon,authenticated;
revoke all on function public.finish_notification(bigint,boolean,boolean,text,text,boolean) from public,anon,authenticated;
grant execute on function public.claim_notification(uuid,text,text,numeric,text,text) to service_role;
grant execute on function public.finish_notification(bigint,boolean,boolean,text,text,boolean) to service_role;
