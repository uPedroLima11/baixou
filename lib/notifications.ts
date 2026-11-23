import nodemailer from 'nodemailer';import {adminDb,safeUrl} from './server';import {money} from './types';
import {matchesProductAlert,cheapestPerProduct,notificationKey} from './identity';
import {matchesAlert} from './alert-rules';
import type {Offer} from './types';
export async function sendNotifications(options:{budgetMs?:number;maxEmails?:number}={}){
if(!process.env.SMTP_HOST||!process.env.SMTP_USER||!process.env.SMTP_PASS){return {sent:0,configured:false}}
const db=adminDb();const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT)||465,secure:(Number(process.env.SMTP_PORT)||465)===465,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS},connectionTimeout:Math.min(10000,options.budgetMs??10000),socketTimeout:Math.min(15000,options.budgetMs??15000)});
const {data:profiles,error}=await db.from('profiles').select('*').eq('email_enabled',true).limit(500);if(error)throw error;
const {data:offers,error:oe}=await db.from('offers').select('*').eq('available',true).eq('verification_status','verified').gt('checked_at',new Date(Date.now()-5*60000).toISOString()).gt('expires_at',new Date().toISOString()).order('discount',{ascending:false}).limit(200);if(oe)throw oe;
const started=Date.now(),cap=Math.min(options.maxEmails??10,Number(process.env.NOTIFY_MAX_EMAILS)||10),budget=options.budgetMs??40000;let sent=0;
for(const p of profiles??[]){if(sent>=cap||Date.now()-started>budget)break;const {data:rules,error:re}=await db.from('alerts').select('*').eq('user_id',p.id).eq('enabled',true);if(re)throw re;
 const {data:wishlist,error:we}=await db.from('wishlist').select('offer_id,offers(product_id)').eq('user_id',p.id);if(we)throw we;
 const matches=cheapestPerProduct(((offers??[]) as Offer[]).filter(o=>(!p.global_max_price||o.price<=p.global_max_price)&&((p.wishlist_email_enabled&&o.evidence==='history'&&(wishlist??[]).some((w:any)=>w.offer_id===o.id||(o.product_id&&w.offers?.product_id===o.product_id)))||(rules??[]).some(a=>matchesAlert(a,o))))).slice(0,5);
 if(!matches.length)continue;const {data:{user}}=await db.auth.admin.getUserById(p.id);if(!user?.email||!user.email_confirmed_at)continue;
 for(const o of matches){if(sent>=cap||Date.now()-started>budget)break;if(!safeUrl(o.url))continue;const key=notificationKey(o);const {data:state,error:se}=await db.from('notification_state').select('last_price').eq('user_id',p.id).eq('notification_key',key).maybeSingle();if(se)throw se;if(state&&Number(o.price)>=Number(state.last_price))continue;const day=new Date().toISOString().slice(0,10);const {error:claim}=await db.from('notification_log').insert({user_id:p.id,offer_id:o.id,notification_key:key,price:o.price,day,status:'sending',attempts:1});if(claim){if(claim.code==='23505')continue;throw claim;}
 try{const site=process.env.NEXT_PUBLIC_SITE_URL;if(!site?.startsWith('https://'))throw Error('SITE_URL ausente');await transport.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:user.email,subject:'Baixou! '+o.title.slice(0,70)+' por '+money(o.price),text:o.title+'\n\n'+money(o.price)+' à vista. '+(o.evidence==='history'?o.discount+'% abaixo da mediana observada.':'Meta de preço atingida; sem queda histórica comprovada.')+'\nVerificado em '+new Date(o.checked_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+'.\n\nVeja a oferta: '+site+'/produto/'+o.id+'\nLoja: '+o.url+'\n\nPreço e estoque podem mudar. Frete e condições na loja.\n\nCancelar alertas: '+site+'/cancelar?token='+p.unsubscribe_token});await db.from('notification_log').update({status:'sent',updated_at:new Date().toISOString()}).eq('user_id',p.id).eq('offer_id',o.id).eq('day',day);await db.from('notification_state').upsert({user_id:p.id,notification_key:key,last_price:o.price,last_sent_at:new Date().toISOString()});sent++;}catch{await db.from('notification_log').update({status:'failed',updated_at:new Date().toISOString()}).eq('user_id',p.id).eq('offer_id',o.id).eq('day',day);console.error('Envio falhou; conferir SMTP (sem expor destinatário ou credenciais).');}}
}
console.log(sent+' alertas enviados.');

return {sent,configured:true};
}
