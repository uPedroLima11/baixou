import {createCipheriv,createDecipheriv,createHmac,randomBytes} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {codeMatches,extractConfirmationCode,isStopCommand,phoneVariants} from './whatsapp';

// Remetente central do Baixou! no WhatsApp (docs/WHATSAPP.md).
// Sem servidor 24/7: cada execução (Vercel) abre a sessão de "aparelho conectado" por poucos segundos com lease exclusivo,
// processa mensagens recebidas (confirmações/PARAR), envia a fila e fecha. Estado da sessão criptografado (AES-256-GCM)
// com WHATSAPP_STATE_KEY (só na Vercel); ids das chaves também passam por HMAC para não expor números no banco.
// Nunca registrar credenciais, chaves, objetos do Baileys nem o conteúdo da sessão.

type Db=SupabaseClient;
const LEASE='whatsapp';
export function stateKey(){const raw=process.env.WHATSAPP_STATE_KEY;if(!raw)return null;const b=Buffer.from(raw.trim(),'base64');return b.length===32?b:null;}
export function seal(key:Buffer,plain:string){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv),ct=Buffer.concat([c.update(plain,'utf8'),c.final()]);return 'v1.'+iv.toString('base64')+'.'+c.getAuthTag().toString('base64')+'.'+ct.toString('base64');}
export function unseal(key:Buffer,sealed:string){const [v,iv,tag,ct]=sealed.split('.');if(v!=='v1'||!iv||!tag||!ct)throw Error('estado inválido');const d=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64'));d.setAuthTag(Buffer.from(tag,'base64'));return Buffer.concat([d.update(Buffer.from(ct,'base64')),d.final()]).toString('utf8');}
export const rowId=(key:Buffer,name:string)=>name==='creds'?'creds':'k_'+createHmac('sha256',key).update(name).digest('hex');

const silent={level:'silent',child(){return silent;},trace(){},debug(){},info(){},warn(){},error(){},fatal(){}};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any=any;

async function dbAuthState(db:Db,key:Buffer,fresh=false){
 const B=await import('baileys');
 const read=async(name:string)=>{const {data,error}=await db.from('whatsapp_auth').select('value').eq('id',rowId(key,name)).maybeSingle();if(error)throw error;return data?JSON.parse(unseal(key,data.value),B.BufferJSON.reviver):null;};
 const write=async(name:string,value:unknown)=>{const {error}=await db.from('whatsapp_auth').upsert({id:rowId(key,name),value:seal(key,JSON.stringify(value,B.BufferJSON.replacer)),updated_at:new Date().toISOString()});if(error)throw error;};
 const remove=async(name:string)=>{const {error}=await db.from('whatsapp_auth').delete().eq('id',rowId(key,name));if(error)throw error;};
 if(fresh){const {error}=await db.from('whatsapp_auth').delete().neq('id','');if(error)throw error;}
 const creds=(fresh?null:await read('creds'))??B.initAuthCreds();
 const keys={
  get:async(type:string,ids:string[])=>{const out:Record<string,unknown>={};if(!ids.length)return out;
   const map=new Map(ids.map(id=>[rowId(key,type+'-'+id),id]));const {data,error}=await db.from('whatsapp_auth').select('id,value').in('id',[...map.keys()]);if(error)throw error;
   for(const r of data??[]){let v=JSON.parse(unseal(key,r.value),B.BufferJSON.reviver);if(type==='app-state-sync-key'&&v)v=B.proto.Message.AppStateSyncKeyData.fromObject(v);out[map.get(r.id)!]=v;}return out;},
  set:async(data:Record<string,Record<string,unknown>>)=>{const tasks:Promise<void>[]=[];for(const type in data)for(const id in data[type]){const v=data[type][id];tasks.push(v?write(type+'-'+id,v):remove(type+'-'+id));}await Promise.all(tasks);}};
 return {state:{creds,keys},saveCreds:()=>write('creds',creds),B};
}

async function setSender(db:Db,patch:Record<string,unknown>){await db.from('whatsapp_sender').update({...patch,updated_at:new Date().toISOString()}).eq('id',1);}
export async function senderStatus(db:Db){const {data,error}=await db.from('whatsapp_sender').select('phone,status,last_connected_at,last_error,pairing_expires_at').eq('id',1).maybeSingle();if(error)throw error;return data as {phone:string|null;status:string;last_connected_at:string|null;last_error:string|null;pairing_expires_at:string|null}|null;}
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));

