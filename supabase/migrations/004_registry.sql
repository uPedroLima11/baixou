begin;
create table public.store_registry(id text primary key,name text not null,homepage text,status text not null default 'pending' check(status in ('operational','partial','blocked','pending')),marketplace boolean not null default false,test_product_url text,verified_at timestamptz,trust_policy text not null default 'Requer teste real de preço, estoque e identidade do vendedor antes de ativar.');
alter table public.store_registry enable row level security;
create policy public_registry on public.store_registry for select to anon,authenticated using(true);
grant select on public.store_registry to anon,authenticated;grant all on public.store_registry to service_role;
insert into public.store_registry(id,name,homepage,status,test_product_url,verified_at,trust_policy) values
('kabum','KaBuM!','https://www.kabum.com.br','operational','https://www.kabum.com.br/produto/172365/memoria-ram-kingston-fury-beast-8gb-3200mhz-ddr4-cl16-preto-kf432c16bb-8',now(),'Somente venda própria: sellerId 0, sellerName KaBuM!, flags marketplace false; detalhe com preço e estoque; unidades vendidas não estimadas.'),
('terabyte','Terabyte','https://www.terabyteshop.com.br','blocked',null,now(),'HTTP403 no teste. Não contornar.'),
('pichau','Pichau','https://www.pichau.com.br','blocked',null,now(),'HTTP403 no detalhe. Não contornar.');
insert into public.store_registry(id,name,marketplace) values
('gigantec','Gigantec',false),('waz','WAZ',false),('oficinadosbits','Oficina dos Bits',false),('guerradigital','Guerra Digital',false),('patoloco','Patoloco',false),('fgtec','FGTEC',false),('ibyte','iByte',false),('nagem','Nagem',false),('hardstore','Hardstore',false),('chipart','ChipArt',false),('shopinfo','Shopinfo',false),
('amazon','Amazon Brasil',true),('mercadolivre','Mercado Livre',true),('shopee','Shopee',true),('aliexpress','AliExpress',true),('magalu','Magazine Luiza',true),('casasbahia','Casas Bahia',true),('ponto','Ponto',true),('extra','Extra',true),('americanas','Americanas',true),('carrefour','Carrefour',true),('fastshop','Fast Shop',true),('kalunga','Kalunga',false),('havan','Havan',false),
('dell','Dell',false),('lenovo','Lenovo',false),('acer','Acer',false),('asus','ASUS',false),('samsung','Samsung',false),('lg','LG',false),('motorola','Motorola',false),('hp','HP',false),('avell','Avell',false),('logitech','Logitech',false),('jbl','JBL',false),('edifier','Edifier',false),('redragon','Redragon',false);
alter table public.offers drop constraint if exists offers_store_check;
alter table public.offers add constraint offers_store_registry_fkey foreign key(store) references public.store_registry(id);
commit;
