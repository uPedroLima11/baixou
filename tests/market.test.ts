import {test} from 'node:test';import assert from 'node:assert/strict';
import {marketStatus,effectiveEvidence,effectiveDiscount,announcedOverstated,discountReference} from '../lib/market';
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

test('visible reference matches the actual comparison, never the inflated struck-through price',()=>{
 const o={...base,original_price:4235.28,price:1679.99,market_median:2164.625,market_lowest:2063.14,market_highest:2266.11,market_stores:2} as import('../lib/types').Offer;
 assert.equal(discountReference(o)?.amount,2164.625);
 assert.equal(discountReference({...o,market_stores:0}),null);
});
// Caso real do proprietário (23/11/2026), usado como regressão e não como cotação permanente:
// KaBuM G305 910-005281 a R$ 169,99 no Pix com "de" R$ 488,62 (65% anunciado); Amazon aparentemente a R$ 161,91
// (Amazon NÃO integrada; mesma variante/condição não confirmada).
test('G305: crossed-out R$ 488,62 is not a super deal when another store sells for ~R$ 162 or history never reached it',()=>{
 const g305={price:169.99,discount:65,evidence:'retailer' as const};
 assert.equal(effectiveDiscount(g305),65,'without independent evidence the number stays only an announced label');
 // Com uma loja comparável mais barata, o desconto efetivo vira 0 e o anúncio é marcado como exagerado.
 const cheaperElsewhere={...g305,market_median:161.91,market_lowest:161.91,market_highest:161.91,market_stores:1,market_expires_at:new Date(Date.now()+600000).toISOString()};
 assert.equal(marketStatus(cheaperElsewhere),'single');assert.equal(effectiveDiscount(cheaperElsewhere),0);assert.equal(announcedOverstated(cheaperElsewhere),true);
 // Com histórico suficiente cujo maior preço observado foi R$ 179,99, a economia real não passa de 5%.
 const observed={...g305,historical_max:179.99};
 assert.equal(effectiveDiscount(observed),5);assert.equal(announcedOverstated(observed),true);
 // O histórico não esconde quedas reais: se o maior preço observado foi R$ 400, o anúncio fica.
 assert.equal(effectiveDiscount({...g305,historical_max:488.62}),65);
});
