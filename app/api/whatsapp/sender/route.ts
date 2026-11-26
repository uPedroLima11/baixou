import {NextResponse,after} from 'next/server';
import {adminDb} from '@/lib/server';
import {maskPhone,normalizeBrazilPhone} from '@/lib/whatsapp';
import {senderStatus,startPairing,stateKey,unlinkSender,whatsappPulse} from '@/lib/whatsapp-session';

export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=200;
// Administração do número remetente central: somente IDs em WHATSAPP_ADMIN_USERS (proprietário).
// O código de pareamento é devolvido só nesta resposta autenticada (nunca em log, banco ou Actions público).
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function admin(req:Request){
 const token=(req.headers.get('authorization')??'').replace(/^Bearer /,'').trim();if(!token||token.length>4096)return null;
 let db;try{db=adminDb();}catch{return null;}
 const {data,error}=await db.auth.getUser(token);if(error||!data.user)return null;
 const admins=(process.env.WHATSAPP_ADMIN_USERS??'').split(',').map(s=>s.trim()).filter(Boolean);return admins.includes(data.user.id)?{db}:null;
}
export async function GET(req:Request){
 const a=await admin(req);if(!a)return json({admin:false});
 const s=await senderStatus(a.db);
 return json({admin:true,keyConfigured:!!stateKey(),status:s?.status??'unlinked',phone:s?.phone?maskPhone(s.phone):null,lastConnectedAt:s?.last_connected_at??null,problem:s?.last_error??null,pairingUntil:s?.pairing_expires_at??null});
}
export async function POST(req:Request){
 const a=await admin(req);if(!a)return json({error:'forbidden'},403);
 let body:{action?:string;phone?:string};try{body=await req.json();}catch{return json({error:'invalid'},400);}
 if(body.action==='pair'){
  const phone=normalizeBrazilPhone(body.phone??'');if(!phone)return json({error:'Número remetente inválido (celular brasileiro com DDD).'},400);
  try{const {code,finish}=await startPairing(a.db,phone);after(()=>finish);return json({ok:true,code:code.match(/.{1,4}/g)?.join('-')??code,validForSeconds:160});}
  catch(e){return json({error:e instanceof Error?e.message.slice(0,200):'Falha ao iniciar o pareamento.'},503);}
 }
 if(body.action==='test')return json(await whatsappPulse(a.db,{siteUrl:process.env.NEXT_PUBLIC_SITE_URL??'https://baixouofertas.vercel.app',force:true,deadlineMs:30000}));
 if(body.action==='unlink')return json({ok:await unlinkSender(a.db)});
 return json({error:'invalid'},400);
}