function makeSocket(B:Any,auth:Any){
 return B.default({auth:{creds:auth.state.creds,keys:B.makeCacheableSignalKeyStore(auth.state.keys,silent)},logger:silent,browser:B.Browsers.ubuntu('Chrome'),markOnlineOnConnect:false,syncFullHistory:false,shouldSyncHistoryMessage:()=>false,generateHighQualityLinkPreview:false,connectTimeoutMs:20000,defaultQueryTimeoutMs:20000,keepAliveIntervalMs:15000});
}
type Incoming={pn:string|null;chat:string;text:string};
export type Session={sock:Any;inbox:Incoming[];delivered:Set<string>};

// Abre a sessão, executa fn e fecha. Nunca dois processos ao mesmo tempo (lease); sessão desconectada pelo celular
// (loggedOut) apaga o estado e marca 'logged_out' para o administrador parear de novo.
export async function withWhatsApp<T>(db:Db,fn:(s:Session)=>Promise<T>,{deadlineMs=40000}:{deadlineMs?:number}={}):Promise<{ok:true;value:T}|{ok:false;reason:string}>{
 const key=stateKey();if(!key)return {ok:false,reason:'sem_chave_de_estado'};
 const sender=await senderStatus(db);if(sender?.status!=='connected')return {ok:false,reason:'remetente_'+(sender?.status??'ausente')};
 const lease=await db.rpc('claim_collector_lease',{lease_name:LEASE,ttl_seconds:Math.ceil(deadlineMs/1000)+30});if(lease.error)throw lease.error;if(!lease.data)return {ok:false,reason:'ocupado'};
 let sock:Any=null;const pending:Promise<unknown>[]=[];
 try{
  const auth=await dbAuthState(db,key);if(!auth.state.creds.registered){await setSender(db,{status:'unlinked',last_error:'sessão ausente'});return {ok:false,reason:'remetente_unlinked'};}
  const B=auth.B;sock=makeSocket(B,auth);const inbox:Incoming[]=[],delivered=new Set<string>();
  sock.ev.on('creds.update',()=>{pending.push(auth.saveCreds().catch(()=>{}));});
  sock.ev.on('messages.upsert',async({messages}:Any)=>{for(const m of messages??[]){if(m.key?.fromMe||!m.message)continue;const chat=String(m.key.remoteJid??'');if(!chat||chat.endsWith('@g.us')||chat.endsWith('@broadcast')||chat.endsWith('@newsletter'))continue;
   const text=String(m.message.conversation??m.message.extendedTextMessage?.text??'').slice(0,200);if(!text)continue;
   let pnJid:string|null=B.isPnUser(chat)?chat:B.isPnUser(m.key.remoteJidAlt??'')?m.key.remoteJidAlt:null;
   if(!pnJid&&B.isLidUser(chat)){try{pnJid=await sock.signalRepository.lidMapping.getPNForLID(chat);}catch{pnJid=null;}}
   inbox.push({pn:pnJid?String(pnJid).split('@')[0].split(':')[0].replace(/\D/g,''):null,chat,text});}});
  sock.ev.on('messages.update',(updates:Any[])=>{for(const u of updates??[])if(u.key?.fromMe&&Number(u.update?.status)>=3&&u.key.id)delivered.add(u.key.id);});
  const opened=await new Promise<string>((resolve)=>{const t=setTimeout(()=>resolve('timeout'),20000);
   sock.ev.on('connection.update',(u:Any)=>{if(u.connection==='open'){clearTimeout(t);resolve('open');}if(u.connection==='close'){clearTimeout(t);resolve('close:'+Number(u.lastDisconnect?.error?.output?.statusCode??0));}});});
  if(opened!=='open'){
   if(opened==='close:401'){await db.from('whatsapp_auth').delete().neq('id','');await setSender(db,{status:'logged_out',last_error:'O aparelho foi desconectado pelo celular remetente. Pareie novamente.'});}
   else await setSender(db,{last_error:'conexão '+opened});
   return {ok:false,reason:'conexao_'+opened};}
  await setSender(db,{status:'connected',last_connected_at:new Date().toISOString(),last_error:null});
  await wait(2500); // mensagens recebidas enquanto o aparelho estava desconectado chegam logo após abrir
  const value=await fn({sock,inbox,delivered});
  return {ok:true,value};
 }finally{
  try{sock?.end(undefined);}catch{}
  await Promise.allSettled(pending);
  await db.rpc('release_collector_lease',{lease_name:LEASE});
 }
}

