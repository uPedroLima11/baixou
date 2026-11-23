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
 assert.ok(connectors.every(c=>!c.implemented));
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
