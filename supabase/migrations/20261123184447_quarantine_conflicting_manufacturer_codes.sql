-- Códigos divergentes observados na auditoria real. Não escolher um dos códigos como verdadeiro.
-- Preserva preços, histórico e favoritos; alerta volta ao anúncio original, sem seguir modelo errado.
begin;
create temporary table conflicting_identity on commit drop as
select o.id,o.product_id from public.offers o join (values
 ('kabum-320799','100-100000651WOF','100-100000457BOX'),
 ('kabum-1053828','100-100000651WOF','100-100000651POF'),
 ('guerradigital-e7634cbfcaacf4145984','100-100000651WOF','100-100000457BOX'),
 ('kabum-1061380','20U401A-B','20U401A-B.AWZM'),
 ('kabum-1061381','22U403A-B','22U403A-B.AWZM'),
 ('kabum-1078268','ZT-B50600H-10A','ZT-B50600H-10M'),
 ('guerradigital-1392402d2677089252e0','T-TGF300R','T-TGF300-B'),
 ('kabum-907814','RX7600 CLP 8GO','RX7600')
) as expected(id,mpn,title_code) on o.id=expected.id and o.mpn=expected.mpn
where o.product_id is not null and o.title ilike '%'||expected.title_code||'%';
update public.alerts a set product_id=null from conflicting_identity c where a.offer_id=c.id and a.product_id=c.product_id;
update public.offers o set product_id=null,market_median=null,market_lowest=null,market_highest=null,
 market_stores=0,market_expires_at=null from conflicting_identity c where o.id=c.id and o.product_id=c.product_id;
select public.refresh_market_reference();
commit;
