import {NextResponse} from 'next/server';
import {adminDb} from '@/lib/server';
import {canSendCode,codeMatches,hashCode,maskPhone,newConfirmationCode,whatsappAllowed} from '@/lib/whatsapp';
import {internationalPhone} from '@/lib/phone';
import {senderStatus,sendConfirmationCode} from '@/lib/whatsapp-session';

export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
// Contato do WhatsApp do próprio usuário. Fluxo (27/11/2026): usuário informa o número e autoriza → o remetente do
// Baixou! envia um código de 6 dígitos → usuário digita o código no site → confirmado e ativado.
// Proteções: código com hash, 10 min, uso único, 5 tentativas; 60 s entre pedidos, 3/h e 6/dia por usuário;
// número já confirmado em outra conta é recusado; no máximo 40 códigos/h no sistema inteiro. Nenhum alerta antes da confirmação.
// Tabela sem políticas RLS para o cliente: tudo passa por aqui, com o JWT conferido no servidor.
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
type Row={phone:string;status:string;enabled:boolean;code_hash:string|null;code_expires_at:string|null;code_attempts:number;codes_sent:string[]};
const FIELDS='phone,status,enabled,code_hash,code_expires_at,code_attempts,codes_sent';
const CODE_MINUTES=10,RESEND_SECONDS=60,GLOBAL_PER_HOUR=40;
const site=()=>process.env.NEXT_PUBLIC_SITE_URL??'https://baixouofertas.vercel.app';
async function session(req:Request){
 const token=(req.headers.get('authorization')??'').replace(/^Bearer /,'').trim();if(!token||token.length>4096)return null;
 let db;try{db=adminDb();}catch{return null;}
 const {data,error}=await db.auth.getUser(token);if(error||!data.user)return null;return {db,user:data.user};
}
const lastSent=(r:Row|null)=>Math.max(0,...(r?.codes_sent??[]).map(t=>Date.parse(t)).filter(Number.isFinite));
const view=(r:Row|null)=>r?{phone:maskPhone(r.phone),status:r.status,enabled:r.enabled,confirmed:r.status==='confirmed',
 awaitingCode:r.status==='pending'&&!!r.code_hash&&!!r.code_expires_at&&Date.parse(r.code_expires_at)>Date.now(),
 resendIn:Math.max(0,Math.ceil((lastSent(r)+RESEND_SECONDS*1000-Date.now())/1000))}:null;
export const confirmationMessage=(code:string)=>'🔐 *Baixou!*\nSeu código de confirmação é: *'+code+'*\nDigite esse código no site para ativar suas notificações pelo WhatsApp.\nNão compartilhe este código.';

export async function GET(req:Request){
 const s=await session(req);if(!s)return json({error:'unauthorized'},401);
 if(!whatsappAllowed(s.user.id))return json({available:false});
 const [{data,error},sender]=await Promise.all([s.db.from('whatsapp_contacts').select(FIELDS).eq('user_id',s.user.id).maybeSingle(),senderStatus(s.db)]);
 if(error)return json({error:'unavailable'},503);
 return json({available:true,senderReady:sender?.status==='connected',contact:view(data as Row|null)});
}

