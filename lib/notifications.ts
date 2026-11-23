import nodemailer from 'nodemailer';import {adminDb} from './server';
import {cheapestPerProduct,notificationKey} from './identity';
import {matchesAlert} from './alert-rules';
import {buildNotificationEmail,offerEmailUrl,reasonForAlert,wishlistReason,type NotificationReason} from './email-templates';
import type {Alert,Offer} from './types';

type Profile={id:string;email_enabled:boolean;global_max_price:number|null;wishlist_email_enabled:boolean;unsubscribe_token:string};
type WishItem={offer_id:string;offers:{product_id:string|null}|null};

// Motivo da notificação: primeiro alerta que casa; senão, lista de desejos com queda histórica comprovada.
export function notificationReason(o:Offer,p:Pick<Profile,'global_max_price'|'wishlist_email_enabled'>,rules:Alert[],wishlist:WishItem[],now=Date.now()):NotificationReason|null{
 if(p.global_max_price&&Number(o.price)>Number(p.global_max_price))return null;
 const rule=rules.find(a=>matchesAlert(a,o,now));if(rule)return reasonForAlert(rule,o);
 const saved=wishlist.some(w=>w.offer_id===o.id||(!!o.product_id&&w.offers?.product_id===o.product_id));
 if(p.wishlist_email_enabled&&saved&&o.evidence==='history'&&o.historical_samples>=5&&o.historical_days>=3&&Number(o.historical_median)>Number(o.price))return wishlistReason();
 return null;
}
// Falha permanente: destinatário/conteúdo recusado (5xx). Temporária: rede, timeout, 4xx do SMTP.
export function permanentSmtpFailure(e:unknown){const code=Number((e as {responseCode?:number})?.responseCode);return Number.isFinite(code)&&code>=500&&code<600;}

