'use client';
import {useCallback,useEffect,useState} from 'react';
import {MessageCircle} from 'lucide-react';
import {supabase} from '@/lib/supabase';

type Contact={phone:string;status:'pending'|'confirmed';enabled:boolean;confirmed:boolean;awaitingCode:boolean;resendIn:number};
type State={available:boolean;senderReady?:boolean;contact:Contact|null}|null;

export async function callApi(path:string,method:string,body?:unknown){
 const token=(await supabase()?.auth.getSession())?.data.session?.access_token;if(!token)throw Error('Entre novamente na sua conta.');
 const r=await fetch(path,{method,headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(typeof data.error==='string'&&data.error.length>12?data.error:'Não foi possível concluir agora.');return data;
}

// Canal opcional (remetente central do Baixou!): número → autorização → código de 6 dígitos enviado pelo Baixou! → confirmar.
// Mostra só a etapa atual. Mesmos alertas, limites e pausas do e-mail; e-mail e WhatsApp são independentes.
export function WhatsAppSettings({notify,onActive}:{notify:(s:string)=>void;onActive?:(on:boolean)=>void}){
 const [state,setState]=useState<State>(()=>{try{const v=sessionStorage.getItem('baixou-wa-user');return v?JSON.parse(v):null;}catch{return null;}}),[phone,setPhone]=useState(''),[consent,setConsent]=useState(false),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[editing,setEditing]=useState(false),[cool,setCool]=useState(0);
 const load=useCallback(async()=>{try{const d=await callApi('/api/whatsapp','GET');const next={available:!!d.available,senderReady:!!d.senderReady,contact:d.contact??null};setState(next);try{sessionStorage.setItem('baixou-wa-user',JSON.stringify(next));}catch{}setCool(d.contact?.resendIn??0);onActive?.(!!d.contact?.confirmed&&!!d.contact?.enabled);}catch{setState({available:false,contact:null});}},[onActive]);
 useEffect(()=>{load();},[load]);
 useEffect(()=>{if(cool<=0)return;const t=setTimeout(()=>setCool(c=>c-1),1000);return ()=>clearTimeout(t);},[cool]);
 const run=async(fn:()=>Promise<unknown>,ok?:string)=>{setBusy(true);try{const d=await fn() as {message?:string};notify(d?.message??ok??'Pronto.');await load();return true;}catch(e){notify(e instanceof Error?e.message:'Não foi possível concluir agora.');return false;}finally{setBusy(false);}};
 if(!state?.available)return null;
 const c=state.contact,awaiting=!!c?.awaitingCode&&!editing,confirmed=!!c?.confirmed&&!editing,form=!c||editing||(!c.confirmed&&!c.awaitingCode);
 return <div className="channel-row" aria-labelledby="wa-title">
  <div className="channel-head"><span id="wa-title"><MessageCircle size={16}/>WhatsApp</span>
   {confirmed&&<label className="mini-switch"><small>{c!.phone}</small><input type="checkbox" role="switch" aria-label="Receber alertas pelo WhatsApp" checked={c!.enabled} disabled={busy} onChange={e=>run(()=>callApi('/api/whatsapp','POST',{action:'toggle',enabled:e.target.checked}),e.target.checked?'Alertas pelo WhatsApp ativados.':'Alertas pelo WhatsApp pausados.')}/></label>}
  </div>
  {!state.senderReady&&!confirmed&&<p className="notice" role="status">Envio pelo WhatsApp indisponível no momento. Seus alertas por e-mail continuam normalmente.</p>}
  {confirmed&&<div className="channel-links"><button type="button" className="link" disabled={busy} onClick={()=>{setEditing(true);setPhone('');setConsent(false);}}>Alterar número</button><button type="button" className="link" disabled={busy} onClick={()=>{if(confirm('Remover o número e parar os alertas pelo WhatsApp?'))run(()=>callApi('/api/whatsapp','DELETE'),'Número removido.');}}>Remover</button></div>}
  {awaiting&&<form className="code-step" onSubmit={async e=>{e.preventDefault();if(await run(()=>callApi('/api/whatsapp','POST',{action:'confirm',code})))setCode('');}}>
   <small>Digite o código enviado ao WhatsApp {c!.phone}.</small>
   <div className="inline-row"><input aria-label="Código de 6 dígitos" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} placeholder="000000"/><button className="primary" disabled={busy||code.length!==6}>Confirmar</button></div>
   <div className="channel-links"><button type="button" className="link" disabled={busy||cool>0||!state.senderReady} onClick={()=>run(()=>callApi('/api/whatsapp','POST',{action:'resend'}))}>{cool>0?'Reenviar em '+cool+' s':'Reenviar código'}</button><button type="button" className="link" onClick={()=>{setEditing(true);setPhone('');}}>Alterar número</button></div>
  </form>}
  {form&&<form className="code-step" onSubmit={async e=>{e.preventDefault();if(await run(()=>callApi('/api/whatsapp','POST',{action:'start',phone,consent})))setEditing(false);}}>
   <div className="inline-row"><input type="tel" inputMode="tel" autoComplete="tel-national" aria-label="Celular com DDD" placeholder="(11) 91234-5678" required value={phone} onChange={e=>setPhone(e.target.value)}/><button className="primary" disabled={busy||!consent||!state.senderReady}>{busy?'Enviando…':'Enviar código'}</button></div>
   <label className="check-label"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required/><span>Autorizo o Baixou! a enviar alertas de preço para este número pelo WhatsApp. Posso desativar ou remover quando quiser.</span></label>
   {editing&&c&&<button type="button" className="link" onClick={()=>setEditing(false)}>Cancelar</button>}
  </form>}
 </div>;
}
