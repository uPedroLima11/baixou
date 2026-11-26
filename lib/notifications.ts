import nodemailer from 'nodemailer';import {adminDb} from './server';
import {cheapestPerProduct,notificationKey} from './identity';
import {alertCovers,matchesAlert} from './alert-rules';
import {buildNotificationEmail,offerEmailUrl,reasonForAlert,wishlistReason,type NotificationReason} from './email-templates';
import type {Alert,Offer} from './types';
import {excludedCondition} from './product-policy';
import {offerForPayment} from './payment';
import {buildWhatsAppMessage,whatsappAllowed,whatsappMode} from './whatsapp';

type Profile={payment_preference?:'pix'|'card'|null;id:string;email_enabled:boolean;global_max_price:number|null;wishlist_email_enabled:boolean;wishlist_ignore_alert_limits?:boolean|null;unsubscribe_token:string};
type WishItem={offer_id:string;offers:{product_id:string|null}|null};

// Motivo da notificação: primeiro alerta que casa; senão, lista de desejos com queda histórica comprovada.
// Limites do usuário prevalecem: se um alerta ATIVO cobre o produto (categoria/produto/marca/specs) e suas condições
// NÃO são atendidas, a lista de desejos não avisa — salvo opt-in explícito (wishlist_ignore_alert_limits).
// Caso real de 26/11: alerta RAM DDR4 16 GB desktop ≤ R$ 850 + Kingston KF432C16BB/16 favoritado → e-mail "wishlist"
// a R$ 1.194,99. Com esta regra, o alerta define o limite e o e-mail não é enviado.
export function notificationReason(o:Offer,p:Pick<Profile,'global_max_price'|'wishlist_email_enabled'|'wishlist_ignore_alert_limits'|'payment_preference'>,rules:Alert[],wishlist:WishItem[],now=Date.now()):NotificationReason|null{
 if(!o.available||Date.parse(o.expires_at)<=now||excludedCondition(o.title))return null;
 // Limite geral e regras na modalidade de cada alerta (preço que o usuário vai pagar naquela forma de pagamento).
 const cap=(x:Offer)=>!p.global_max_price||Number(x.price)<=Number(p.global_max_price);
 const rule=rules.find(a=>{const x=offerForPayment(o,a.payment??'pix');return !!x&&cap(x)&&matchesAlert(a,o,now);});
 if(rule){const pay=rule.payment??'pix';return {...reasonForAlert(rule,offerForPayment(o,pay)!),payment:pay};}
 const saved=wishlist.some(w=>w.offer_id===o.id||(!!o.product_id&&w.offers?.product_id===o.product_id));
 if(!p.wishlist_email_enabled||!saved)return null;
 if(!p.wishlist_ignore_alert_limits&&rules.some(a=>alertCovers(a,o)))return null;
 // Favoritos na forma de pagamento preferida do usuário. Queda comprovada: ≥5% abaixo do habitual DAQUELA modalidade.
 const pay=p.payment_preference==='card'?'card':'pix',w=offerForPayment(o,pay);if(!w||!cap(w))return null;
 if(w.evidence==='history'&&w.historical_samples>=5&&w.historical_days>=3&&Number(w.historical_median)*0.95>=Number(w.price))return {...wishlistReason(!!p.wishlist_ignore_alert_limits&&rules.some(a=>alertCovers(a,o))),payment:pay};
 return null;
}
// Falha permanente: destinatário/conteúdo recusado (5xx). Temporária: rede, timeout, 4xx do SMTP.
export function permanentSmtpFailure(e:unknown){const code=Number((e as {responseCode?:number})?.responseCode);return Number.isFinite(code)&&code>=500&&code<600;}

type Contact={user_id:string;jid:string};
type Channel='email'|'whatsapp';