// Mensagens recebidas: "BAIXOU 123456" confirma o número de quem enviou (posse + consentimento); "PARAR" desativa na hora.
export async function processInbox(db:Db,s:Session,siteUrl:string){
 let confirmed=0,stopped=0,rejected=0;
 for(const m of s.inbox.splice(0)){
  const code=extractConfirmationCode(m.text);
  if(code){
   if(!m.pn){rejected++;continue;}
   const {data,error}=await db.from('whatsapp_contacts').select('user_id,phone,code_hash,code_expires_at,code_attempts').in('phone',phoneVariants(m.pn)).eq('status','pending');if(error)throw error;
   const match=(data??[]).find(c=>c.code_expires_at&&Date.parse(c.code_expires_at)>Date.now()&&c.code_attempts<5&&codeMatches(c.user_id,code,c.code_hash));
   if(match){await db.from('whatsapp_contacts').update({status:'confirmed',enabled:true,jid:m.pn+'@s.whatsapp.net',confirmed_at:new Date().toISOString(),code_hash:null,code_expires_at:null,code_attempts:0,failures:0,last_error:null,updated_at:new Date().toISOString()}).eq('user_id',match.user_id);
    confirmed++;await s.sock.sendMessage(m.chat,{text:'✅ *Baixou!* Número confirmado. Você vai receber aqui os alertas de preço que configurou.\n\nPara parar a qualquer momento, responda *PARAR* ou desative em '+siteUrl+'/?conta=notificacoes'});}
   else{rejected++;for(const c of data??[])await db.from('whatsapp_contacts').update({code_attempts:c.code_attempts+1}).eq('user_id',c.user_id);
    await s.sock.sendMessage(m.chat,{text:'Baixou!: código inválido ou expirado. Gere um novo código em '+siteUrl+'/?conta=notificacoes'});}
   await wait(1200);continue;}
  if(isStopCommand(m.text)&&m.pn){
   const {data,error}=await db.from('whatsapp_contacts').update({enabled:false,updated_at:new Date().toISOString()}).in('phone',phoneVariants(m.pn)).eq('enabled',true).select('user_id');if(error)throw error;
   if(data?.length){stopped++;await s.sock.sendMessage(m.chat,{text:'Baixou!: alertas pelo WhatsApp desativados. Para voltar a receber, ative em '+siteUrl+'/?conta=notificacoes'});await wait(1200);}
  }
 }
 return {confirmed,stopped,rejected};
}

