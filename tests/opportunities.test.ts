import {test} from 'node:test';import assert from 'node:assert/strict';
import {compareOpportunities} from '../lib/opportunities';import {catalogSelection} from '../lib/catalog-selection';
import {departmentOptions} from '../lib/departments';import {sameProduct} from '../lib/search';import type {Offer} from '../lib/types';
const base={id:'base',title:'Memória Corsair DDR5 16GB 6000MHz',category:'ram',brand:'Corsair',price:500,discount:0,evidence:'none',available:true,checked_at:'2026-11-23T18:00:00Z',expires_at:'2099-01-01',specs:{},variant:{},historical_days:0,historical_samples:0} as Offer;
test('announced 90% does not outrank historical evidence; low absolute price does not boost ranking',()=>{
 const announced={...base,id:'announced',price:30,discount:90,evidence:'retailer' as const};
 const proven={...base,id:'proven',discount:10,evidence:'history' as const,historical_median:600,historical_days:3,historical_samples:8};
 assert.equal([announced,proven].sort(compareOpportunities)[0].id,'proven');
});
test('general catalog keeps valid products without discounts, departments reuse nonempty technical facets',()=>{
 const rows=[base,{...base,id:'expired',expires_at:'2020-01-01',title:'Memória DDR4 8GB'}];
 const f={verified:false,minDiscount:5,query:''};
 assert.equal(catalogSelection(rows,f).length,0);assert.equal(catalogSelection(rows,{...f,allProducts:true}).length,1);
 const d=departmentOptions(rows);assert.equal(d.length,1);assert.equal(d[0].count,1);
 assert.deepEqual(d[0].facets.find(f=>f.key==='ddr')?.options.map(o=>o.value),['5']);
});
test('legacy canonical link never joins conflicting manufacturer codes or kits',()=>{
 assert.equal(sameProduct({...base,product_id:'same',mpn:'90-GA62ZZ-00UANF'},{...base,product_id:'same',mpn:'RX7600 CLP 8GO'}),false);
 assert.equal(sameProduct({...base,category:'kit',mpn:'CPU1'},{...base,category:'kit',mpn:'CPU1'}),false);
});
