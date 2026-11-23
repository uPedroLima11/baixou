begin;
-- Hosted validation: all four stores ran; total=7, failures=0, elapsed=9811ms, CPU=2061ms.
-- Fifteen minutes leaves CPU allowance for periodic discovery and the public app.
select cron.alter_job(job_id:=(select jobid from cron.job where jobname='baixou-collect-batch'),schedule:='*/15 * * * *',active:=true);
-- Atomic switch: the tested replacement is enabled in the SAME transaction.
select cron.alter_job(job_id:=jobid,active:=false) from cron.job
where jobname in ('baixou-collect-kabum','baixou-collect-waz','baixou-collect-guerradigital','baixou-collect-patoloco');
commit;
