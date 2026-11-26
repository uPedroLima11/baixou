import {NextResponse} from 'next/server';
import {adminDb} from '@/lib/server';
import {canSendCode,codeMatches,hashCode,maskPhone,newConfirmationCode,normalizeBrazilPhone,sendWhatsApp,validApiKey,whatsappAllowed} from '@/lib/whatsapp';

export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=30;
// Contato do WhatsApp do próprio usuário. Tabela sem políticas RLS para o cliente: tudo passa por aqui,
// com o JWT do usuário conferido no servidor. Nunca devolve a chave nem o número completo.
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
type Row={phone:string;status:string;enabled:boolean;confirmed_at:string|null;last_error:string|null;code_expires_at:string|null;code_attempts:number;codes_sent:string[];code_hash:string|null;api_key:string};

async function session(req:Request){
 const token=(req.headers.get('authorization')??'').replace(/^Bearer /,'').trim();if(!token||token.length>4096)return null;
 let db;try{db=adminDb();}catch{return null;}
 const {data,error}=await db.auth.getUser(token);if(error||!data.user)return null;return {db,user:data.user};
}
const view=(r:Row|null)=>r?{phone:maskPhone(r.phone),status:r.status,enabled:r.enabled,confirmed:r.status==='confirmed',awaitingCode:r.status==='pending'&&!!r.code_expires_at&&Date.parse(r.code_expires_at)>Date.now(),problem:r.status==='error'?(r.last_error??'O provedor recusou o envio. Confirme o número novamente.'):null}:null;
const confirmationText=(code:string)=>'Baixou!: seu código de confirmação é '+code+'. Ele vale por 10 minutos. Se você não pediu este código, ignore esta mensagem.';

export async function GET(req:Request){
 const s=await session(req);if(!s)return json({error:'unauthorized'},401);
 if(!whatsappAllowed(s.user.id))return json({available:false});
 const {data,error}=await s.db.from('whatsapp_contacts').select('*').eq('user_id',s.user.id).maybeSingle();if(error)return json({error:'unavailable'},503);
 return json({available:true,provider:'callmebot',contact:view(data as Row|null)});
}

export async function POST(req:Request){
 const s=await session(req);if(!s)return json({error:'unauthorized'},401);
 if(!whatsappAllowed(s.user.id))return json({error:'unavailable'},403);
 let body:{action?:string;phone?:string;apiKey?:string;consent?:boolean;code?:string;enabled?:boolean};try{body=await req.json();}catch{return json({error:'invalid'},400);}
 const {db,user}=s,now=new Date();
 const {data:current,error:ce}=await db.from('whatsapp_contacts').select('*').eq('user_id',user.id).maybeSingle();if(ce)return json({error:'unavailable'},503);
 const row=current as Row|null;

 if(body.action==='start'||body.action==='resend'){
  // Cadastro/alteração: exige consentimento explícito, número BR com DDD e a chave que o PRÓPRIO usuário obteve no provedor.
  const phone=body.action==='resend'?row?.phone??null:normalizeBrazilPhone(body.phone??''),apiKey=body.action==='resend'?row?.api_key??'':String(body.apiKey??'').trim();
  if(body.action==='start'&&body.consent!==true)return json({error:'Confirme que autoriza o recebimento de alertas no WhatsApp.'},400);
  if(!phone)return json({error:'Informe um celular brasileiro com DDD, por exemplo (11) 91234-5678.'},400);
  if(!validApiKey(apiKey))return json({error:'Chave inválida. Copie a chave recebida do CallMeBot (somente letras e números).'},400);
  const sent=row?.codes_sent??[]; // limite por usuário, mesmo trocando de número
  if(!canSendCode(sent,now.getTime()))return json({error:'Muitos códigos solicitados. Tente novamente mais tarde.'},429);
  const code=newConfirmationCode(),result=await sendWhatsApp(phone,apiKey,confirmationText(code));
  const recent=[...sent.filter(t=>now.getTime()-Date.parse(t)<86400000),now.toISOString()];
  const base={user_id:user.id,phone,api_key:apiKey,provider:'callmebot',codes_sent:recent,updated_at:now.toISOString()};
  if(!result.ok){
   await db.from('whatsapp_contacts').upsert({...base,status:'pending',enabled:false,consent_at:now.toISOString(),code_hash:null,code_expires_at:null,code_attempts:0,confirmed_at:null,last_error:result.error},{onConflict:'user_id'});
   return json({error:result.permanent?'O CallMeBot recusou: confira se você ativou o bot neste número e copiou a chave correta.':'Não foi possível enviar o código agora. Tente de novo em alguns minutos.'},502);
  }
  const {error}=await db.from('whatsapp_contacts').upsert({...base,status:'pending',enabled:false,consent_at:now.toISOString(),code_hash:hashCode(user.id,code),code_expires_at:new Date(now.getTime()+600000).toISOString(),code_attempts:0,confirmed_at:null,failures:0,last_error:null},{onConflict:'user_id'});
  if(error)return json({error:'unavailable'},503);
  return json({ok:true,message:'Código enviado pelo WhatsApp. Ele vale por 10 minutos.'});
 }
 if(body.action==='confirm'){
  if(!row||row.status!=='pending'||!row.code_expires_at||Date.parse(row.code_expires_at)<=now.getTime())return json({error:'Código expirado. Peça um novo.'},400);
  if(row.code_attempts>=5)return json({error:'Tentativas esgotadas. Peça um novo código.'},429);
  if(!codeMatches(user.id,String(body.code??'').trim(),row.code_hash)){await db.from('whatsapp_contacts').update({code_attempts:row.code_attempts+1,updated_at:now.toISOString()}).eq('user_id',user.id);return json({error:'Código incorreto.'},400);}
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

// Remoção imediata: apaga número e chave. O histórico de envios (notification_log) não guarda número nem chave.
export async function DELETE(req:Request){
 const s=await session(req);if(!s)return json({error:'unauthorized'},401);
 const {error}=await s.db.from('whatsapp_contacts').delete().eq('user_id',s.user.id);if(error)return json({error:'unavailable'},503);return json({ok:true});
}
