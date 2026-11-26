import {NextResponse} from 'next/server';
import {adminDb} from '@/lib/server';
import {canSendCode,confirmationLink,hashCode,maskPhone,newConfirmationCode,normalizeBrazilPhone,whatsappAllowed} from '@/lib/whatsapp';
import {senderStatus,whatsappPulse} from '@/lib/whatsapp-session';

export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
// Contato do WhatsApp do próprio usuário (remetente central). Tabela sem políticas RLS para o cliente: tudo passa por aqui,
// com o JWT conferido no servidor. Confirmação = o usuário envia "BAIXOU <código>" ao remetente do Baixou!.
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
type Row={phone:string;status:string;enabled:boolean;code_expires_at:string|null;codes_sent:string[]};

async function session(req:Request){
 const token=(req.headers.get('authorization')??'').replace(/^Bearer /,'').trim();if(!token||token.length>4096)return null;
 let db;try{db=adminDb();}catch{return null;}
 const {data,error}=await db.auth.getUser(token);if(error||!data.user)return null;return {db,user:data.user};
}
const view=(r:Row|null)=>r?{phone:maskPhone(r.phone),status:r.status,enabled:r.enabled,confirmed:r.status==='confirmed',awaitingCode:r.status==='pending'&&!!r.code_expires_at&&Date.parse(r.code_expires_at)>Date.now()}:null;
const site=()=>process.env.NEXT_PUBLIC_SITE_URL??'https://baixouofertas.vercel.app';

export async function GET(req:Request){
 const s=await session(req);if(!s)return json({error:'unauthorized'},401);
 if(!whatsappAllowed(s.user.id))return json({available:false});
 const [{data,error},sender]=await Promise.all([s.db.from('whatsapp_contacts').select('phone,status,enabled,code_expires_at,codes_sent').eq('user_id',s.user.id).maybeSingle(),senderStatus(s.db)]);
 if(error)return json({error:'unavailable'},503);
 return json({available:true,senderReady:sender?.status==='connected',contact:view(data as Row|null)});
}

export async function POST(req:Request){
 const s=await session(req);if(!s)return json({error:'unauthorized'},401);
 if(!whatsappAllowed(s.user.id))return json({error:'unavailable'},403);
 let body:{action?:string;phone?:string;consent?:boolean;enabled?:boolean};try{body=await req.json();}catch{return json({error:'invalid'},400);}
 const {db,user}=s,now=new Date();
 const [{data:current,error:ce},sender]=await Promise.all([db.from('whatsapp_contacts').select('phone,status,enabled,code_expires_at,codes_sent').eq('user_id',user.id).maybeSingle(),senderStatus(db)]);if(ce)return json({error:'unavailable'},503);
 const row=current as Row|null;

 if(body.action==='start'||body.action==='resend'){
  if(sender?.status!=='connected'||!sender.phone)return json({error:'O envio pelo WhatsApp está indisponível no momento. Tente mais tarde.'},503);
  const phone=body.action==='resend'?row?.phone??null:normalizeBrazilPhone(body.phone??'');
  if(body.action==='start'&&body.consent!==true)return json({error:'Confirme que autoriza o recebimento de alertas no WhatsApp.'},400);
  if(!phone)return json({error:'Informe um celular brasileiro com DDD, por exemplo (11) 91234-5678.'},400);
  const sent=row?.codes_sent??[];if(!canSendCode(sent,now.getTime()))return json({error:'Muitos códigos solicitados. Tente novamente mais tarde.'},429);
  const code=newConfirmationCode();
  const {error}=await db.from('whatsapp_contacts').upsert({user_id:user.id,phone,provider:'baileys',status:'pending',enabled:false,consent_at:now.toISOString(),code_hash:hashCode(user.id,code),code_expires_at:new Date(now.getTime()+30*60000).toISOString(),code_attempts:0,codes_sent:[...sent.filter(t=>now.getTime()-Date.parse(t)<86400000),now.toISOString()],confirmed_at:null,jid:null,failures:0,last_error:null,updated_at:now.toISOString()},{onConflict:'user_id'});
  if(error)return json({error:'unavailable'},503);
  // O código só aparece para o próprio usuário autenticado; vale só quando enviado DO número informado.
  return json({ok:true,code,link:confirmationLink(sender.phone,code),expiresInMinutes:30});
 }
 if(body.action==='check'){
  if(!row||row.status!=='pending')return json({ok:true,contact:view(row)});
  const r=await whatsappPulse(db,{siteUrl:site(),deadlineMs:25000,force:true});
  const {data}=await db.from('whatsapp_contacts').select('phone,status,enabled,code_expires_at,codes_sent').eq('user_id',user.id).maybeSingle();
  const busy='skipped' in r&&r.skipped==='ocupado';
  return json({ok:true,contact:view(data as Row|null),message:(data as Row|null)?.status==='confirmed'?'Número confirmado. Alertas pelo WhatsApp ativados.':busy?'Conferindo outras mensagens agora; tente de novo em 1 minuto.':'Ainda não recebemos sua mensagem. Envie "BAIXOU" e o código pelo WhatsApp do número informado.'});
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
