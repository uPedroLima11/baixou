import {test} from 'node:test';
import {readFileSync} from 'node:fs';import {parseKabumListing} from '../lib/kabum-listing';
import assert from 'node:assert/strict';
import {cardTerms,installmentRows,NO_CARD,offerForPayment,cardReferenceFields} from '../lib/payment';
import {matchesAlert} from '../lib/alert-rules';
import {notificationReason,selectNotifications} from '../lib/notifications';
import {buildWhatsAppMessage} from '../lib/whatsapp';
import {baixouScore} from '../lib/score';
import type {Alert,Offer} from '../lib/types';

const now=Date.now(),site='https://baixouofertas.vercel.app';
// Exemplo real (Terabyte, Synex DDR4 16 GB 3200 MHz): Pix 729,99; cartão 858,81 em 12× de 71,57 sem juros; "de" 1.159,90.
const synex={id:'kabum-1',store:'kabum',url:'https://www.kabum.com.br/produto/1/memoria-synex-16gb',title:'Memória RAM Synex, 16GB, 3200MHz, DDR4, Desktop - SNX3200D4/16',category:'ram',brand:'Synex',mpn:'SNX3200D4/16',image:null,images:[],price:729.99,original_price:1159.9,available:true,seller:'KaBuM!',sold:null,rating:null,review_count:null,specs:{Formato:'UDIMM (desktop)'},checked_at:new Date(now-60000).toISOString(),expires_at:new Date(now+3600000).toISOString(),historical_median:null,historical_samples:0,historical_days:0,discount:37,evidence:'retailer',verification_status:'verified',
 card_price:858.81,card_installments:12,card_installment_value:71.57,card_interest_free:true} as unknown as Offer;
const ramAlert=(max:number,payment?:'pix'|'card')=>({category:'ram',offer_id:null,product_id:null,max_price:max,min_discount:null,min_drop_amount:null,enabled:true,brands:[],spec_filters:{ddr:['4'],total_gb:['16']},...(payment?{payment}:{})}) as unknown as Alert;
const profile={global_max_price:null,wishlist_email_enabled:true,wishlist_ignore_alert_limits:false};

test('parcelas: lê tabelas reais e só aceita totais coerentes',()=>{
 assert.deepEqual(installmentRows('12 x de R$366,58 sem juros R$4.399,00').map(r=>[r.n,r.value,r.interestFree,r.total]),[[12,366.58,true,4399]]);
 assert.deepEqual(installmentRows('4&times; R$ 760,06 sem juros 12&times; R$ 253,35 sem juros').map(r=>r.n),[4,12]);
 assert.deepEqual(installmentRows('10 x R$ 558,98 s/ juros')[0].interestFree,true);
 // KaBuM: total explícito + 10× sem juros
 assert.deepEqual(cardTerms({pix:4751.38,total:5589.86,rows:[{n:10,value:558.98,interestFree:true,total:null}]}),{card_price:5589.86,card_installments:10,card_installment_value:558.98,card_interest_free:true});
 // Patoloco: sem total explícito, parcelas sem juros coerentes entre si → 12 × 253,35
 assert.equal(cardTerms({pix:2584.19,rows:installmentRows('4× R$ 760,06 sem juros 5× R$ 608,04 sem juros 12× R$ 253,35 sem juros')}).card_price,3040.2);
 // Tabela incoerente (parcelas de outros produtos na vitrine) → não informado
 assert.deepEqual(cardTerms({pix:100,rows:installmentRows('10x de R$ 12,00 sem juros 12x de R$ 99,00 sem juros')}),NO_CARD);
 // Total menor que o Pix ou absurdo → não informado; parcelas com juros sem total → não informado
 assert.deepEqual(cardTerms({pix:500,total:400}),NO_CARD);
 assert.deepEqual(cardTerms({pix:500,rows:[{n:12,value:60,interestFree:false,total:null}]}),NO_CARD);
});

test('projeção: cartão usa só dados do cartão; sem cartão não existe; Pix intacto',()=>{
 assert.equal(offerForPayment(synex,'pix'),synex);
 const c=offerForPayment(synex,'card')!;assert.equal(c.price,858.81);assert.equal(c.pix_price,729.99);assert.equal(c.payment_basis,'card');
 assert.equal(c.historical_median,null,'sem histórico do cartão ainda: nada estimado');
 assert.equal(offerForPayment({...synex,card_price:null} as Offer,'card'),null);
 assert.equal(offerForPayment(c,'pix'),null,'oferta projetada no cartão nunca vira Pix');
 assert.deepEqual(cardReferenceFields(null,{max:1,ref_median:1,ref_samples:9,ref_days:9,ref_min:1,ref_max:1}).card_reference_median,null);
});

test('alerta no cartão: Pix 729,99 / cartão 858,81 NÃO dispara até R$ 850; dispara a 849,99',()=>{
 assert.equal(matchesAlert(ramAlert(850,'card'),synex,now),false);
 assert.equal(matchesAlert(ramAlert(850,'card'),{...synex,card_price:849.99,card_installment_value:70.83} as Offer,now),true);
 assert.equal(matchesAlert(ramAlert(850,'pix'),synex,now),true,'mesmo alerta no Pix dispara pelo Pix');
 assert.equal(matchesAlert(ramAlert(850),synex,now),true,'alerta existente sem modalidade continua Pix');
 assert.equal(matchesAlert(ramAlert(900,'card'),{...synex,card_price:null} as Offer,now),false,'sem total no cartão não dispara');
 const r=notificationReason(synex,profile,[ramAlert(850,'card')],[],now);assert.equal(r,null);
 const ok=notificationReason({...synex,card_price:849.99} as Offer,profile,[ramAlert(850,'card')],[],now)!;assert.equal(ok.payment,'card');assert.match(ok.conditions.join(' '),/cartão de crédito/);
});

