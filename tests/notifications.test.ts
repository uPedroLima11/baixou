import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as cheerio from 'cheerio';
import {buildNotificationEmail,notificationSubject,reasonForAlert,wishlistReason,notificationProductName} from '../lib/email-templates';
import {notificationReason,permanentSmtpFailure} from '../lib/notifications';
import {removedProductRedirect,collectorRetryMinutes,RemovedProduct} from '../lib/collector';
import {parseStoreProduct,ConfirmedUnavailable} from '../scripts/store-adapters';
import type {Alert,Offer} from '../lib/types';

const site='https://baixouofertas.vercel.app',token='0f8fad5b-d9cb-469f-a165-70867728950e',now=Date.now();
const base={id:'kabum-1',store:'kabum',url:'https://www.kabum.com.br/produto/520369/processador-amd-ryzen-7-7800x3d',title:'Processador AMD Ryzen 7 7800X3D, 5.0GHz Max Turbo, Cache 104MB, AM5, 8 Núcleos',category:'cpu',brand:'AMD',mpn:'100-100000910WOF',image:'https://images.kabum.com.br/produtos/fotos/520369/foto.jpg',images:[],price:1679.99,original_price:4235.28,available:true,seller:'KaBuM!',sold:null,rating:null,review_count:null,specs:{},checked_at:new Date(now-60000).toISOString(),expires_at:new Date(now+3600000).toISOString(),historical_median:null,historical_samples:0,historical_days:0,discount:60,evidence:'retailer',product_id:'p1'} as Offer;
const priceAlert={category:'cpu',offer_id:null,product_id:null,max_price:1700,min_discount:null,min_drop_amount:null,enabled:true} as Alert;
test('recertified products cannot trigger an otherwise matching price alert',()=>{
 assert.equal(notificationReason({...base,title:base.title+' (RECERTIFICADO)'},{global_max_price:null,wishlist_email_enabled:true},[priceAlert],[]),null);
});

test('subject shows compact product and real verified price, fitting a phone preview',()=>{
 const s=notificationSubject(base,reasonForAlert(priceAlert,base));
 assert.equal(s,'Baixou! 🔔 Ryzen 7 7800X3D atingiu R$ 1.679,99');
 const hist={...base,historical_median:1900,historical_samples:8,historical_days:4,evidence:'history'} as Offer;
 assert.match(notificationSubject(hist,reasonForAlert({...priceAlert,max_price:null,min_drop_amount:100},hist)),/^Baixou! 📉 Ryzen 7 7800X3D caiu para R\$ 1\.679,99$/);
 const below={...base,market_stores:2,market_median:2164.63,market_lowest:2100,market_highest:2229,market_expires_at:new Date(now+600000).toISOString()} as Offer;
 assert.match(notificationSubject(below,reasonForAlert(priceAlert,below)),/^Baixou! 🔥 Ryzen 7 7800X3D por R\$/);
 const long={...base,category:'mouse',title:'Mouse Gamer Sem Fio Logitech G305 LIGHTSPEED com Sensor HERO e Bateria de Longa Duração Preto, 910-005281'} as Offer;
 assert.ok(notificationSubject(long,reasonForAlert(priceAlert,long)).length<=74);
 assert.equal(notificationProductName({...base,category:'ram',title:'Memória Kingston Fury Beast 32GB (2x16GB) DDR5 6000MHz',brand:'Kingston',specs:{}} as Offer).includes('32GB'),true);
});

test('alert e-mail: HTML + text, preheader, manage/unsubscribe links, never presents the crossed-out price as evidence',()=>{
 const m=buildNotificationEmail({offer:base,reason:reasonForAlert(priceAlert,base),siteUrl:site,unsubscribeToken:token});
 assert.match(m.html,/<html lang="pt-BR">/);assert.match(m.html,/mso-hide:all/);
 assert.match(m.html,/Ver oferta no Baixou!/);assert.match(m.html,/\/produto\/kabum-1/);assert.match(m.html,/conta=notificacoes/);assert.match(m.html,/cancelar\?token=/);
 assert.match(m.text,/Ver oferta no Baixou!: https:\/\/baixouofertas\.vercel\.app\/produto\/kabum-1/);assert.match(m.text,/Desativar e-mails de alerta/);
 assert.doesNotMatch(m.html+m.text,/4\.235|riscad|60%/);
 assert.match(m.text,/não indica queda histórica nem menor preço de todo o mercado/);
 assert.match(m.preheader,/^R\$ 1\.679,99 na KaBuM!/);
 assert.equal(m.oneClick,site+'/api/unsubscribe?token='+token);
});

