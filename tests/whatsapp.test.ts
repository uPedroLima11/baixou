import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildWhatsAppMessage,canSendCode,classifyCallMeBot,codeMatches,hashCode,maskPhone,normalizeBrazilPhone,validApiKey,whatsappAllowed,sendWhatsApp} from '../lib/whatsapp';
import {reasonForAlert,wishlistReason} from '../lib/email-templates';
import {notificationReason} from '../lib/notifications';
import type {Alert,Offer} from '../lib/types';

const site='https://baixouofertas.vercel.app',now=Date.now();
const ram={id:'kabum-172366',store:'kabum',url:'https://www.kabum.com.br/produto/172366/memoria-kingston-fury-beast',title:'Memória RAM Kingston Fury Beast, 16GB, 3200MHz, DDR4, CL16, Preto - KF432C16BB/16',category:'ram',brand:'Kingston',mpn:'KF432C16BB/16',image:null,images:[],price:799.99,original_price:1499.99,available:true,seller:'KaBuM!',sold:null,rating:null,review_count:null,specs:{},checked_at:new Date(now-60000).toISOString(),expires_at:new Date(now+3600000).toISOString(),historical_median:899.99,historical_samples:8,historical_days:4,evidence:'history',verification_status:'verified'} as unknown as Offer;
const ramAlert={category:'ram',offer_id:null,product_id:null,max_price:850,min_discount:null,min_drop_amount:null,enabled:true,brands:[],spec_filters:{ddr:['4'],total_gb:['16']}} as unknown as Alert;
const profile={global_max_price:null,wishlist_email_enabled:true,wishlist_ignore_alert_limits:false};

test('telefone: só celular/fixo brasileiro com DDD, normalizado para 55+DDD',()=>{
 assert.equal(normalizeBrazilPhone('(11) 91234-5678'),'5511912345678');
 assert.equal(normalizeBrazilPhone('+55 21 3456-7890'),'552134567890');
 assert.equal(normalizeBrazilPhone('005511912345678'),'5511912345678');
 for(const bad of ['912345678','(11) 81234-5678','(01) 91234-5678','+1 415 555 0100','abc',''])assert.equal(normalizeBrazilPhone(bad),null,bad);
 assert.equal(maskPhone('5511912345678'),'+55 (11) •••••-5678');
 assert.ok(validApiKey('123456'));assert.ok(!validApiKey('12 34'));assert.ok(!validApiKey('a&b=c'));
});

test('código de confirmação: hash por usuário, comparação exata e limite de envios',()=>{
 const h=hashCode('u1','123456');assert.ok(codeMatches('u1','123456',h));assert.ok(!codeMatches('u2','123456',h));assert.ok(!codeMatches('u1','123457',h));assert.ok(!codeMatches('u1','12345',h));assert.ok(!codeMatches('u1','123456',null));
 const t=(m:number)=>new Date(now-m*60000).toISOString();
 assert.ok(canSendCode([t(5),t(10)],now));assert.ok(!canSendCode([t(5),t(10),t(20)],now));assert.ok(canSendCode([t(70),t(80),t(90)],now));assert.ok(!canSendCode([t(70),t(80),t(90),t(200),t(300),t(400)],now));
});

test('liberação: off por padrão; test só para usuários listados; on para todos',()=>{
 const prev={m:process.env.WHATSAPP_MODE,u:process.env.WHATSAPP_TEST_USERS};
 try{delete process.env.WHATSAPP_MODE;assert.equal(whatsappAllowed('a'),false);
  process.env.WHATSAPP_MODE='test';process.env.WHATSAPP_TEST_USERS='a, b';assert.equal(whatsappAllowed('a'),true);assert.equal(whatsappAllowed('c'),false);
  process.env.WHATSAPP_MODE='on';assert.equal(whatsappAllowed('c'),true);process.env.WHATSAPP_MODE='yes';assert.equal(whatsappAllowed('a'),false);}
 finally{if(prev.m===undefined)delete process.env.WHATSAPP_MODE;else process.env.WHATSAPP_MODE=prev.m;if(prev.u===undefined)delete process.env.WHATSAPP_TEST_USERS;else process.env.WHATSAPP_TEST_USERS=prev.u;}
});

test('resposta do provedor: aceito ≠ entregue; chave inválida é permanente; demais temporárias',()=>{
 assert.deepEqual(classifyCallMeBot(200,'<p>Message queued. You will receive it in a few seconds.</p>'),{ok:true,accepted:true});
 assert.equal(classifyCallMeBot(200,'APIKey is invalid. Please check').ok,false);
 const inv=classifyCallMeBot(200,'APIKey is invalid');assert.ok(!inv.ok&&inv.permanent);
 const busy=classifyCallMeBot(503,'Service Unavailable');assert.ok(!busy.ok&&!busy.permanent);
 const empty=classifyCallMeBot(200,'');assert.ok(!empty.ok&&!empty.permanent);
});

test('contato inválido nunca chega a fazer requisição',async()=>{
 const r=await sendWhatsApp('5511912345678','chave inválida!','x');assert.deepEqual(r,{ok:false,permanent:true,error:'contato inválido'});
});

test('mesma decisão do e-mail: RAM DDR4 16 GB até R$ 850 dispara a R$ 799,99 e não a R$ 850,01',()=>{
 const reason=notificationReason(ram,profile,[ramAlert],[],now);assert.ok(reason);
 assert.equal(notificationReason({...ram,price:850.01} as Offer,profile,[ramAlert],[],now),null);
 assert.equal(notificationReason(ram,profile,[{...ramAlert,enabled:false} as Alert].filter(a=>a.enabled),[],now),null); // alerta pausado não é carregado
 const msg=buildWhatsAppMessage({offer:ram,reason:reason!,siteUrl:site});
 assert.match(msg,/^📉 \*Baixou!\* Encontramos uma oferta para você/);
 assert.match(msg,/💰 R\$\s799,99 à vista\/Pix/);
 assert.match(msg,/🏪 KaBuM!/);
 assert.match(msg,/R\$\s100,00 abaixo do preço habitual \(R\$\s899,99\)/);
 assert.match(msg,/Seu alerta \(Memória RAM\): até R\$\s850,00\./);
 assert.match(msg,/https:\/\/baixouofertas\.vercel\.app\/produto\/kabum-172366/);
 assert.ok(!msg.includes('1.499,99'),'preço riscado nunca aparece');
 assert.ok(msg.length<700,'mensagem curta');
});

test('sem histórico: sem linha de queda; motivo de queda sem histórico é recusado',()=>{
 const flat={...ram,historical_median:null,historical_samples:0,historical_days:0,evidence:'announced'} as unknown as Offer;
 const msg=buildWhatsAppMessage({offer:flat,reason:reasonForAlert(ramAlert,flat),siteUrl:site});
 assert.ok(!/preço habitual/.test(msg));assert.match(msg,/^🔥/);
 assert.throws(()=>buildWhatsAppMessage({offer:flat,reason:wishlistReason(),siteUrl:site}));
 assert.throws(()=>buildWhatsAppMessage({offer:ram,reason:reasonForAlert(ramAlert,ram),siteUrl:'https://evil.example'}));
});

test('título da loja não injeta formatação nem quebras de linha',()=>{
 const evil={...ram,title:'*Promo* _x_\nhttps://golpe.example ~y~',historical_median:null,historical_samples:0,historical_days:0} as unknown as Offer;
 const msg=buildWhatsAppMessage({offer:evil,reason:reasonForAlert(ramAlert,evil),siteUrl:site});
 assert.ok(!msg.includes('*Promo*'));assert.ok(!msg.includes('\nhttps://golpe'));
});
