-- Entrega idempotente de alertas por e-mail.
-- Um envio por usuário/produto/dia (America/Sao_Paulo). A reserva é atômica no banco, então
-- execuções simultâneas (Vercel e GitHub Actions) não enviam a mesma notificação duas vezes.
-- Falhas comprovadas do SMTP podem ser repetidas até 3 vezes com espera crescente.
-- Envio interrompido sem resposta ('sending' antigo) vira 'unknown' e NUNCA é reenviado
-- automaticamente: preferimos perder um aviso a duplicá-lo.

alter table public.notification_log
 add column if not exists reason text,
 add column if not exists sent_at timestamptz,
 add column if not exists next_attempt_at timestamptz,
 add column if not exists last_error text,
 add column if not exists message_id text;

do $$ begin
 if not exists (select 1 from pg_constraint where conname='notification_log_status_check') then
  alter table public.notification_log add constraint notification_log_status_check
   check (status in ('pending','sending','sent','failed','unknown'));
 end if;
end $$;

create or replace function public.claim_notification(p_user uuid,p_key text,p_offer text,p_price numeric,p_reason text)
returns bigint language plpgsql security definer set search_path=public as $$
declare v_id bigint; v_day date := (now() at time zone 'America/Sao_Paulo')::date;
begin
 update notification_log set status='unknown',updated_at=now()
  where user_id=p_user and notification_key=p_key and day=v_day and status='sending' and updated_at<now()-interval '15 minutes';
 begin
  insert into notification_log(user_id,offer_id,notification_key,price,day,status,attempts,reason,updated_at)
  values(p_user,p_offer,p_key,p_price,v_day,'sending',1,left(p_reason,40),now())
  on conflict (user_id,notification_key,day) do update
   set status='sending',attempts=notification_log.attempts+1,offer_id=excluded.offer_id,price=excluded.price,
       reason=excluded.reason,last_error=null,updated_at=now()
   where notification_log.status='failed' and notification_log.attempts<3
     and coalesce(notification_log.next_attempt_at,now())<=now()
  returning id into v_id;
 exception when unique_violation then
  return null; -- mesma oferta já reservada hoje com outra chave de produto
 end;
 return v_id;
end $$;

create or replace function public.finish_notification(p_id bigint,p_ok boolean,p_permanent boolean default false,p_error text default null,p_message_id text default null)
returns void language plpgsql security definer set search_path=public as $$
declare r notification_log;
begin
 select * into r from notification_log where id=p_id and status='sending' for update;
 if not found then return; end if;
 if p_ok then
  update notification_log set status='sent',sent_at=now(),updated_at=now(),last_error=null,message_id=left(p_message_id,200) where id=p_id;
  insert into notification_state(user_id,notification_key,last_price,last_sent_at) values(r.user_id,r.notification_key,r.price,now())
   on conflict (user_id,notification_key) do update set last_price=excluded.last_price,last_sent_at=excluded.last_sent_at;
 else
  update notification_log set status='failed',updated_at=now(),last_error=left(p_error,200),
   attempts=case when p_permanent then greatest(attempts,3) else attempts end,
   next_attempt_at=now()+interval '10 minutes'*power(2,greatest(r.attempts,1)-1)
  where id=p_id;
 end if;
end $$;

revoke all on function public.claim_notification(uuid,text,text,numeric,text) from public,anon,authenticated;
revoke all on function public.finish_notification(bigint,boolean,boolean,text,text) from public,anon,authenticated;
grant execute on function public.claim_notification(uuid,text,text,numeric,text) to service_role;
grant execute on function public.finish_notification(bigint,boolean,boolean,text,text) to service_role;
