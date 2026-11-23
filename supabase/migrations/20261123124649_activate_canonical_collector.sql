-- Canonical host avoids redirecting away the Authorization header.
select cron.alter_job(
 job_id := (select jobid from cron.job where jobname='baixou-collector'),
 command := replace((select command from cron.job where jobname='baixou-collector'),'https://baixou-iota.vercel.app/','https://baixouofertas.vercel.app/'),
 active := true
);
