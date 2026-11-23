import {test} from 'node:test';import assert from 'node:assert/strict';
import {marketStatus,effectiveEvidence,effectiveDiscount,announcedOverstated} from '../lib/market';
const base={price:1300,discount:35,evidence:'retailer' as const};
test('struck-through price is not a super deal when other stores sell the same model at similar prices',()=>{
 // Exemplo do proprietário: R$ 1.300 com R$ 2.000 riscado; outras lojas a 1.300, 1.400 e 1.500 (mediana 1.400).
 const o={...base,market_median:1400,market_lowest:1300,market_stores:3};
 assert.equal(marketStatus(o),'below');
 assert.equal(effectiveEvidence(o),'market');
 assert.equal(effectiveDiscount(o),7);
 assert.equal(announcedOverstated(o),true);
 const same={...base,market_median:1300,market_lowest:1250,market_stores:3};
 assert.equal(marketStatus(same),'near');assert.equal(effectiveEvidence(same),'retailer');assert.equal(effectiveDiscount(same),0);assert.equal(announcedOverstated(same),true);
});
test('few references never produce a market conclusion, but still cap the announced discount',()=>{
 const one={...base,market_median:1500,market_lowest:1500,market_stores:1};
 assert.equal(marketStatus(one),'single');assert.equal(effectiveEvidence(one),'retailer');assert.equal(effectiveDiscount(one),13);
 const none={...base};assert.equal(marketStatus(none),'none');assert.equal(effectiveDiscount(none),35);
});
test('market decision uses the exact percentage and history keeps priority',()=>{
 assert.equal(marketStatus({...base,price:950.01,market_median:1000,market_stores:2}),'near');
 assert.equal(marketStatus({...base,price:950,market_median:1000,market_stores:2}),'below');
 const hist={price:900,discount:22,evidence:'history' as const,market_median:1000,market_stores:3};
 assert.equal(effectiveEvidence(hist),'history');assert.equal(effectiveDiscount(hist),22);
 assert.equal(effectiveEvidence({price:900,discount:0,evidence:'none' as const,market_median:1000,market_stores:3}),'market');
});

test('a median inflated by an extreme reference is not enough; references expire',()=>{
 const extreme={...base,price:900,market_median:5000,market_lowest:1000,market_highest:9000,market_stores:2};
 assert.notEqual(marketStatus(extreme),'below');
 assert.notEqual(marketStatus({...extreme,market_highest:1100,market_expires_at:'2020-01-01'}),'below');
 assert.notEqual(marketStatus({...extreme,market_highest:1100,market_expires_at:null}),'below');
 assert.notEqual(marketStatus({...base,market_median:1600,market_lowest:1200,market_stores:2}),'below');
});
