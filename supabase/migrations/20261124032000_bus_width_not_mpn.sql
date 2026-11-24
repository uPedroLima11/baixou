-- "128-bit"/"192-bit" (largura do barramento) virou código de fabricante em 3 anúncios e criou produtos canônicos
-- falsos (afox/gigabyte 128BIT, gigabyte 192BIT) que poderiam casar placas diferentes. Desfaz a identidade; o coletor
-- recalcula na próxima rechecagem com a regra corrigida (NOT_CODE inclui \d+BITS?).
begin;
update public.offers set product_id=null where product_id in (select id from public.catalog_products where mpn ~ '^[0-9]+BITS?$');
update public.offers set mpn=null where store in ('pichau','terabyte') and mpn ~* '^[0-9]+-?BITS?$';
delete from public.catalog_products where mpn ~ '^[0-9]+BITS?$';
commit;