test('queda no cartão usa o habitual do cartão, nunca o do Pix',()=>{
 const drop={...ramAlert(0,'card'),max_price:null,min_drop_amount:50} as Alert;
 const pixHistory={...synex,reference_median:900,reference_samples:8,reference_days:4,historical_median:900,historical_samples:8,historical_days:4,evidence:'history'} as Offer;
 assert.equal(matchesAlert(drop,pixHistory,now),false,'histórico só do Pix não serve ao cartão');
 const cardHistory={...pixHistory,card_reference_median:950,card_reference_samples:8,card_reference_days:4} as Offer;
 assert.equal(matchesAlert(drop,cardHistory,now),true,'950 − 858,81 ≥ 50 no cartão');
 assert.equal(matchesAlert({...drop,min_drop_amount:100} as Alert,cardHistory,now),false);
});

test('favoritos e limite geral na forma de pagamento preferida',()=>{
 const saved=[{offer_id:synex.id,offers:{product_id:null}}];
 const fav={...synex,card_reference_median:1000,card_reference_samples:8,card_reference_days:4} as Offer;
 assert.equal(notificationReason(fav,{...profile,payment_preference:'card'},[],saved,now)?.payment,'card');
 assert.equal(notificationReason(fav,{...profile,payment_preference:'pix'},[],saved,now),null,'no Pix não há queda comprovada');
 assert.equal(notificationReason(synex,{...profile,global_max_price:800},[ramAlert(900,'card')],[],now),null,'limite geral vale para o total no cartão');
});

test('Score e mensagem no cartão: sem habitual do cartão, nenhuma nota inventada; mensagem mostra parcelas',()=>{
 const c=offerForPayment(synex,'card')!;assert.equal(baixouScore(c,now).score,null);
 const msg=buildWhatsAppMessage({offer:c,reason:{kind:'price',summary:'',conditions:[],short:'Seu alerta (Memória RAM, cartão): até R$ 900,00.',payment:'card'},siteUrl:site});
 assert.match(msg,/💳 R\$\s858,81 no cartão \(12× de R\$\s71,57 sem juros\)/);assert.ok(!msg.includes('729,99')&&!msg.includes('1.159,90'));
});

test('loja escolhida pela modalidade do alerta: A Pix 699/cartão 899, B Pix 749/cartão 799, alerta cartão ≤ 850 → B',()=>{
 const A={...synex,id:'a',store:'kabum',product_id:'p1',price:699,card_price:899,card_installment_value:89.9,card_installments:10} as Offer;
 const B={...synex,id:'b',store:'waz',url:'https://www.waz.com.br/x/p',product_id:'p1',price:749,card_price:799,card_installment_value:79.9,card_installments:10} as Offer;
 const decide=(rules:Alert[],prof=profile)=>(o:Offer,only:'pix'|'card')=>notificationReason(o,prof,rules,[],now,only);
 const card=selectNotifications([A,B],decide([ramAlert(850,'card')]));
 assert.deepEqual(card.map(c=>[c.o.id,c.payment,c.po.price,c.key]),[['b','card',799,'product:p1:card']]);
 // Mesmo quando as duas lojas casam no cartão, vence o menor TOTAL NO CARTÃO (não o menor Pix).
 const both=selectNotifications([A,B],decide([ramAlert(950,'card')]));assert.deepEqual(both.map(c=>c.o.id),['b']);
 // Alerta Pix e alerta cartão do mesmo produto: cada modalidade escolhe a sua loja, com chaves de deduplicação separadas.
 const two=selectNotifications([A,B],decide([ramAlert(750,'pix'),ramAlert(850,'card')]));
 assert.deepEqual(two.map(c=>[c.o.id,c.payment,c.key]).sort(),[['a','pix','product:p1'],['b','card','product:p1:card']]);
 // Favoritos com preferência cartão: menor total no cartão com queda comprovada no cartão.
 const favA={...A,card_reference_median:1000,card_reference_samples:8,card_reference_days:4} as Offer,favB={...B,card_reference_median:1000,card_reference_samples:8,card_reference_days:4} as Offer;
 const fav=selectNotifications([favA,favB],(o,only)=>notificationReason(o,{...profile,payment_preference:'card'},[],[{offer_id:'a',offers:{product_id:'p1'}}],now,only));
 assert.deepEqual(fav.map(c=>[c.o.id,c.payment]),[['b','card']]);
});

test('listagem KaBuM: campanha vigente, cartão e parcelas da listagem; marketplace e open box fora',()=>{
 const html=readFileSync('tests/fixtures/kabum-listing-trimmed.html','utf8');
 const l=parseKabumListing(html,1795800000);assert.equal(l.totalPages,17);assert.equal(l.total,1650);
 const byId=Object.fromEntries(l.items.map(i=>[i.code,i]));
 assert.equal(byId[922165].pix,669.99);assert.equal(byId[922165].card.card_price,788.22);assert.equal(byId[922165].card.card_installments,10);assert.equal(byId[922165].card.card_interest_free,true);assert.equal(byId[922165].excluded,null);
 assert.equal(byId[172365].pix,649.99);assert.equal(byId[172365].card.card_price,649.99);
 assert.equal(l.items.filter(i=>i.excluded==='seller_untrusted').length,1);assert.equal(byId[999001].excluded,'condition_excluded');
 // Fora do período da campanha vale o preço normal da listagem (nunca o da campanha vencida).
 const after=parseKabumListing(html,1899999999);assert.equal(after.items.find(i=>i.code===922165)!.pix,1099.99);
});
