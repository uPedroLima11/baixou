-- Mercado Livre: cobertura PARCIAL via vitrines públicas de lojas oficiais (sem API/OAuth).
-- Validado em 23/11/2026 no runner hospedado (run 45226618462): 329 anúncios gravados, 0 erros.
-- Não é catálogo completo do marketplace; vendedores comuns não são coletados.
update public.store_registry
   set status = 'partial', test_product_url = 'https://www.mercadolivre.com.br/kit-upgrade-gamer-amd-ryzen-5-5500-a520m-8gb-ddr4-cor-preto/p/MLB47857624?pdp_filters=item_id%3AMLB4432276321', verified_at = now()
 where id = 'mercadolivre';
