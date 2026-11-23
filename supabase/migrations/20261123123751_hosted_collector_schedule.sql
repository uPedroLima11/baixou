-- Approved dedicated collection secret. No database administration credential is stored here.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$ begin
 if not exists(select 1 from vault.secrets where name='baixou_collector_secret') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'baixou_collector_secret','Dedicated Baixou collector bearer; sync to Vercel CRON_SECRET');
 end if;
end $$;
-- Activate only after syncing CRON_SECRET and validating the production endpoint.
select cron.schedule('baixou-collector','*/5 * * * *', $job$
 select net.http_post(
  url := 'https://baixou-iota.vercel.app/api/jobs/collect',
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='baixou_collector_secret')),
  body := '{}'::jsonb, timeout_milliseconds := 55000
 );
$job$);
select cron.alter_job(job_id := (select jobid from cron.job where jobname='baixou-collector'),active := false);
