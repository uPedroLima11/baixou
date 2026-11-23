begin;
create index collection_runs_recent on public.collection_runs(started_at desc);
-- One recovery opportunity two minutes after each primary batch.
-- Do not retry when any worker started recently (including a successful dispatch with a lost response).
select cron.schedule('baixou-collect-retry','2,17,32,47 * * * *',$job$
 do $retry$ begin
  if not exists(select 1 from public.collection_runs where started_at>now()-interval '5 minutes' and store in ('kabum','waz','guerradigital','patoloco')) then
   perform net.http_post(url:='https://baixouofertas.vercel.app/api/jobs/collect?batch=1',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='baixou_collector_secret')),
    body:='{}'::jsonb,timeout_milliseconds:=55000);
  end if;
 end $retry$;
$job$);
commit;
