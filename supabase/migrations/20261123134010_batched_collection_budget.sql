begin;
-- Retain per-store queues/leases, but share one Vercel invocation to reduce provisioned memory.
select cron.schedule('baixou-collect-batch','*/10 * * * *',$job$
 select net.http_post(url:='https://baixouofertas.vercel.app/api/jobs/collect?batch=1',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='baixou_collector_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=55000);
$job$);
-- Activate only after the batch endpoint has been tested with measured resource usage.
select cron.alter_job(job_id:=(select jobid from cron.job where jobname='baixou-collect-batch'),active:=false);
commit;
