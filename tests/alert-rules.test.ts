import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesAlert} from '../lib/alert-rules';
import type {Alert,Offer} from '../lib/types';
const now=Date.now();
const o={id:'test',category:'ram',title:'Memória 2x16GB DDR5 6000MHz',brand:'Kingston',specs:{},price:900,available:true,expires_at:new Date(now+60000).toISOString(),historical_median:1100,historical_samples:5,historical_days:3} as Offer;
const rule={enabled:true,category:'ram',offer_id:null,max_price:null,min_discount:null} as Alert;
test('absolute drop works without maximum price',()=>{assert.ok(matchesAlert({...rule,min_drop_amount:200},o,now));assert.equal(matchesAlert({...rule,min_drop_amount:201},o,now),false);});
test('all supplied conditions must match independently',()=>{assert.equal(matchesAlert({...rule,max_price:800,min_drop_amount:200},o,now),false);assert.ok(matchesAlert({...rule,max_price:900,min_drop_amount:200,min_discount:18},o,now));assert.equal(matchesAlert({...rule,min_discount:20},o,now),false);});
test('retailer crossed price never proves historical drops',()=>{const unknown={...o,original_price:5000,historical_median:null};assert.equal(matchesAlert({...rule,min_drop_amount:1},unknown,now),false);assert.equal(matchesAlert({...rule,min_discount:1},unknown,now),false);assert.ok(matchesAlert({...rule,max_price:900},unknown,now));assert.equal(matchesAlert({...rule,min_drop_amount:1},{...o,historical_days:2},now),false);});
test('brand and specs distinguish kit capacity frequency and generation',()=>{assert.ok(matchesAlert({...rule,max_price:950,brands:['Kingston Technology'],spec_filters:{ddr:5,total_gb:32,modules:2,frequency:6000}},o,now));for(const filter of [{ddr:4},{modules:1},{total_gb:16},{frequency:3200},{unknown:'value'}] as Record<string,string|number>[])assert.equal(matchesAlert({...rule,max_price:950,spec_filters:filter},o,now),false);});
test('inactive expired disabled and empty alerts never fire',()=>{assert.equal(matchesAlert(rule,o,now),false);assert.equal(matchesAlert({...rule,max_price:950},{...o,available:false},now),false);assert.equal(matchesAlert({...rule,max_price:950},o,now+120000),false);assert.equal(matchesAlert({...rule,enabled:false,max_price:950},o,now),false);});
test('percent drop uses the real percentage (no rounding) against the median',()=>{
 // mediana 1100, preço 900: queda 18,18…%
 assert.ok(matchesAlert({...rule,min_discount:18},o,now));
 assert.equal(matchesAlert({...rule,min_discount:19},o,now),false);
 const edge={...o,price:990,historical_median:1100} as Offer;// exatamente 10%
 assert.ok(matchesAlert({...rule,min_discount:10},edge,now));
 assert.equal(matchesAlert({...rule,min_discount:10},{...edge,price:990.01} as Offer,now),false);// 9,999%: não arredonda para 10
});
test('history conditions need >=5 observations on >=3 distinct days',()=>{
 assert.equal(matchesAlert({...rule,min_drop_amount:100},{...o,historical_samples:4} as Offer,now),false);
 assert.equal(matchesAlert({...rule,min_drop_amount:100},{...o,historical_days:2} as Offer,now),false);
 assert.ok(matchesAlert({...rule,min_drop_amount:100},o,now));
});
test('max price + absolute + percent combine with AND',()=>{
 assert.ok(matchesAlert({...rule,max_price:950,min_drop_amount:200,min_discount:18},o,now));
 assert.equal(matchesAlert({...rule,max_price:950,min_drop_amount:201,min_discount:18},o,now),false);
 assert.equal(matchesAlert({...rule,max_price:899,min_drop_amount:200,min_discount:18},o,now),false);
});
