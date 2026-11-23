-- Dedicated project only; real offers, no fabricated prices/products, no persisted test changes.
begin;
select public.refresh_market_reference();
do $$ begin
 if public.market_seller('mercadolivre','KaBuM! (loja oficial no Mercado Livre)','mercadolivre:1')<>'kabum'
 or public.market_seller('mercadolivre','Pichau (loja oficial no Mercado Livre)','mercadolivre:2')<>'pichau'
 then raise exception 'Retailer counted twice'; end if;
 if has_function_privilege('anon','public.refresh_market_reference()','execute')
 or has_function_privilege('authenticated','public.market_seller(text,text,text)','execute')
 then raise exception 'Private reference functions exposed'; end if;
 if not exists(select 1 from pg_class where oid='public.catalog_offers'::regclass and 'security_invoker=true'=any(reloptions))
 then raise exception 'Catalog view bypasses RLS'; end if;
 if exists(select 1 from public.offers where market_stores>0 and
  (market_expires_at is null or market_expires_at>market_checked_at+interval '15 minutes' or market_lowest>market_median or market_median>market_highest))
 then raise exception 'Invalid reference bounds or freshness'; end if;
 if exists(select 1 from public.offers o join public.catalog_products c on c.id=o.product_id
  where o.market_stores>0 and regexp_replace(upper(o.mpn),'[^A-Z0-9]','','g')<>c.mpn and (o.gtin is null or o.gtin is distinct from c.gtin))
 then raise exception 'Conflicting manufacturer code used'; end if;
end $$;
select 'real_reference_checks_passed' as result;
rollback;