export async function sendNotifications(options:{budgetMs?:number;maxEmails?:number}={}){
 if(!process.env.SMTP_HOST||!process.env.SMTP_USER||!process.env.SMTP_PASS){return {sent:0,configured:false}}
 const site=process.env.NEXT_PUBLIC_SITE_URL;if(!site?.startsWith('https://'))throw Error('SITE_URL ausente');
 const db=adminDb();const port=Number(process.env.SMTP_PORT)||465;
 const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port,secure:port===465,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS},connectionTimeout:Math.min(10000,options.budgetMs??10000),socketTimeout:Math.min(15000,options.budgetMs??15000)});
 try{
 const {data:profiles,error}=await db.from('profiles').select('id,email_enabled,global_max_price,wishlist_email_enabled,unsubscribe_token').eq('email_enabled',true).limit(500);if(error)throw error;
 if(!profiles?.length)return {sent:0,configured:true,failed:0,skipped:0};
 // Somente ofertas confirmadas nos últimos 5 minutos e dentro do TTL.
 const {data:offers,error:oe}=await db.from('offers').select('*').eq('available',true).eq('verification_status','verified').gt('checked_at',new Date(Date.now()-5*60000).toISOString()).gt('expires_at',new Date().toISOString()).order('checked_at',{ascending:false}).limit(1000);if(oe)throw oe;
 const started=Date.now(),cap=Math.min(options.maxEmails??10,Number(process.env.NOTIFY_MAX_EMAILS)||10),budget=options.budgetMs??40000;let sent=0,failed=0,skipped=0;
 for(const p of profiles as Profile[]){if(sent>=cap||Date.now()-started>budget)break;
  const {data:rules,error:re}=await db.from('alerts').select('*').eq('user_id',p.id).eq('enabled',true);if(re)throw re;
  const {data:wishlist,error:we}=await db.from('wishlist').select('offer_id,offers(product_id)').eq('user_id',p.id);if(we)throw we;
  const reasons=new Map<string,NotificationReason>();
  for(const o of (offers??[]) as Offer[]){const r=notificationReason(o,p,(rules??[]) as Alert[],(wishlist??[]) as unknown as WishItem[]);if(r)reasons.set(o.id,r);}
  const matches=cheapestPerProduct(((offers??[]) as Offer[]).filter(o=>reasons.has(o.id))).slice(0,5);
  if(!matches.length)continue;const {data:{user}}=await db.auth.admin.getUserById(p.id);if(!user?.email||!user.email_confirmed_at)continue;
  for(const o of matches){if(sent>=cap||Date.now()-started>budget)break;if(!offerEmailUrl(o.url)){skipped++;continue;}
   const key=notificationKey(o),reason=reasons.get(o.id)!;
   // Deduplicação por produto: só avisa de novo se o preço ficar abaixo do último aviso.
   const {data:state,error:se}=await db.from('notification_state').select('last_price').eq('user_id',p.id).eq('notification_key',key).maybeSingle();if(se)throw se;if(state&&Number(o.price)>=Number(state.last_price))continue;
   let message;try{message=buildNotificationEmail({offer:o,reason,siteUrl:site,unsubscribeToken:p.unsubscribe_token});}catch(e){skipped++;console.error('Notificação ignorada:',e instanceof Error?e.message:'conteúdo inválido');continue;}
   const {data:claim,error:ce}=await db.rpc('claim_notification',{p_user:p.id,p_key:key,p_offer:o.id,p_price:o.price,p_reason:reason.kind});if(ce)throw ce;if(!claim)continue;
   try{const info=await transport.sendMail({from:{name:'Baixou!',address:process.env.SMTP_FROM||process.env.SMTP_USER!},to:user.email,subject:message.subject,text:message.text,html:message.html,headers:{'List-Unsubscribe':'<'+message.oneClick+'>','List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}});
    const {error:fe}=await db.rpc('finish_notification',{p_id:claim,p_ok:true,p_message_id:info.messageId??null});if(fe)throw fe;sent++;}
   catch(e){failed++;await db.rpc('finish_notification',{p_id:claim,p_ok:false,p_permanent:permanentSmtpFailure(e),p_error:'SMTP '+(Number((e as {responseCode?:number})?.responseCode)||'sem código')});console.error('Envio falhou; conferir SMTP (sem expor destinatário ou credenciais).');}
  }
 }
 console.log(sent+' alertas enviados.');
 return {sent,configured:true,failed,skipped};
 }finally{transport.close();}
}

// Diagnóstico: renderiza o modelo real com uma oferta verificada e envia SOMENTE ao endereço do próprio remetente (proprietário),
// com assunto marcado como teste. Não consulta alertas, não grava log nem altera preços.
export async function sendTemplatePreview(){
 if(!process.env.SMTP_HOST||!process.env.SMTP_USER||!process.env.SMTP_PASS)return {configured:false};
 const site=process.env.NEXT_PUBLIC_SITE_URL;if(!site?.startsWith('https://'))throw Error('SITE_URL ausente');
 const db=adminDb();
 const {data,error}=await db.from('offers').select('*').eq('available',true).eq('verification_status','verified').gt('expires_at',new Date().toISOString()).not('image','is',null).order('checked_at',{ascending:false}).limit(50);if(error)throw error;
 const offer=((data??[]) as Offer[]).find(o=>offerEmailUrl(o.url));if(!offer)return {configured:true,sent:false,reason:'no_offer'};
 const max=Math.ceil(Number(offer.price));
 const message=buildNotificationEmail({offer,reason:reasonForAlert({category:offer.category,offer_id:offer.id,max_price:max,min_discount:null,min_drop_amount:null,enabled:true},offer),siteUrl:site,unsubscribeToken:'00000000-0000-4000-8000-000000000000'});
 const port=Number(process.env.SMTP_PORT)||465;
 const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port,secure:port===465,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS},connectionTimeout:10000,socketTimeout:15000});
 try{const info=await transport.sendMail({from:{name:'Baixou!',address:process.env.SMTP_FROM||process.env.SMTP_USER},to:process.env.SMTP_USER,subject:'[TESTE] '+message.subject,text:'MENSAGEM DE TESTE do modelo de alerta. Condição simulada: preço máximo '+max+' (nenhum alerta real foi disparado).\n\n'+message.text,html:message.html.replace('<body','<body data-test="true"').replace(/(<td style="padding:2[48]px 2[48]px">)/,'$1<p style="margin:0 0 16px;padding:10px 12px;background:#fff3cd;color:#5c4400;font-size:13px;border-radius:6px">Mensagem de teste do modelo de alerta. Nenhum alerta real foi disparado.</p>')});
  return {configured:true,sent:info.accepted.length===1,subject:'[TESTE] '+message.subject,offer:offer.id};}
 finally{transport.close();}
}