// Fila de saída: mensagens montadas e reservadas pela decisão única (lib/notifications.ts). Mais de 60 min na fila = vencida
// (o preço pode ter mudado). 'accepted' quando o servidor do WhatsApp aceita; 'delivered' só com recibo observado.
export async function deliverQueue(db:Db,s:Session,{max=15,until}:{max?:number;until:number}){
 let accepted=0,failed=0,expired=0;const ids=new Map<string,number>();
 await db.from('notification_log').update({status:'unknown',updated_at:new Date().toISOString()}).eq('channel','whatsapp').eq('status','sending').lt('updated_at',new Date(Date.now()-15*60000).toISOString());
 const stale=await db.from('notification_log').update({status:'failed',attempts:3,last_error:'WhatsApp: vencida na fila',updated_at:new Date().toISOString()}).eq('channel','whatsapp').eq('status','queued').lt('updated_at',new Date(Date.now()-60*60000).toISOString()).select('id');expired=stale.data?.length??0;
 const {data:rows,error}=await db.from('notification_log').select('id,user_id,body').eq('channel','whatsapp').eq('status','queued').order('updated_at').limit(max);if(error)throw error;
 for(const r of rows??[]){if(Date.now()>until-6000)break;
  const {data:c}=await db.from('whatsapp_contacts').select('jid,enabled,status').eq('user_id',r.user_id).maybeSingle();
  const lock=await db.from('notification_log').update({status:'sending',updated_at:new Date().toISOString()}).eq('id',r.id).eq('status','queued').select('id');if(!lock.data?.length)continue;
  if(!c||c.status!=='confirmed'||!c.enabled||!c.jid||!r.body){await db.rpc('finish_notification',{p_id:r.id,p_ok:false,p_permanent:true,p_error:'WhatsApp: contato desativado'});failed++;continue;}
  try{const sent=await s.sock.sendMessage(c.jid,{text:r.body});await db.rpc('finish_notification',{p_id:r.id,p_ok:true,p_message_id:sent?.key?.id??null,p_accepted_only:true});accepted++;if(sent?.key?.id)ids.set(sent.key.id,r.id);}
  catch{failed++;await db.rpc('finish_notification',{p_id:r.id,p_ok:false,p_error:'WhatsApp: envio não aceito'});}
  await wait(2000+Math.floor(Math.random()*2000)); // ritmo humano, sem rajadas
 }
 if(ids.size){await wait(Math.min(4000,Math.max(0,until-Date.now()-2000)));const done=[...ids.keys()].filter(id=>s.delivered.has(id)).map(id=>ids.get(id)!);if(done.length)await db.from('notification_log').update({status:'delivered',updated_at:new Date().toISOString()}).in('id',done).eq('status','accepted');}
 return {accepted,failed,expired,delivered:[...ids.keys()].filter(id=>s.delivered.has(id)).length};
}

// Ciclo curto: só conecta quando há trabalho (fila, confirmação aguardando) ou a cada 6 h para manter a sessão ativa
// e receber "PARAR". Chamado pelas rotas de notificação/coleta; nunca em paralelo (lease).
export async function whatsappPulse(db:Db,{siteUrl,deadlineMs=40000,force=false}:{siteUrl:string;deadlineMs?:number;force?:boolean}){
 if(!stateKey())return {skipped:'sem_chave_de_estado'};
 const sender=await senderStatus(db);if(sender?.status!=='connected')return {skipped:'remetente_'+(sender?.status??'ausente')};
 const now=new Date().toISOString();
 const [queued,awaiting]=await Promise.all([db.from('notification_log').select('id',{count:'exact',head:true}).eq('channel','whatsapp').eq('status','queued'),db.from('whatsapp_contacts').select('user_id',{count:'exact',head:true}).eq('status','pending').gt('code_expires_at',now)]);
 const idle=!sender.last_connected_at||Date.now()-Date.parse(sender.last_connected_at)>6*3600000;
 if(!force&&!(queued.count??0)&&!(awaiting.count??0)&&!idle)return {skipped:'sem_trabalho'};
 const until=Date.now()+deadlineMs;
 const r=await withWhatsApp(db,async s=>{const inbox=await processInbox(db,s,siteUrl);const out=await deliverQueue(db,s,{until});await wait(800);const late=await processInbox(db,s,siteUrl);return {confirmed:inbox.confirmed+late.confirmed,stopped:inbox.stopped+late.stopped,rejected:inbox.rejected+late.rejected,...out};},{deadlineMs});
 return r.ok?r.value:{skipped:r.reason};
}