test('alert e-mail escapes store data and rejects foreign links/images/sites',()=>{
 const evil={...base,title:'<script>alert(1)</script> "x"',seller:'<b>Loja</b>',image:'https://evil.example/x.jpg'} as Offer;
 const m=buildNotificationEmail({offer:evil,reason:reasonForAlert(priceAlert,evil),siteUrl:site,unsubscribeToken:token});
 assert.doesNotMatch(m.html,/<script>|<b>Loja/);assert.doesNotMatch(m.html,/evil\.example/);
 assert.throws(()=>buildNotificationEmail({offer:{...base,url:'https://evil.example/p'},reason:reasonForAlert(priceAlert,base),siteUrl:site,unsubscribeToken:token}));
 assert.throws(()=>buildNotificationEmail({offer:base,reason:reasonForAlert(priceAlert,base),siteUrl:'https://other.example',unsubscribeToken:token}));
 assert.throws(()=>buildNotificationEmail({offer:base,reason:reasonForAlert(priceAlert,base),siteUrl:site,unsubscribeToken:'x'}));
 const ml={...base,store:'mercadolivre',url:'https://www.mercadolivre.com.br/produto/MLB1',payment_basis:null} as Offer;
 const mlMail=buildNotificationEmail({offer:ml,reason:reasonForAlert(priceAlert,ml),siteUrl:site,unsubscribeToken:token});assert.match(mlMail.text,/Confira as condições de pagamento na loja/);assert.match(mlMail.preheader,/ no Mercado Livre ·/);assert.match(mlMail.html,/Ir direto para o Mercado Livre/);assert.match(buildNotificationEmail({offer:base,reason:reasonForAlert(priceAlert,base),siteUrl:site,unsubscribeToken:token}).html,/Ir direto para a KaBuM!/);
});

test('history e-mail requires real history; wishlist only on proven history drop',()=>{
 assert.throws(()=>buildNotificationEmail({offer:base,reason:wishlistReason(),siteUrl:site,unsubscribeToken:token}));
 const p={global_max_price:null,wishlist_email_enabled:true},wl=[{offer_id:'kabum-1',offers:{product_id:'p1'}}];
 assert.equal(notificationReason(base,p,[],wl,now),null);
 const hist={...base,historical_median:1900,historical_samples:5,historical_days:3,evidence:'history'} as Offer;
 assert.equal(notificationReason(hist,p,[],wl,now)?.kind,'wishlist');
 assert.equal(notificationReason(hist,{...p,wishlist_email_enabled:false},[],wl,now),null);
 const m=buildNotificationEmail({offer:hist,reason:wishlistReason(),siteUrl:site,unsubscribeToken:token});
 assert.match(m.text,/Mediana histórica: R\$ 1\.900,00 \(5 observações em 3 dias\)/);
});

test('reason selection: matching alert wins, global price cap blocks, disabled alerts never fire',()=>{
 const p={global_max_price:null,wishlist_email_enabled:false};
 assert.equal(notificationReason(base,p,[priceAlert],[],now)?.kind,'price');
 assert.equal(notificationReason(base,{...p,global_max_price:1500},[priceAlert],[],now),null);
 assert.equal(notificationReason(base,p,[{...priceAlert,enabled:false}],[],now),null);
 assert.equal(notificationReason(base,p,[{...priceAlert,max_price:1679.98}],[],now),null);
 const combo={...priceAlert,min_drop_amount:100} as Alert;
 assert.equal(notificationReason(base,p,[combo],[],now),null,'AND: price met but no history');
 const product={...priceAlert,offer_id:'kabum-1',product_id:'p1'} as Alert;
 assert.equal(notificationReason(base,p,[product],[],now)?.product,true);
});

test('SMTP 5xx is permanent; network/4xx are retried',()=>{
 assert.equal(permanentSmtpFailure({responseCode:550}),true);assert.equal(permanentSmtpFailure({responseCode:421}),false);assert.equal(permanentSmtpFailure(new Error('timeout')),false);
});

test('Patoloco removal redirect is recognized only for the exact same-origin not-found page',()=>{
 const u='https://patoloco.com.br/produto-x';
 assert.equal(removedProductRedirect(u,302,'/pagina-nao-encontrada'),true);
 assert.equal(removedProductRedirect(u,302,'https://patoloco.com.br/pagina-nao-encontrada?x=1'),false);
 assert.equal(removedProductRedirect(u,302,'https://evil.example/pagina-nao-encontrada'),false);
 assert.equal(removedProductRedirect(u,200,'/pagina-nao-encontrada'),false);
 assert.equal(removedProductRedirect('https://www.kabum.com.br/p',302,'/pagina-nao-encontrada'),false);
 assert.equal(collectorRetryMinutes(new RemovedProduct(302),0),24*60);
 assert.ok(collectorRetryMinutes(new Error('HTTP 500'),0)<24*60);
});

test('Patoloco kit page without price or explicit unavailability stays a failure, not a free offer nor out-of-stock',()=>{
 const html=readFileSync(new URL('./fixtures/expansion/patoloco-kit-no-price.html',import.meta.url),'utf8'),url=cheerio.load(html)('link[rel=canonical]').attr('href')!;
 assert.throws(()=>parseStoreProduct('patoloco',html,url),e=>!(e instanceof ConfirmedUnavailable));
});

