-- Recuperação da coleta INDEPENDENTE do GitHub: o pg_cron do Supabase (estável) verifica a cada 5 min o batimento da
-- coleta hospedada no Actions. Sem batimento há 25+ min, chama a Vercel em modo de recuperação (rechecagens
-- prioritárias de todas as lojas HTML). Mesma credencial já usada pelos jobs existentes (Vault), sem nova conta.
-- Concorrência: o coletor usa leases por loja; se o Actions voltar, os dois não processam a mesma loja ao mesmo tempo.
begin;
create table if not exists public.infra_heartbeat(name text primary key,at timestamptz not null default now(),detail text);
alter table public.infra_heartbeat enable row level security;
revoke all on public.infra_heartbeat from anon,authenticated;
grant all on public.infra_heartbeat to service_role;
insert into public.infra_heartbeat(name,at,detail) values('actions-collect',now(),'inicial') on conflict(name) do nothing;

select cron.unschedule(jobid) from cron.job where jobname='baixou-collect-recovery';
select cron.schedule('baixou-collect-recovery','*/5 * * * *',$job$
 do $rec$ begin
  if coalesce((select at from public.infra_heartbeat where name='actions-collect'),'epoch')<now()-interval '25 minutes' then
   perform net.http_post(url:='https://baixouofertas.vercel.app/api/jobs/collect?recovery=1',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='baixou_collector_secret')),
    body:='{}'::jsonb,timeout_milliseconds:=58000);
   update public.infra_heartbeat set detail='recuperação acionada pelo Supabase em '||now()::text where name='actions-collect';
  end if;
 end $rec$;
$job$);
commit;