export async function POST(req:Request){
 const s=await session(req);if(!s)return json({error:'unauthorized'},401);
 if(!whatsappAllowed(s.user.id))return json({error:'unavailable'},403);
 let body:{action?:string;phone?:string;consent?:boolean;code?:string;enabled?:boolean};try{body=await req.json();}catch{return json({error:'invalid'},400);}
 const {db,user}=s,now=new Date();
 const {data:current,error:ce}=await db.from('whatsapp_contacts').select(FIELDS).eq('user_id',user.id).maybeSingle();if(ce)return json({error:'unavailable'},503);
 const row=current as Row|null;

 if(body.action==='start'||body.action==='resend'){
  const phone=body.action==='resend'?(row?.status==='pending'?row.phone:null):internationalPhone(body.phone)?.slice(1);
  if(body.action==='start'&&body.consent!==true)return json({error:'Confirme que autoriza o recebimento de alertas no WhatsApp.'},400);
  if(!phone)return json({error:'Informe um número válido com código do país.'},400);
  const sent=row?.codes_sent??[],wait=Math.ceil((lastSent(row)+RESEND_SECONDS*1000-now.getTime())/1000);
  if(wait>0)return json({error:'Aguarde '+wait+' s para pedir outro código.'},429);
  if(row?.status==='confirmed'&&row.phone===phone)return json({ok:true,message:'Este número já está confirmado.'});
  if(!canSendCode(sent,now.getTime()))return json({error:'Muitos códigos solicitados. Tente novamente mais tarde.'},429);
  const [taken,recent,sender]=await Promise.all([
   db.from('whatsapp_contacts').select('user_id',{count:'exact',head:true}).eq('phone',phone).eq('status','confirmed').neq('user_id',user.id),
   db.from('whatsapp_contacts').select('user_id',{count:'exact',head:true}).gt('code_expires_at',new Date(now.getTime()+(CODE_MINUTES-60)*60000).toISOString()),
   senderStatus(db)]);
  if((taken.count??0)>0)return json({error:'Este número já está confirmado em outra conta do Baixou!.'},409);
  if((recent.count??0)>=GLOBAL_PER_HOUR)return json({error:'Muitos pedidos de confirmação agora. Tente em alguns minutos.'},429);
  if(sender?.status!=='connected')return json({error:'O envio pelo WhatsApp está indisponível no momento (remetente desconectado). Seus alertas por e-mail continuam normalmente.'},503);
  // Registra a tentativa ANTES de enviar: o limite vale mesmo se o envio falhar no meio.
  const code=newConfirmationCode(),codes=[...sent.filter(t=>now.getTime()-Date.parse(t)<86400000),now.toISOString()];
  const base={user_id:user.id,phone,provider:'baileys',status:row?.status==='confirmed'&&row.phone===phone?'confirmed':'pending',enabled:row?.status==='confirmed'&&row.phone===phone?row.enabled:false,consent_at:now.toISOString(),codes_sent:codes,code_hash:null,code_expires_at:null,code_attempts:0,updated_at:now.toISOString()};
  const pre=await db.from('whatsapp_contacts').upsert(base,{onConflict:'user_id'});if(pre.error)return json({error:'unavailable'},503);
  const r=await sendConfirmationCode(db,phone,confirmationMessage(code),site());
  if(!r.ok){const msg=r.reason==='sem_whatsapp'?'Este número não tem WhatsApp. Confira o código do país e o número.':r.reason==='ocupado'?'Estamos enviando outros avisos agora. Tente de novo em 30 segundos.':r.reason.startsWith('remetente_')?'O envio pelo WhatsApp está indisponível no momento (remetente desconectado).':'Não conseguimos enviar o código agora. Tente de novo em instantes.';
   return json({error:msg},r.reason==='sem_whatsapp'?400:503);}
  const {error}=await db.from('whatsapp_contacts').update({status:'pending',enabled:false,jid:r.jid,code_hash:hashCode(user.id,code),code_expires_at:new Date(now.getTime()+CODE_MINUTES*60000).toISOString(),code_attempts:0,confirmed_at:null,failures:0,last_error:null,updated_at:new Date().toISOString()}).eq('user_id',user.id);
  if(error)return json({error:'unavailable'},503);
  return json({ok:true,message:'Enviamos um código de 6 dígitos para o seu WhatsApp. Ele vale por '+CODE_MINUTES+' minutos.'});
 }
 if(body.action==='confirm'){
  if(!row||row.status!=='pending'||!row.code_hash||!row.code_expires_at||Date.parse(row.code_expires_at)<=now.getTime())return json({error:'Código expirado. Peça um novo.'},400);
  if(row.code_attempts>=5)return json({error:'Tentativas esgotadas. Peça um novo código.'},429);
  if(!codeMatches(user.id,String(body.code??'').trim(),row.code_hash)){await db.from('whatsapp_contacts').update({code_attempts:row.code_attempts+1,updated_at:now.toISOString()}).eq('user_id',user.id);return json({error:'Código incorreto.'+(row.code_attempts+1>=5?' Peça um novo código.':'')},400);}
  // Uso único: o hash é apagado na confirmação.
  const {error}=await db.from('whatsapp_contacts').update({status:'confirmed',enabled:true,confirmed_at:now.toISOString(),code_hash:null,code_expires_at:null,code_attempts:0,failures:0,last_error:null,updated_at:now.toISOString()}).eq('user_id',user.id);
  if(error)return json({error:'unavailable'},503);return json({ok:true,message:'Número confirmado. Alertas pelo WhatsApp ativados.'});
 }
 if(body.action==='toggle'){
  if(!row||row.status!=='confirmed')return json({error:'Confirme o número antes de ativar.'},400);
  const {error}=await db.from('whatsapp_contacts').update({enabled:body.enabled===true,updated_at:now.toISOString()}).eq('user_id',user.id);
  if(error)return json({error:'unavailable'},503);return json({ok:true});
 }
 return json({error:'invalid'},400);
}

// Remoção imediata do número. O histórico de envios (notification_log) não guarda número.
export async function DELETE(req:Request){
 const s=await session(req);if(!s)return json({error:'unauthorized'},401);
 const {error}=await s.db.from('whatsapp_contacts').delete().eq('user_id',s.user.id);if(error)return json({error:'unavailable'},503);return json({ok:true});
}
