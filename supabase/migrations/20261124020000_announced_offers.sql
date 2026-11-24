-- Ofertas anunciadas pela própria loja (canal oficial no Telegram), ainda não conferidas na página do produto.
-- 'announced' fica fora dos alertas (que exigem 'verified') e não grava histórico de preços.
begin;
alter table public.offers drop constraint if exists offers_verification_status_check;
alter table public.offers add constraint offers_verification_status_check check (verification_status = any (array['verified','failed','excluded','announced']));
update public.store_registry set status='partial',verified_at=now(),test_product_url='https://www.terabyteshop.com.br/produto/44165/placa-de-video-gainward-nvidia-geforce-rtx-5060-ghost-8gb-gddr7-dlss-ray-tracing-ne75060019p1-gb2063b',trust_policy='Parcial: preços anunciados pela própria Terabyte no canal oficial do Telegram (t.me/terabyteshopoficial, linkado em terabyteshop.com.br). Site bloqueia robôs (Cloudflare); página do produto não conferida.' where id='terabyte';
commit;
