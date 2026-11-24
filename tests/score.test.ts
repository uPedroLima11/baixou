import {test} from 'node:test';import assert from 'node:assert/strict';
import {baixouScore} from '../lib/score';
const live=new Date(Date.now()+3600000).toISOString(),mexp=new Date(Date.now()+600000).toISOString();
const base={price:800,available:true,expires_at:live,evidence:'none',discount:0,original_price:null,store:'kabum',verification_status:'verified'} as any;
const hist=(median:number,samples=12,days=8,min:number|null=null)=>({reference_median:median,reference_samples:samples,reference_days:days,reference_min:min});
const mkt=(median:number,stores=3,lowest=median*0.98,highest=median*1.1)=>({market_median:median,market_stores:stores,market_lowest:lowest,market_highest:highest,market_expires_at:mexp});

test('habitual 1000 → now 800 is an opportunity backed by history',()=>{
 const b=baixouScore({...base,...hist(1000)});assert.equal(b.klass,'exceptional');assert.equal(b.score,100);assert.equal(b.confidence,'alta');
 assert.match(b.reasons[0],/20% abaixo do preço habitual observado \(8 dias\)/);
});
test('announced "from 2000 to 999" with habitual ~1000 is just normal; struck price never scores',()=>{
 const b=baixouScore({...base,price:999,original_price:2000,evidence:'retailer',discount:50,...hist(1000)});
 assert.equal(b.klass,'normal');assert.equal(b.score,50);assert.ok(b.reasons.some(r=>/anunciado pela loja: 50% \(não usado na nota\)/.test(r)));
 const only=baixouScore({...base,price:999,original_price:2000,evidence:'retailer',discount:50});
 assert.equal(only.klass,'insufficient');assert.equal(only.score,null);assert.match(only.reasons[0],/Desconto anunciado pela loja \(50%\), ainda não comprovado/);
});
test('insufficient history (few samples/days) and single competitor give no score',()=>{
 assert.equal(baixouScore({...base,...hist(1000,4,8)}).klass,'insufficient');
 assert.equal(baixouScore({...base,...hist(1000,12,2)}).klass,'insufficient');
 assert.equal(baixouScore({...base,...mkt(1000,1)}).klass,'insufficient');
});
test('bands: normal within ±3%, competitive 3–8%, good 8–15%, above at −5%',()=>{
 const k=(price:number)=>baixouScore({...base,price,...hist(1000)}).klass;
 assert.equal(k(980),'normal');assert.equal(k(1020),'normal');assert.equal(k(960),'competitive');assert.equal(k(900),'good');assert.equal(k(1060),'above');
});
test('exceptional needs high confidence; cheaper competitor caps at competitive; dispersed market ignored',()=>{
 assert.equal(baixouScore({...base,price:800,...hist(1000,6,4)}).klass,'good');// confiança média
 assert.equal(baixouScore({...base,price:800,...mkt(1000,2,750,1100)}).klass,'competitive');// outra loja a 750
 assert.equal(baixouScore({...base,price:800,...mkt(1000,3,600,1000)}).klass,'insufficient');// 1000/600 > 1,5
});
test('history and market together: the smaller saving wins (conservative)',()=>{
 const b=baixouScore({...base,price:900,...hist(1000),...mkt(950,3,940,1000)});
 assert.ok(Math.abs(b.saving!-(1-900/950))<1e-9);assert.equal(b.klass,'competitive');
});
test('announced (Telegram) and expired offers are never scored; lowest-ever reason only with real minimum',()=>{
 assert.equal(baixouScore({...base,verification_status:'announced',...hist(1000)}).klass,'insufficient');
 assert.equal(baixouScore({...base,expires_at:new Date(Date.now()-1000).toISOString(),...hist(1000)}).klass,'insufficient');
 assert.ok(baixouScore({...base,price:780,...hist(1000,12,8,800)}).reasons.some(r=>/Menor preço registrado nos últimos 8 dias/.test(r)));
 assert.ok(!baixouScore({...base,price:820,...hist(1000,12,8,800)}).reasons.some(r=>/Menor preço/.test(r)));
});