test('Supabase gateway 522 / network errors are infrastructure, not a store block; store HTTP errors keep backoff',async()=>{
 const {infrastructureError}=await import('../lib/collector');
 assert.equal(infrastructureError({message:'<!DOCTYPE html> ... Error code 522 ...',details:'',hint:'',code:''}),true);
 assert.equal(infrastructureError(new TypeError('fetch failed')),true);
 assert.equal(infrastructureError({message:'JWT expired',details:null,hint:null,code:'PGRST301'}),true);
 assert.equal(infrastructureError(new Error('HTTP 403')),false);
 assert.equal(infrastructureError(new Error('Sem produtos verificáveis nesta fonte; consultar erros de categoria/produto')),false);
 assert.equal(infrastructureError(new RemovedProduct(302)),false);
});

// Caso real de 26/11/2026 09h02: alerta RAM DDR4 + 16 GB + desktop ≤ R$ 850 e Kingston KF432C16BB/16 favoritada.
// O e-mail saiu pela regra de favoritos (reason=wishlist) a R$ 1.194,99, ignorando o limite do alerta.
test('active alert covering the product limits wishlist e-mails unless the user opts in',()=>{
 const ram={...base,id:'kabum-1029658',category:'ram',brand:'Kingston',mpn:'KF432C16BB/16',product_id:'p-ram',price:1194.99,original_price:1444.43,
  title:'Memoria RAM Kingston Fury  Beast, 16GB, 3200MT/s, DDR4, CL16, DIMM,  Preto - KF432C16BB/16',specs:{},variant:{},
  historical_median:1299.99,historical_samples:48,historical_days:3,evidence:'history'} as unknown as Offer;
 const alert={category:'ram',offer_id:null,product_id:null,brands:[],spec_filters:{ddr:['4'],total_gb:['16'],form_factor:['desktop']},max_price:850,min_discount:null,min_drop_amount:null,enabled:true} as unknown as Alert;
 const wl=[{offer_id:'kabum-1029658',offers:{product_id:'p-ram'}}],p={global_max_price:null,wishlist_email_enabled:true};
 assert.equal(notificationReason(ram,p,[alert],wl,now),null,'acima de R$ 850: nem alerta nem favorito');
 assert.equal(notificationReason(ram,{...p,wishlist_ignore_alert_limits:true},[alert],wl,now)?.kind,'wishlist','opt-in explícito');
 assert.equal(notificationReason({...ram,price:849.99} as Offer,p,[alert],wl,now)?.kind,'price','dentro do limite: alerta dispara');
 // Alerta pausado não envia e não define limite; alerta de outra especificação (DDR5) não cobre este produto.
 assert.equal(notificationReason(ram,p,[{...alert,enabled:false}],wl,now)?.kind,'wishlist');
 assert.equal(notificationReason(ram,p,[{...alert,spec_filters:{ddr:['5']}} as unknown as Alert],wl,now)?.kind,'wishlist');
 // Produto incompatível (notebook SODIMM) nunca dispara o alerta desktop.
 const sodimm={...ram,title:'Memória Kingston Fury Impact 16GB 3200MHz DDR4 SODIMM - KF432S20IB/16',price:300} as Offer;
 assert.equal(notificationReason(sodimm,p,[alert],[],now),null);
 // Queda pequena (<5% do preço habitual diário) não é queda para favoritos; oferta vencida nunca notifica.
 assert.equal(notificationReason({...ram,historical_median:1220} as Offer,p,[],wl,now),null);
 assert.equal(notificationReason({...ram,expires_at:new Date(now-1000).toISOString()} as Offer,p,[],wl,now),null);
});
test('combined conditions: max price AND absolute AND percent drop',()=>{
 const p={global_max_price:null,wishlist_email_enabled:false};
 const h={...base,historical_median:2000,historical_samples:10,historical_days:5,evidence:'history'} as Offer;// queda 320,01 = 16,0%
 const a={...priceAlert,max_price:1700,min_drop_amount:300,min_discount:16} as Alert;
 assert.equal(notificationReason(h,p,[a],[],now)?.kind!==undefined,true);
 assert.equal(notificationReason(h,p,[{...a,min_discount:16.1} as Alert],[],now),null);
 assert.equal(notificationReason(h,p,[{...a,min_drop_amount:320.02} as Alert],[],now),null);
 assert.equal(notificationReason(h,p,[{...a,max_price:1679.98} as Alert],[],now),null);
});
test('e-mail states which rule fired (alert scope or wishlist, and the opt-in)',()=>{
 const r=reasonForAlert({...priceAlert,min_discount:10,min_drop_amount:50} as Alert,base);assert.match(r.conditions[0],/Regra: alerta de Processadores \(todas as condições juntas\)/);
 assert.match(wishlistReason().conditions.join(' '),/Nenhum alerta ativo seu cobre este produto/);
 assert.match(wishlistReason(true).conditions.join(' '),/fora dos limites dos seus alertas/);
});
