-- iByte: duas coletas hospedadas (23/11/2026, runs 325 e 327 em collection_runs) com 84 anúncios reais,
-- vendedor próprio no JSON-LD e preço Pix conferido no DOM. Sem vendedores terceiros.
update public.store_registry set status='operational',homepage='https://www.ibyte.com.br',
 test_product_url='https://www.ibyte.com.br/ssd-kingston-2-5-480gb-a400-sata-iii-sa400s37-480g/p',verified_at=now(),
 trust_policy='Varejista próprio (VTEX); vendedor ibyte no schema e preço Pix igual no DOM. "De" igual ao total parcelado é preço de cartão e é descartado.'
where id='ibyte';
