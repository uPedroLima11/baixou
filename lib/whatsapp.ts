import {createHash,randomInt,timingSafeEqual} from 'node:crypto';
import {money,type Offer} from './types';
import {storeNames} from './stores';
import type {NotificationReason} from './email-templates';
import {notificationProductName} from './email-templates';

// Canal WhatsApp via CallMeBot (escolha e riscos em docs/WHATSAPP.md):
// - sem número remetente próprio, sem sessão nem servidor: cada usuário ativa o bot no PRÓPRIO WhatsApp e cola a chave;
// - a chave só envia para o número que a ativou (consentimento e posse comprovados pelo próprio provedor);
// - o provedor só confirma que ACEITOU a mensagem, nunca a entrega: o log grava 'accepted'.
// Liberação: WHATSAPP_MODE=off (padrão) | test (somente WHATSAPP_TEST_USERS) | on.

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
export const validApiKey=(key:string)=>/^[A-Za-z0-9]{4,64}$/.test(String(key??'').trim());

export const newConfirmationCode=()=>String(randomInt(0,1000000)).padStart(6,'0');
export const hashCode=(userId:string,code:string)=>createHash('sha256').update('baixou-whatsapp:'+userId+':'+code).digest('hex');
export function codeMatches(userId:string,code:string,hash:string|null){if(!hash||!/^\d{6}$/.test(code))return false;const a=Buffer.from(hashCode(userId,code)),b=Buffer.from(hash);return a.length===b.length&&timingSafeEqual(a,b);}
// Limite de códigos: 3 por hora e 6 por dia por usuário (o provedor também limita; evita usar o bot como canal de spam).
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
  '💰 '+money(Number(o.price))+(o.store!=='mercadolivre'||o.payment_basis==='cash'?' à vista/Pix':''),
  '🏪 '+clean(store)+(o.seller&&clean(o.seller).toLowerCase()!==clean(store).toLowerCase()?' · vendido por '+cut(clean(o.seller),40):''),
  ...(historic?['📉 '+money(Number(o.historical_median)-Number(o.price))+' abaixo do preço habitual ('+money(Number(o.historical_median))+')']:[]),
  '🎯 '+reason.short,'',
  '🔗 Ver oferta no Baixou!',site.origin+'/produto/'+encodeURIComponent(o.id),'',
  '_Preço verificado às '+checked+'. Consulte disponibilidade na loja._',
  'Parar avisos: '+site.origin+'/?conta=notificacoes'];
 return lines.join('\n').slice(0,1500);
}

export type SendResult={ok:true;accepted:true}|{ok:false;permanent:boolean;error:string};
// CallMeBot devolve HTML 200 também em erro; classificar pelo texto. Nunca registrar a URL (contém a chave).
export function classifyCallMeBot(status:number,body:string):SendResult{
 const t=body.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').toLowerCase();
 if(status===200&&/message (queued|sent)|mensagem (enviada|na fila)/.test(t))return {ok:true,accepted:true};
 if(/apikey is invalid|invalid apikey|api ?key.*(invalid|incorrect|not valid)|phone.*not.*(activated|registered)|activate/.test(t))return {ok:false,permanent:true,error:'chave/número não ativados no provedor'};
 if(status===429||/too many|rate limit|wait/.test(t))return {ok:false,permanent:false,error:'limite do provedor'};
 return {ok:false,permanent:false,error:'provedor HTTP '+status};
}
export async function sendWhatsApp(phone:string,apiKey:string,text:string,timeoutMs=12000):Promise<SendResult>{
 if(!/^55\d{10,11}$/.test(phone)||!validApiKey(apiKey))return {ok:false,permanent:true,error:'contato inválido'};
 const url='https://api.callmebot.com/whatsapp.php?phone=%2B'+phone+'&text='+encodeURIComponent(text)+'&apikey='+encodeURIComponent(apiKey.trim());
 try{const r=await fetch(url,{headers:{'User-Agent':'BaixouBot/1.0 (+https://github.com/uPedroLima11/baixou)'},redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
  const body=(await r.text()).slice(0,4000);return classifyCallMeBot(r.status,body);}
 catch(e){return {ok:false,permanent:false,error:e instanceof Error&&e.name==='TimeoutError'?'tempo esgotado':'rede'};}
}
