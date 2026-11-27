-- Executar isoladamente, fora de uma transação, para manter a coleta gravando.
create index concurrently if not exists offers_announced_recent
  on public.offers (checked_at desc)
  where verification_status = 'announced';
