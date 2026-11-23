-- "3.200MHz" (milhar com ponto, WAZ) era lido como 200 MHz na variante de RAM. Corrigido em lib/identity.ts
-- (joinThousands). Aqui só removemos a chave inválida; a próxima verificação grava o valor correto e
-- resolve_catalog_product volta a mesclar a variante (variant || p_variant). Nada mais é alterado.
update public.catalog_products
   set variant = variant - 'frequency'
 where (variant->>'frequency') ~ '^[0-9]+$' and (variant->>'frequency')::int < 1000;
update public.offers
   set variant = variant - 'frequency'
 where (variant->>'frequency') ~ '^[0-9]+$' and (variant->>'frequency')::int < 1000;