// Pareamento único do número remetente (administrador): devolve o código de 8 caracteres para digitar em
// WhatsApp > Aparelhos conectados > Conectar com número de telefone. A espera da confirmação continua em segundo plano.
export async function startPairing(db:Db,phone:string){
 const key=stateKey();if(!key)throw Error('WHATSAPP_STATE_KEY ausente na Vercel');
 const lease=await db.rpc('claim_collector_lease',{lease_name:LEASE,ttl_seconds:200});if(lease.error)throw lease.error;if(!lease.data)throw Error('Sessão do WhatsApp em uso; tente em 1 minuto.');
 let released=false;const release=async()=>{if(!released){released=true;await db.rpc('release_collector_lease',{lease_name:LEASE});}};
 try{
  const auth=await dbAuthState(db,key,true);const B=auth.B;let sock=makeSocket(B,auth);const pending:Promise<unknown>[]=[];
  const hook=(s:Any)=>s.ev.on('creds.update',()=>{pending.push(auth.saveCreds().catch(()=>{}));});hook(sock);
  await new Promise<void>((resolve,reject)=>{const t=setTimeout(()=>reject(Error('WhatsApp não respondeu')),20000);sock.ev.on('connection.update',(u:Any)=>{if(u.qr||u.connection==='connecting'){clearTimeout(t);resolve();}if(u.connection==='close'){clearTimeout(t);reject(Error('conexão recusada'));}});});
  await wait(1500);
  const code:string=await sock.requestPairingCode(phone);
  await setSender(db,{phone,status:'pairing',pairing_code:null,pairing_expires_at:new Date(Date.now()+170000).toISOString(),last_error:null});
  const finish=(async()=>{
   const deadline=Date.now()+170000;
   try{for(let i=0;i<3&&Date.now()<deadline;i++){
     const result=await new Promise<string>(resolve=>{const t=setTimeout(()=>resolve('timeout'),Math.max(1000,deadline-Date.now()));sock.ev.on('connection.update',(u:Any)=>{if(u.connection==='open'){clearTimeout(t);resolve('open');}if(u.connection==='close'){clearTimeout(t);resolve('close:'+Number(u.lastDisconnect?.error?.output?.statusCode??0));}});});
     if(result==='open'){await Promise.allSettled(pending);await wait(3000);await Promise.allSettled(pending);await setSender(db,{status:'connected',last_connected_at:new Date().toISOString(),pairing_expires_at:null,last_error:null});return;}
     if(result==='close:515'&&auth.state.creds.registered!==undefined){await Promise.allSettled(pending);sock=makeSocket(B,auth);hook(sock);continue;} // reinício exigido após o pareamento
     break;}
    await setSender(db,{status:'unlinked',pairing_expires_at:null,last_error:'Pareamento não concluído a tempo. Gere outro código.'});
   }catch{await setSender(db,{status:'error',pairing_expires_at:null,last_error:'Falha no pareamento.'});}
   finally{try{sock.end(undefined);}catch{}await Promise.allSettled(pending);await release();}
  })();
  return {code,finish};
 }catch(e){await release();throw e;}
}

export async function unlinkSender(db:Db){
 const r=await withWhatsApp(db,async s=>{try{await s.sock.logout();}catch{}return true;},{deadlineMs:20000});
 await db.from('whatsapp_auth').delete().neq('id','');await setSender(db,{status:'unlinked',phone:null,last_error:null,pairing_expires_at:null});
 return r.ok;
}
