begin;
-- Only sources with real, positive-stock offers persisted by hosted collection can be promoted.
update public.store_registry r set status='operational',verified_at=now(),
 test_product_url=(select o.url from public.offers o where o.store=r.id and o.available and o.expires_at>now() and o.price>0 order by o.checked_at desc limit 1),
 trust_policy='Varejista próprio; adaptador validado com produto real no worker hospedado. Sem vendedores terceiros.'
where r.id in ('kabum','waz','guerradigital','patoloco') and exists(select 1 from public.offers o where o.store=r.id and o.available and o.expires_at>now() and o.price>0 and o.image is not null);
update public.store_registry set status='blocked',trust_policy='Adaptador testado em HTML público atual; categorias retornaram HTTP403 no GitHub runner. Aguardar acesso/feed autorizado; sem bypass.' where id='oficinadosbits';
select cron.unschedule(jobid) from cron.job where jobname='baixou-collector';
do $$ declare store_id text; offset_min integer:=0; begin
 foreach store_id in array array['kabum','waz','guerradigital','patoloco'] loop
  perform cron.schedule('baixou-collect-'||store_id,offset_min::text||'-59/5 * * * *',format($job$
   select net.http_post(url:='https://baixouofertas.vercel.app/api/jobs/collect?store=%s',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='baixou_collector_secret')),
    body:='{}'::jsonb,timeout_milliseconds:=55000);
  $job$,store_id));
  offset_min:=offset_min+1;
 end loop;
end $$;
commit;
