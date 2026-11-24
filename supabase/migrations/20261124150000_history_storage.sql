-- Armazenamento do histórico bruto (medido em 24/11/2026): ~2.900 verificações/hora com ~3.300 anúncios ativos
-- (~69 mil linhas/dia, ~260 B/linha com índices) → 35 dias ≈ 630 MB, acima dos 500 MB do plano gratuito.
-- 1) history_lookup (offer_id, observed_at desc) é redundante: as consultas por anúncio usam o índice único
--    (offer_id, bucket); a limpeza por data passa a usar BRIN em observed_at (inserção cronológica, poucos KB).
-- 2) Retenção do bruto passa de 35 para 21 dias (lib/collector.ts). O resumo diário (price_daily, 400 dias) guarda
--    mín./máx./fechamento/amostras de cada dia; o preço habitual passa a usar até 21 dias de verificações.
begin;
drop index if exists public.history_lookup;
create index if not exists price_history_observed_brin on public.price_history using brin(observed_at);
commit;
