-- Rotina automática de alertas a cada minuto (independe do GitHub): decide alertas sobre ofertas verificadas nos
-- últimos 3 min, envia e-mail e executa o ciclo do WhatsApp (conecta só com fila, código pendente ou ≥15 min ocioso).
-- Mesmo segredo do Vault já usado pela coleta (baixou_collector_secret). Desligar: cron.unschedule('baixou-alerts').
select cron.schedule('baixou-alerts','* * * * *',$cmd$
 select net.http_post(url:='https://baixouofertas.vercel.app/api/jobs/alerts',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='baixou_collector_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=58000);
$cmd$);
