import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildWhatsAppMessage,canSendCode,codeMatches,confirmationLink,extractConfirmationCode,hashCode,isStopCommand,maskPhone,normalizeBrazilPhone,phoneVariants,whatsappAllowed} from '../lib/whatsapp';
import {rowId,seal,unseal} from '../lib/whatsapp-session';
import {randomBytes} from 'node:crypto';
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

test('confirmação pelo próprio WhatsApp: código BAIXOU, PARAR, link e 9º dígito',()=>{
 assert.equal(extractConfirmationCode('BAIXOU 123456'),'123456');assert.equal(extractConfirmationCode('  baixou: 004211 '),'004211');
 assert.equal(extractConfirmationCode('BAIXOU 1234567'),null);assert.equal(extractConfirmationCode('123456'),null);
 assert.ok(isStopCommand('PARAR'));assert.ok(isStopCommand(' parar! '));assert.ok(!isStopCommand('não quero parar agora'));
 assert.equal(confirmationLink('5511987654321','042100'),'https://wa.me/5511987654321?text=BAIXOU%20042100');
 assert.deepEqual(phoneVariants('5511912345678').sort(),['551112345678','5511912345678'].sort());
 assert.deepEqual(phoneVariants('551182345678').sort(),['551182345678','5511982345678'].sort());
 assert.deepEqual(phoneVariants('552134567890'),['552134567890']); // fixo não ganha 9
});

test('sessão do remetente: criptografia autenticada e ids sem número em texto claro',()=>{
 const key=randomBytes(32),other=randomBytes(32),plain=JSON.stringify({noiseKey:'segredo',me:{id:'5511912345678@s.whatsapp.net'}});
 const box=seal(key,plain);assert.ok(box.startsWith('v1.'));assert.ok(!box.includes('segredo'));assert.equal(unseal(key,box),plain);
 assert.throws(()=>unseal(other,box));const parts=box.split('.');parts[3]=Buffer.from('x').toString('base64');assert.throws(()=>unseal(key,parts.join('.')));
 const id=rowId(key,'session-5511912345678.0');assert.match(id,/^k_[a-f0-9]{64}$/);assert.ok(!id.includes('5511'));assert.equal(rowId(key,'creds'),'creds');
});

test('mensagem não depende de provedor externo e pede PARAR para sair',()=>{
 const m=buildWhatsAppMessage({offer:ram,reason:reasonForAlert(ramAlert,ram),siteUrl:site});assert.match(m,/Para parar, responda PARAR./);assert.ok(!/callmebot/i.test(m));
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
