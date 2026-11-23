import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {parseMerchantFeed} from '../lib/connectors/merchant-feed';import {acceptListing} from '../lib/connectors/policy';import {connectors} from '../lib/connectors/registry';
const xml=readFileSync(new URL('./fixtures/feeds/merchant.xml',import.meta.url),'utf8'),now=Date.parse('2026-11-23T20:00:00Z');
test('Merchant feed: active sale price is the price, list price only an announced reference; nothing inferred',()=>{
 const [a,b,c,...rest]=parseMerchantFeed(xml,{source:'terabyte',sellerName:'TerabyteShop',now});
 assert.equal(rest.length,0,'item without link is skipped');
 assert.equal(a.price,1999.9);assert.equal(a.originalPrice,2499.9);assert.equal(a.currency,'BRL');assert.equal(a.available,true);assert.equal(a.mpn,'100-100000910WOF');assert.equal(a.gtin,'0730143314930');assert.equal(a.paymentBasis,null,'feed price is never assumed Pix');
 assert.equal(b.price,100);assert.equal(b.available,false);
 assert.equal(c.price,100,'expired sale window is ignored');assert.equal(c.available,null,'preorder is not confirmed stock');assert.equal(c.gtin,null,'invalid GTIN dropped');
 assert.equal(acceptListing(a,{hosts:['www.terabyteshop.com.br'],marketplace:false}).ok,true);
 assert.equal(acceptListing(c,{hosts:['www.terabyteshop.com.br'],marketplace:false}).ok,false);
 assert.equal(acceptListing(a,{hosts:['www.pichau.com.br'],marketplace:false}).ok,false);
});
test('Terabyte/Pichau feed connectors stay disabled until an authorized hosted test',()=>{
 for(const id of ['terabyte-feed','pichau-feed']){const c=connectors.find(x=>x.id===id)!;assert.equal(c.implemented,false);}
});
