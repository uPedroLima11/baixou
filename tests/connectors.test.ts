import {readFileSync as _r} from 'node:fs';
import {test} from 'node:test';import assert from 'node:assert/strict';
import {acceptListing} from '../lib/connectors/policy';import {connectorStatus,connectors} from '../lib/connectors/registry';import type {MarketplaceListing} from '../lib/connectors/types';import {listingToProduct} from '../lib/connectors/convert';
const base:MarketplaceListing={source:'mercadolivre',externalId:'MLB1',url:'https://www.mercadolivre.com.br/p/MLB1',title:'Placa de Vídeo RTX 4060',price:1999,originalPrice:2299,currency:'BRL',available:true,condition:'new',seller:{id:'1',name:'Loja',official:null,reputationLevel:'5_green',positiveRate:null,completedSales:null},images:[],brand:null,mpn:null,gtin:null,couponHint:null,fetchedAt:'2026-11-23T00:00:00Z'};
const opts={hosts:['www.mercadolivre.com.br'],marketplace:true};
test('marketplace listings need confirmed stock, new condition, BRL, allowed host and trusted seller',()=>{
 assert.deepEqual(acceptListing(base,opts),{ok:true});
 assert.equal(acceptListing({...base,available:null},opts).ok,false);
 assert.equal(acceptListing({...base,condition:'used'},opts).ok,false);
 assert.equal(acceptListing({...base,currency:'USD'},opts).ok,false);
 assert.equal(acceptListing({...base,url:'https://evil.example/p'},opts).ok,false);
 assert.equal(acceptListing({...base,price:0},opts).ok,false);
 const unknown={...base,seller:{...base.seller,reputationLevel:null}};
 assert.equal(acceptListing(unknown,opts).ok,false);
 assert.equal(acceptListing({...unknown,seller:{...unknown.seller,positiveRate:0.98,completedSales:500}},opts).ok,true);
 assert.equal(acceptListing({...unknown,seller:{...unknown.seller,positiveRate:0.98,completedSales:20}},opts).ok,false);
 assert.equal(acceptListing({...unknown,seller:{...unknown.seller,official:true}},opts).ok,true);
});
test('no connector runs before implementation and credentials',()=>{
 assert.ok(connectors.filter(c=>c.requiredEnv.length).every(c=>!c.implemented));
 const status=connectorStatus({MERCADOLIVRE_CLIENT_ID:'x',MERCADOLIVRE_CLIENT_SECRET:'y'});
 const ml=status.find(s=>s.id==='mercadolivre')!;assert.equal(ml.configured,true);assert.equal(ml.runnable,false);
 assert.deepEqual(status.find(s=>s.id==='shopee')!.missing,['SHOPEE_AFFILIATE_APP_ID','SHOPEE_AFFILIATE_SECRET']);
});
test('approved listing converts to the existing offer shape without inventing data',()=>{
 const p=listingToProduct({...base,couponHint:'BAIXOU10'},'Mercado Livre');
 assert.equal(p.store,'mercadolivre');assert.equal(p.category,'gpu');assert.equal(p.original_price,2299);assert.equal(p.available,true);
 assert.equal(p.sold,null);assert.equal(p.rating,null);assert.match(p.specs['Cupom informado pela API (não validado)'],/BAIXOU10/);
 assert.equal(listingToProduct({...base,originalPrice:1500},'Mercado Livre').original_price,null);
 assert.equal(listingToProduct(base,'X').id,listingToProduct(base,'X').id);
});
import {parseOfficialStorefront,brlFromAria} from '../lib/connectors/mercadolivre-stores';const readFileSync=_r;
test('Mercado Livre official storefront: real Pichau cards become policy-approved listings',()=>{
 const html=readFileSync(new URL('./fixtures/expansion/mercadolivre-loja-pichau.html',import.meta.url),'utf8');
 const l=parseOfficialStorefront(html,{slug:'pichau',name:'Pichau',brand:null},'2026-11-23T17:00:00Z');
 assert.equal(l.length,3);const first=l[0];
 assert.equal(first.price,562.97);assert.equal(first.originalPrice,705.86);assert.equal(first.currency,'BRL');assert.equal(first.seller.official,true);assert.equal(first.seller.id,'304410345');
 assert.match(first.url,/^https:\/\/www\.mercadolivre\.com\.br\/[^?]+\/p\/MLB\d+\?pdp_filters=item_id%3AMLB\d+$/);assert.match(first.externalId,/^MLB\d+$/);assert.match(first.images[0],/^https:\/\/http2\.mlstatic\.com\//);
 for(const x of l)assert.deepEqual(acceptListing(x,{hosts:['www.mercadolivre.com.br','produto.mercadolivre.com.br'],marketplace:true}),{ok:true});
 assert.throws(()=>parseOfficialStorefront('<html></html>',{slug:'x',name:'X',brand:null}),/loja oficial/);
 assert.equal(brlFromAria('Agora: 3105 reais'),3105);assert.equal(brlFromAria('Antes: 1.234 reais com 5 centavos'),1234.05);assert.equal(brlFromAria('grátis'),null);
});
test('retailer storefront brand only when exactly one known manufacturer is in the title',async()=>{
 const {brandFromTitle}=await import('../lib/connectors/mercadolivre-stores');
 assert.equal(brandFromTitle('Cadeira Gamer Tgt Heron Tc2, Preto, Tgt-hrtc-bl03'),'TGT');
 assert.equal(brandFromTitle('Headset Gamer Mancer Twilight S, Rainbow'),'Mancer');
 assert.equal(brandFromTitle('Placa Mãe MSI A520M-A PRO + Processador AMD Ryzen 5 5500F'),null);
 assert.equal(brandFromTitle('PC Gamer Completo MCL, Intel i5, GT 730 4GB'),null);assert.equal(brandFromTitle('Notebook Lenovo IdeaPad Slim 3, Intel Core i5'),'Lenovo');assert.equal(brandFromTitle('Processador AMD Ryzen 5 5600'),'AMD');
 assert.equal(brandFromTitle('Gabinete Gamer Aquário'),null);
});
test('vitrines oficiais do ML entram em rodízio: todas são visitadas em janelas sucessivas', async () => {
  const {rotateStores, ML_OFFICIAL_STORES} = await import('../lib/connectors/mercadolivre-stores');
  const slot = 15 * 60000, seen = new Set<string>();
  for (let i = 0; i < Math.ceil(ML_OFFICIAL_STORES.length / 3); i++) for (const s of rotateStores(ML_OFFICIAL_STORES, i * slot).slice(0, 3)) seen.add(s.slug);
  assert.equal(seen.size, ML_OFFICIAL_STORES.length);
  assert.equal(rotateStores(ML_OFFICIAL_STORES, 0).length, ML_OFFICIAL_STORES.length);
});
