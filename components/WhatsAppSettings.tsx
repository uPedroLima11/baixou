'use client';
import {useCallback,useEffect,useState} from 'react';
import {MessageCircle,Smartphone} from 'lucide-react';
import {supabase} from '@/lib/supabase';

type Contact={phone:string;status:'pending'|'confirmed';enabled:boolean;confirmed:boolean;awaitingCode:boolean};
type State={available:boolean;senderReady?:boolean;contact:Contact|null}|null;
type Pending={code:string;link:string}|null;

async function call(path:string,method:string,body?:unknown){
 const token=(await supabase()?.auth.getSession())?.data.session?.access_token;if(!token)throw Error('Entre novamente na sua conta.');
 const r=await fetch(path,{method,headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(typeof data.error==='string'&&data.error.length>12?data.error:'Não foi possível concluir agora.');return data;
}

// Canal opcional com o remetente central do Baixou!. O usuário informa o número e envia "BAIXOU <código>" pelo próprio
// WhatsApp: isso confirma o número e autoriza o recebimento. Mesmos alertas, limites e pausas do e-mail.
export function WhatsAppSettings({notify,onActive}:{notify:(s:string)=>void;onActive?:(on:boolean)=>void}){
 const [state,setState]=useState<State>(null),[phone,setPhone]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[editing,setEditing]=useState(false),[pending,setPending]=useState<Pending>(null);
 const load=useCallback(async()=>{try{const d=await call('/api/whatsapp','GET');setState({available:!!d.available,senderReady:!!d.senderReady,contact:d.contact??null});onActive?.(!!d.contact?.confirmed&&!!d.contact?.enabled);}catch{setState({available:false,contact:null});}},[onActive]);
 useEffect(()=>{load();},[load]);
 const run=async(fn:()=>Promise<unknown>,ok?:string)=>{setBusy(true);try{const d=await fn() as {message?:string};notify(d?.message??ok??'Pronto.');await load();}catch(e){notify(e instanceof Error?e.message:'Não foi possível concluir agora.');}finally{setBusy(false);}};
 const start=(action:'start'|'resend')=>run(async()=>{const d=await call('/api/whatsapp','POST',action==='start'?{action,phone,consent}:{action});setPending({code:d.code,link:d.link});setEditing(false);return {message:'Agora envie a mensagem pelo WhatsApp.'};});
 return <>
  <SenderAdmin notify={notify} onChange={load}/>
  {state?.available&&<WhatsAppUser {...{state,phone,setPhone,consent,setConsent,busy,editing,setEditing,pending,setPending,start,run}}/>}
 </>;
}

function WhatsAppUser({state,phone,setPhone,consent,setConsent,busy,editing,setEditing,pending,setPending,start,run}:{state:NonNullable<State>;phone:string;setPhone:(v:string)=>void;consent:boolean;setConsent:(v:boolean)=>void;busy:boolean;editing:boolean;setEditing:(v:boolean)=>void;pending:Pending;setPending:(v:Pending)=>void;start:(a:'start'|'resend')=>void;run:(fn:()=>Promise<unknown>,ok?:string)=>Promise<void>}){
 const c=state.contact,form=!c||editing;
 return <section className="form-stack whatsapp-settings" aria-labelledby="wa-title">
  <h3 id="wa-title"><MessageCircle size={18}/>Alertas pelo WhatsApp <small className="tag">experimental</small></h3>
  <p className="muted">Opcional. Você recebe os <strong>mesmos alertas</strong> do e-mail, com os mesmos limites, filtros e pausas. Para parar, responda <strong>PARAR</strong> no WhatsApp ou desligue aqui.</p>
  {!state.senderReady&&<p className="notice" role="status">O envio pelo WhatsApp está temporariamente indisponível. Seus alertas por e-mail continuam normalmente.</p>}
  {c&&!editing&&<div className="account-facts"><span><small>Número</small>{c.phone}</span><span><small>Situação</small>{c.confirmed?(c.enabled?'Confirmado · ativo':'Confirmado · pausado'):'Aguardando confirmação'}</span></div>}
  {c?.confirmed&&!editing&&<label className="switch-label"><span>Receber alertas pelo WhatsApp<small>O e-mail continua independente.</small></span><input type="checkbox" role="switch" checked={c.enabled} disabled={busy} onChange={e=>run(()=>call('/api/whatsapp','POST',{action:'toggle',enabled:e.target.checked}),e.target.checked?'Alertas pelo WhatsApp ativados.':'Alertas pelo WhatsApp pausados.')}/></label>}
  {c&&!c.confirmed&&!editing&&<div className="confirm-box">
   {pending?<><p>Toque no botão abaixo e envie a mensagem <strong>BAIXOU {pending.code}</strong> pelo WhatsApp do número {c.phone}. O código vale 30 minutos.</p>
    <a className="primary" href={pending.link} target="_blank" rel="noopener noreferrer">Abrir o WhatsApp e enviar</a></>
   :<p>Gere um código e envie-o pelo WhatsApp do número informado para confirmar.</p>}
   <div className="alert-edit-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>run(()=>call('/api/whatsapp','POST',{action:'check'}))}>Já enviei, conferir</button><button type="button" className="secondary" disabled={busy||!state.senderReady} onClick={()=>start('resend')}>{pending?'Gerar outro código':'Gerar código'}</button></div>
  </div>}
  {form&&<form className="form-stack" onSubmit={e=>{e.preventDefault();start('start');}}>
   <label>Celular com DDD<input type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(11) 91234-5678" required value={phone} onChange={e=>setPhone(e.target.value)}/></label>
   <label className="check-label"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required/><span>Autorizo o Baixou! a enviar alertas de preço para este número pelo WhatsApp. Posso desativar ou remover o número quando quiser.</span></label>
   <div className="alert-edit-actions"><button className="primary" disabled={busy||!consent||!state.senderReady}>Continuar</button>{editing&&<button type="button" className="secondary" onClick={()=>setEditing(false)}>Cancelar</button>}</div>
  </form>}
  {c&&!editing&&<div className="alert-edit-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>{setPending(null);setEditing(true);}}>Alterar número</button><button type="button" className="secondary" disabled={busy} onClick={()=>{if(confirm('Remover o número e parar os alertas pelo WhatsApp?')){setPending(null);run(()=>call('/api/whatsapp','DELETE'),'Número removido.');}}}>Remover número</button></div>}
 </section>;
}

type Sender={admin:boolean;keyConfigured?:boolean;status?:string;phone?:string|null;lastConnectedAt?:string|null;problem?:string|null};
// Só para o proprietário (WHATSAPP_ADMIN_USERS): pareamento único do número remetente do Baixou!.
function SenderAdmin({notify,onChange}:{notify:(s:string)=>void;onChange:()=>void}){
 const [s,setS]=useState<Sender|null>(null),[phone,setPhone]=useState(''),[code,setCode]=useState<string|null>(null),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{try{setS(await call('/api/whatsapp/sender','GET'));}catch{setS(null);}},[]);
 useEffect(()=>{load();},[load]);
 useEffect(()=>{if(!code)return;const t=setInterval(async()=>{const d=await call('/api/whatsapp/sender','GET').catch(()=>null);if(d){setS(d);if(d.status==='connected'){setCode(null);notify('Número remetente conectado.');onChange();}else if(d.status!=='pairing')setCode(null);}},4000);return ()=>clearInterval(t);},[code,notify,onChange]);
 if(!s?.admin)return null;
 const labels:Record<string,string>={unlinked:'Não conectado',pairing:'Aguardando o código no celular',connected:'Conectado',logged_out:'Desconectado pelo celular — pareie de novo',error:'Erro'};
 return <section className="form-stack whatsapp-settings" aria-labelledby="wa-admin">
  <h3 id="wa-admin"><Smartphone size={18}/>Remetente do Baixou! no WhatsApp <small className="tag">administração</small></h3>
  {!s.keyConfigured&&<p className="notice">WHATSAPP_STATE_KEY ausente na Vercel: o pareamento não pode ser salvo.</p>}
  <div className="account-facts"><span><small>Situação</small>{labels[s.status??'unlinked']??s.status}</span><span><small>Número</small>{s.phone??'—'}</span><span><small>Última conexão</small>{s.lastConnectedAt?new Date(s.lastConnectedAt).toLocaleString('pt-BR'):'—'}</span></div>
  {s.problem&&<p className="notice" role="alert">{s.problem}</p>}
  {code&&<div className="confirm-box"><p>No celular do número remetente: WhatsApp → <strong>Aparelhos conectados</strong> → <strong>Conectar aparelho</strong> → <strong>Conectar com número de telefone</strong>, e digite:</p><p className="pair-code" aria-live="polite">{code}</p><p className="muted">Válido por cerca de 2 minutos. Esta tela atualiza sozinha.</p></div>}
  {s.status!=='connected'&&!code&&<form className="inline-form" onSubmit={async e=>{e.preventDefault();setBusy(true);try{const d=await call('/api/whatsapp/sender','POST',{action:'pair',phone});setCode(d.code);await load();}catch(err){notify(err instanceof Error?err.message:'Falha ao gerar o código.');}finally{setBusy(false);}}}>
   <label>Número remetente (com DDD)<input type="tel" required value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(11) 91234-5678"/></label>
   <div className="alert-edit-actions"><button className="primary" disabled={busy||!s.keyConfigured}>Gerar código de pareamento</button></div></form>}
  {s.status==='connected'&&<div className="alert-edit-actions"><button type="button" className="secondary" disabled={busy} onClick={async()=>{setBusy(true);try{const d=await call('/api/whatsapp/sender','POST',{action:'test'});notify('Ciclo executado: '+JSON.stringify(d));}catch(err){notify(err instanceof Error?err.message:'Falha.');}finally{setBusy(false);load();}}}>Executar ciclo agora</button><button type="button" className="secondary" disabled={busy} onClick={async()=>{if(!confirm('Desconectar o número remetente? Os alertas pelo WhatsApp param até um novo pareamento.'))return;setBusy(true);try{await call('/api/whatsapp/sender','POST',{action:'unlink'});notify('Remetente desconectado.');}finally{setBusy(false);load();onChange();}}}>Desconectar</button></div>}
 </section>;
}
