import {test} from 'node:test';import assert from 'node:assert/strict';
import {comparisonIndex,independentSeller} from '../lib/search';import type {Offer} from '../lib/types';
const base={category:'cpu',brand:'AMD',mpn:'100-100000910WOF',title:'Ryzen 7 7800X3D - 100-100000910WOF',product_id:'p1',variant:{},available:true,expires_at:new Date(Date.now()+3600000).toISOString()};
const o=(id:string,store:string,price:number,extra:Partial<Offer>={})=>({...base,id,store,price,seller:store,url:'https://x/'+id,...extra}) as Offer;
test('comparison needs >=2 independent sellers; KaBuM inside Mercado Livre is still KaBuM',()=>{
 assert.equal(independentSeller(o('a','mercadolivre',1,{seller:'KaBuM! (loja oficial no Mercado Livre)'})),'kabum');
 const own=comparisonIndex([o('k','kabum',1679.99),o('mlk','mercadolivre',1700,{seller:'KaBuM! (loja oficial no Mercado Livre)',seller_key:'mercadolivre:1'})]);
 assert.equal(own.size,0,'KaBuM site + KaBuM on ML is one seller');
 const idx=comparisonIndex([o('k','kabum',1679.99),o('g','guerradigital',2063.14),o('p','patoloco',2266.11),o('k2','kabum',1800)]);
 const rows=idx.get('g')!;assert.deepEqual(rows.map(r=>r.id),['k','g','p'],'one row per seller, cheapest first');assert.equal(idx.get('k2'),rows);
});
test('comparison never joins different variants, conflicting codes or kits',()=>{
 assert.equal(comparisonIndex([o('a','kabum',1,{variant:{total_gb:16}}),o('b','waz',2,{variant:{total_gb:32}})]).size,0);
 assert.equal(comparisonIndex([o('a','kabum',1,{product_id:'p1'}),o('b','waz',2,{product_id:'p2'})]).size,0);
 assert.equal(comparisonIndex([o('a','kabum',1,{category:'kit'}),o('b','waz',2,{category:'kit'})]).size,0);
});
