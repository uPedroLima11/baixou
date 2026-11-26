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
 assert.equal(baixouScore({...base,price:800,...hist(1000,6,7)}).klass,'good');// confiança média (6 verificações)
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
 assert.ok(baixouScore({...base,price:780,...hist(1000,12,8,800)}).reasons.some(r=>/Abaixo do menor preço diário registrado nos últimos 8 dias/.test(r)));
 assert.ok(!baixouScore({...base,price:820,...hist(1000,12,8,800)}).reasons.some(r=>/menor preço/.test(r)));
 assert.ok(!baixouScore({...base,price:800,...hist(800,12,8,800)}).reasons.some(r=>/menor preço/.test(r)),"preço constante não é recorde");
});
test('score number always sits inside its class band (no 100 labelled "boa")',()=>{
 const good=baixouScore({...base,price:800,...hist(1000,6,7)});assert.equal(good.klass,'good');assert.equal(good.score,87);
 const comp=baixouScore({...base,price:800,...mkt(1000,2,750,1100)});assert.equal(comp.klass,'competitive');assert.equal(comp.score,69);
 for(let p=700;p<=1200;p+=5){const b=baixouScore({...base,price:p,...hist(1000)});const band={exceptional:[88,100],good:[70,87],competitive:[58,69],normal:[38,57],above:[0,37]}[b.klass as 'good'];assert.ok(b.score!>=band[0]&&b.score!<=band[1],p+' '+b.klass+' '+b.score);}
});

const grp=(median:number,offers=20)=>({group:{key:'gpu|RTX 5060|8',label:'RTX 5060 · 8 GB',median,lowest:median*0.8,offers,sellers:4}});
test('short own history alone caps at competitive unless equivalent alternatives confirm the price',()=>{
 const short=baixouScore({...base,price:800,...hist(1000,12,4)});assert.equal(short.klass,'competitive');assert.ok(short.reasons.some(r=>/só 4 dias de histórico/.test(r)));
 assert.equal(baixouScore({...base,price:800,...hist(1000,12,4),...grp(820)}).klass,'good');// alternativas a ~R$ 820: preço confirmado
});
test('equivalent alternatives: >=10% above their median caps at normal, even with a big own drop',()=>{
 // Regressão RTX 5060 EAGLE MAX (KaBuM, 26/11/2026): R$ 4.199,99 depois de R$ 6.678,23; 20 RTX 5060 8 GB com mediana ~R$ 3.600.
 const rtxOld=baixouScore({...base,price:4199.99,...hist(6678.23,34,8),...grp(3599.99)});
 assert.equal(rtxOld.klass,'normal');assert.ok(rtxOld.reasons.some(r=>/acima da mediana de 20 alternativas equivalentes \(RTX 5060 · 8 GB\)/.test(r)));
 // Com a referência diária corrigida (mediana dos menores preços diários = R$ 4.199,99) não há queda alguma.
 const rtxNow=baixouScore({...base,price:4199.99,...hist(4199.99,40,3),...grp(3599.99)});assert.ok(['normal','above'].includes(rtxNow.klass));
 assert.equal(baixouScore({...base,price:800,...hist(1000),...grp(950)}).klass,'exceptional');// abaixo das alternativas: sem freio
});
test('store consistently below other stores is an opportunity; a recent own price rise still caps it',()=>{
 // Ryzen 5 5500 (26/11): preço igual ao habitual da própria loja e 23% abaixo da mediana de 4 outras lojas.
 const steady=baixouScore({...base,price:770,...hist(770,40,3),...mkt(1000,4,960,1050)});assert.equal(steady.klass,'exceptional');
 const risen=baixouScore({...base,price:880,...hist(800,40,8),...mkt(1000,4,960,1050)});assert.equal(risen.klass,'above');// 10% acima do habitual
});