// Canais independentes sobre a MESMA decisão (notificationReason): falha ou limite de um canal nunca impede o outro.
// Reserva/deduplicação por canal no banco (claim_notification/finish_notification com p_channel).
export async function sendNotifications(options:{budgetMs?:number;maxEmails?:number;maxWhatsApp?:number}={}){
 const smtp=!!(process.env.SMTP_HOST&&process.env.SMTP_USER&&process.env.SMTP_PASS),wa=whatsappMode()!=='off';
 if(!smtp&&!wa)return {sent:0,configured:false};
 const site=process.env.NEXT_PUBLIC_SITE_URL;if(!site?.startsWith('https://'))throw Error('SITE_URL ausente');
 const db=adminDb();const port=Number(process.env.SMTP_PORT)||465;
 const transport=smtp?nodemailer.createTransport({host:process.env.SMTP_HOST,port,secure:port===465,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS},connectionTimeout:Math.min(10000,options.budgetMs??10000),socketTimeout:Math.min(15000,options.budgetMs??15000)}):null;
 try{
 const contacts=new Map<string,Contact>();
 if(wa){const {data,error}=await db.from('whatsapp_contacts').select('user_id,jid').eq('status','confirmed').eq('enabled',true).not('jid','is',null).limit(500);if(error)throw error;for(const c of (data??[]) as Contact[])if(whatsappAllowed(c.user_id))contacts.set(c.user_id,c);}
 const fields='id,email_enabled,global_max_price,wishlist_email_enabled,wishlist_ignore_alert_limits,unsubscribe_token,payment_preference';
 const byId=new Map<string,Profile>();
 if(transport){const {data,error}=await db.from('profiles').select(fields).eq('email_enabled',true).limit(500);if(error)throw error;for(const p of (data??[]) as Profile[])byId.set(p.id,p);}
 const missing=[...contacts.keys()].filter(id=>!byId.has(id));
 if(missing.length){const {data,error}=await db.from('profiles').select(fields).in('id',missing);if(error)throw error;for(const p of (data??[]) as Profile[])byId.set(p.id,p);}
 const profiles=[...byId.values()];
 if(!profiles.length)return {sent:0,configured:true,failed:0,skipped:0,whatsapp:{queued:0}};
 // Somente ofertas confirmadas nos últimos 5 minutos e dentro do TTL.
 const {data:offers,error:oe}=await db.from('offers').select('*').eq('available',true).eq('verification_status','verified').gt('checked_at',new Date(Date.now()-5*60000).toISOString()).gt('expires_at',new Date().toISOString()).order('checked_at',{ascending:false}).limit(1000);if(oe)throw oe;
 const started=Date.now(),cap=Math.min(options.maxEmails??10,Number(process.env.NOTIFY_MAX_EMAILS)||10),waCap=Math.min(options.maxWhatsApp??options.maxEmails??10,Number(process.env.NOTIFY_MAX_WHATSAPP)||10),budget=options.budgetMs??40000;
 let sent=0,failed=0,skipped=0,waQueued=0;
 for(const p of profiles){if((sent>=cap&&waQueued>=waCap)||Date.now()-started>budget)break;
  const contact=contacts.get(p.id);const emailOn=!!transport&&p.email_enabled;if(!emailOn&&!contact)continue;
  const {data:rules,error:re}=await db.from('alerts').select('*').eq('user_id',p.id).eq('enabled',true);if(re)throw re;
  const {data:wishlist,error:we}=await db.from('wishlist').select('offer_id,offers(product_id)').eq('user_id',p.id);if(we)throw we;
  const reasons=new Map<string,NotificationReason>();
  for(const o of (offers??[]) as Offer[]){const r=notificationReason(o,p,(rules??[]) as Alert[],(wishlist??[]) as unknown as WishItem[]);if(r)reasons.set(o.id,r);}
  const matches=cheapestPerProduct(((offers??[]) as Offer[]).filter(o=>reasons.has(o.id))).slice(0,5);
  if(!matches.length)continue;
  let email:string|null=null;if(emailOn){const {data:{user}}=await db.auth.admin.getUserById(p.id);if(user?.email&&user.email_confirmed_at)email=user.email;}
  const channels:Channel[]=[...(email?['email' as const]:[]),...(contact?['whatsapp' as const]:[])];
  for(const o of matches){if(Date.now()-started>budget)break;if(!offerEmailUrl(o.url)){skipped++;continue;}
   const reason=reasons.get(o.id)!,pay=reason.payment??'pix',po=offerForPayment(o,pay)!,key=notificationKey(o)+(pay==='card'?':card':'');
   for(const channel of channels){
    if(channel==='email'&&sent>=cap)continue;if(channel==='whatsapp'&&waQueued>=waCap)continue;
    // Deduplicação por produto e canal: só avisa de novo se o preço ficar abaixo do último aviso deste canal.
    const {data:state,error:se}=await db.from('notification_state').select('last_price').eq('user_id',p.id).eq('notification_key',key).eq('channel',channel).maybeSingle();if(se)throw se;if(state&&Number(po.price)>=Number(state.last_price))continue;
    if(channel==='email'){
     let message;try{message=buildNotificationEmail({offer:po,reason,siteUrl:site,unsubscribeToken:p.unsubscribe_token});}catch(e){skipped++;console.error('Notificação ignorada:',e instanceof Error?e.message:'conteúdo inválido');continue;}
     const {data:claim,error:ce}=await db.rpc('claim_notification',{p_user:p.id,p_key:key,p_offer:o.id,p_price:po.price,p_reason:reason.kind,p_channel:'email'});if(ce)throw ce;if(!claim)continue;
     try{const info=await transport!.sendMail({from:{name:'Baixou!',address:process.env.SMTP_FROM||process.env.SMTP_USER!},to:email!,subject:message.subject,text:message.text,html:message.html,headers:{'List-Unsubscribe':'<'+message.oneClick+'>','List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}});
      const {error:fe}=await db.rpc('finish_notification',{p_id:claim,p_ok:true,p_message_id:info.messageId??null});if(fe)throw fe;sent++;}
     catch(e){failed++;await db.rpc('finish_notification',{p_id:claim,p_ok:false,p_permanent:permanentSmtpFailure(e),p_error:'SMTP '+(Number((e as {responseCode?:number})?.responseCode)||'sem código')});console.error('Envio falhou; conferir SMTP (sem expor destinatário ou credenciais).');}
    }else{
     let text;try{text=buildWhatsAppMessage({offer:po,reason,siteUrl:site});}catch(e){skipped++;console.error('WhatsApp ignorado:',e instanceof Error?e.message:'conteúdo inválido');continue;}
     const {data:claim,error:ce}=await db.rpc('claim_notification',{p_user:p.id,p_key:key,p_offer:o.id,p_price:po.price,p_reason:reason.kind,p_channel:'whatsapp'});if(ce)throw ce;if(!claim)continue;
     // Fila de saída: o remetente central (lib/whatsapp-session.ts) entrega em até ~15 min; vencida após 60 min.
     const {error:qe}=await db.from('notification_log').update({status:'queued',body:text,updated_at:new Date().toISOString()}).eq('id',claim).eq('status','sending');if(qe)throw qe;waQueued++;
    }
   }
  }
 }
 console.log(sent+' e-mails enviados; '+waQueued+' WhatsApp na fila do remetente.');
 return {sent,configured:true,failed,skipped,whatsapp:{queued:waQueued}};
 }finally{transport?.close();}
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
