-- Listagem pública sem a descrição longa do fabricante (≈43% do payload do catálogo).
-- O detalhe do produto continua lendo public.offers completo via /api/product.
-- security_invoker: a RLS de public.offers continua valendo para anon/authenticated.
create or replace view public.catalog_offers with (security_invoker = true) as
select id, store, url, title, category, brand, mpn, image, images, price, original_price, available,
       seller, sold, rating, review_count, (specs - 'Descrição do fabricante') as specs,
       checked_at, expires_at, historical_median, historical_samples, historical_days, discount,
       evidence, discoveries, coupon_hint, coupon_validated, payment_note, product_id, gtin, variant,
       last_attempt_at, verification_status
from public.offers;

revoke all on public.catalog_offers from public;
grant select on public.catalog_offers to anon, authenticated, service_role;
