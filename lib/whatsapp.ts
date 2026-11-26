import {createHash,randomInt,timingSafeEqual} from 'node:crypto';
import {money,type Offer} from './types';
import {storeNames} from './stores';
import type {NotificationReason} from './email-templates';
import {notificationProductName} from './email-templates';
import {installmentLabel} from './payment';

// Canal WhatsApp com REMETENTE CENTRAL do Baixou! (sessão em lib/whatsapp-session.ts; decisão em docs/WHATSAPP.md).
// O usuário só informa o número e envia "BAIXOU <código>" ao remetente: isso comprova a posse do número e o consentimento,
// e o Baixou! só escreve para quem escreveu primeiro. Liberação: WHATSAPP_MODE=off (padrão) | test (WHATSAPP_TEST_USERS) | on.

export type WhatsAppMode='off'|'test'|'on';
export function whatsappMode():WhatsAppMode{const m=process.env.WHATSAPP_MODE;return m==='on'||m==='test'?m:'off';}
export function whatsappAllowed(userId:string){const mode=whatsappMode();if(mode==='on')return true;if(mode==='off')return false;return (process.env.WHATSAPP_TEST_USERS??'').split(',').map(s=>s.trim()).filter(Boolean).includes(userId);}

// Número brasileiro com DDD. Aceita "(11) 91234-5678", "+55 11 91234-5678", "11912345678". Devolve 55+DDD+número.
export function normalizeBrazilPhone(raw:string){
 let d=String(raw??'').replace(/\D/g,'');if(d.startsWith('00'))d=d.slice(2);if(d.length>=12&&d.startsWith('55'))d=d.slice(2);
 if(!/^[1-9][1-9]\d{8,9}$/.test(d))return null;
 const local=d.slice(2);if(local.length===9&&local[0]!=='9')return null;if(local.length===8&&!/^[2-5]/.test(local))return null; // celular 9 dígitos começa com 9; fixo 8 dígitos 2–5
 return '55'+d;
}
export const maskPhone=(phone:string)=>'+'+phone.slice(0,2)+' ('+phone.slice(2,4)+') •••••-'+phone.slice(-4);

export const newConfirmationCode=()=>String(randomInt(0,1000000)).padStart(6,'0');
export const hashCode=(userId:string,code:string)=>createHash('sha256').update('baixou-whatsapp:'+userId+':'+code).digest('hex');
export function codeMatches(userId:string,code:string,hash:string|null){if(!hash||!/^\d{6}$/.test(code))return false;const a=Buffer.from(hashCode(userId,code)),b=Buffer.from(hash);return a.length===b.length&&timingSafeEqual(a,b);}
// Limite de códigos: 3 por hora e 6 por dia por usuário.
export function canSendCode(sent:string[],now=Date.now()){const t=sent.map(Date.parse).filter(Number.isFinite);return t.filter(x=>now-x<3600000).length<3&&t.filter(x=>now-x<86400000).length<6;}

const clean=(v:string)=>String(v??'').replace(/[\r\n\u0000-\u001f]+/g,' ').replace(/[*_~`]/g,'').replace(/\s+/g,' ').trim();
const cut=(v:string,n:number)=>v.length>n?v.slice(0,n-1).trimEnd()+'…':v;
const hasHistory=(o:Offer)=>Number(o.historical_median)>Number(o.price)&&o.historical_samples>=5&&o.historical_days>=3;

// Mensagem curta. Só valores reais da oferta e da regra que disparou; preço riscado nunca aparece.
export function buildWhatsAppMessage({offer:o,reason,siteUrl}:{offer:Offer;reason:NotificationReason;siteUrl:string}){
 const site=new URL(siteUrl);if(site.origin!=='https://baixouofertas.vercel.app')throw Error('SITE_URL não autorizado');
 const historic=hasHistory(o);if(reason.kind!=='price'&&!historic)throw Error('Queda sem histórico suficiente');
 const name=notificationProductName(o),title=clean(o.title),store=storeNames[o.store]??o.store;
 const checked=new Date(o.checked_at).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'});
 const lines=[
  (historic?'📉':'🔥')+' *Baixou!* Encontramos uma oferta para você','',
  '*'+cut(clean(name),70)+'*',
  ...(title.toLowerCase()!==clean(name).toLowerCase()?[cut(title,110)]:[]),'',
  ...(o.payment_basis==='card'?['💳 '+money(Number(o.price))+' no cartão'+(installmentLabel(o)?' ('+installmentLabel(o)+')':'')]:['💰 '+money(Number(o.price))+(o.store!=='mercadolivre'||o.payment_basis==='cash'?' à vista/Pix':'')]),
  '🏪 '+clean(store)+(o.seller&&clean(o.seller).toLowerCase()!==clean(store).toLowerCase()?' · vendido por '+cut(clean(o.seller),40):''),
  ...(historic?['📉 '+money(Number(o.historical_median)-Number(o.price))+' abaixo do preço habitual ('+money(Number(o.historical_median))+')']:[]),
  '🎯 '+reason.short,'',
  '🔗 Ver oferta no Baixou!',site.origin+'/produto/'+encodeURIComponent(o.id),'',
  '_Preço verificado às '+checked+'. Consulte disponibilidade na loja._',
  'Para parar, responda PARAR.'];
 return lines.join('\n').slice(0,1500);
}

// Brasil: contas antigas podem estar registradas sem o 9º dígito do celular. Variantes só para comparar o remetente da mensagem.
export function phoneVariants(pn:string){const d=String(pn??'').replace(/\D/g,'');const out=new Set([d]);
 if(/^55\d{2}9\d{8}$/.test(d))out.add(d.slice(0,4)+d.slice(5));
 if(/^55\d{2}[6-9]\d{7}$/.test(d))out.add(d.slice(0,4)+'9'+d.slice(4));
 return [...out];}
export const extractConfirmationCode=(text:string)=>String(text??'').match(/\bBAIXOU\s*[:#-]?\s*(\d{6})\b/i)?.[1]??null;
export const isStopCommand=(text:string)=>/^\s*(parar|sair|stop|cancelar|descadastrar)[\s.!]*$/i.test(String(text??''));
export function confirmationLink(senderPhone:string,code:string){return 'https://wa.me/'+senderPhone.replace(/\D/g,'')+'?text='+encodeURIComponent('BAIXOU '+code);}
