'use client';
import {useCallback,useEffect,useState} from 'react';
import {MessageCircle} from 'lucide-react';
import {supabase} from '@/lib/supabase';

type Contact={phone:string;status:'pending'|'confirmed'|'error';enabled:boolean;confirmed:boolean;awaitingCode:boolean;problem:string|null};
type State={available:boolean;contact:Contact|null}|null;

// Canal opcional. O usuário ativa o CallMeBot no próprio WhatsApp (o bot só envia para quem o ativou),
// cola a chave e confirma com um código de 6 dígitos. Os mesmos alertas e limites do e-mail valem aqui.
export function WhatsAppSettings({notify,onActive}:{notify:(s:string)=>void;onActive?:(on:boolean)=>void}){
 const [state,setState]=useState<State>(null),[phone,setPhone]=useState(''),[apiKey,setApiKey]=useState(''),[consent,setConsent]=useState(false),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[editing,setEditing]=useState(false);
 const call=useCallback(async(method:string,body?:unknown)=>{const token=(await supabase()?.auth.getSession())?.data.session?.access_token;if(!token)throw Error('Entre novamente na sua conta.');
  const r=await fetch('/api/whatsapp',{method,headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(typeof data.error==='string'&&data.error.length>12?data.error:'Não foi possível concluir agora.');return data;},[]);
 const load=useCallback(async()=>{try{const d=await call('GET');setState({available:!!d.available,contact:d.contact??null});onActive?.(!!d.contact?.confirmed&&!!d.contact?.enabled);}catch{setState({available:false,contact:null});}},[call,onActive]);
 useEffect(()=>{load();},[load]);
 const run=async(fn:()=>Promise<unknown>,ok?:string)=>{setBusy(true);try{const d=await fn() as {message?:string};notify(d?.message??ok??'Pronto.');await load();}catch(e){notify(e instanceof Error?e.message:'Não foi possível concluir agora.');}finally{setBusy(false);}};
 if(!state?.available)return null;
 const c=state.contact,form=!c||editing||c.status==='error';
 return <section className="form-stack whatsapp-settings" aria-labelledby="wa-title">
  <h3 id="wa-title"><MessageCircle size={18}/>Alertas pelo WhatsApp <small className="tag">experimental</small></h3>
  <p className="muted">Opcional. Você recebe os <strong>mesmos alertas</strong> do e-mail, com os mesmos limites, filtros e pausas. Nada é enviado sem o seu número confirmado.</p>
  {c&&!editing&&<div className="account-facts"><span><small>Número</small>{c.phone}</span><span><small>Situação</small>{c.confirmed?(c.enabled?'Confirmado · ativo':'Confirmado · pausado'):c.status==='error'?'Precisa reconfirmar':'Aguardando código'}</span></div>}
  {c?.problem&&<p className="notice" role="alert">O envio foi recusado ({c.problem}). Confira a ativação no CallMeBot e confirme o número de novo.</p>}
  {c?.confirmed&&!editing&&<label className="switch-label"><span>Receber alertas pelo WhatsApp<small>Desligue a qualquer momento; o e-mail continua independente.</small></span><input type="checkbox" role="switch" checked={c.enabled} disabled={busy} onChange={e=>run(()=>call('POST',{action:'toggle',enabled:e.target.checked}),e.target.checked?'Alertas pelo WhatsApp ativados.':'Alertas pelo WhatsApp pausados.')}/></label>}
  {c?.awaitingCode&&!editing&&<form className="inline-form" onSubmit={e=>{e.preventDefault();run(()=>call('POST',{action:'confirm',code}));setCode('');}}>
   <label>Código recebido no WhatsApp<input inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label>
   <div className="alert-edit-actions"><button className="primary" disabled={busy||code.length!==6}>Confirmar número</button><button type="button" className="secondary" disabled={busy} onClick={()=>run(()=>call('POST',{action:'resend'}))}>Reenviar código</button></div>
  </form>}
  {form&&<form className="form-stack" onSubmit={e=>{e.preventDefault();run(async()=>{const d=await call('POST',{action:'start',phone,apiKey,consent});setEditing(false);setApiKey('');return d;});}}>
   <details className="howto" open={!c}><summary>Como ativar (uma vez, cerca de 1 minuto)</summary><ol>
    <li>Abra <a href="https://www.callmebot.com/blog/free-api-whatsapp-messages/" target="_blank" rel="noopener noreferrer">a página do CallMeBot</a> e salve o número do bot nos seus contatos.</li>
    <li>Envie para ele, pelo WhatsApp, a mensagem <code>I allow callmebot to send me messages</code>.</li>
    <li>Você recebe uma chave (APIKEY). Cole-a abaixo com o seu número.</li></ol>
    <p className="muted">O CallMeBot é um serviço gratuito de terceiros: ele recebe seu número e o texto dos alertas para entregá-los. O bot só consegue enviar para o número que o ativou. Sem garantia de entrega; o e-mail continua sendo o canal principal.</p></details>
   <label>Celular com DDD<input type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(11) 91234-5678" required value={phone} onChange={e=>setPhone(e.target.value)}/></label>
   <label>Chave do CallMeBot (APIKEY)<input autoComplete="off" spellCheck={false} required maxLength={64} value={apiKey} onChange={e=>setApiKey(e.target.value.trim())}/></label>
   <label className="check-label"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required/><span>Autorizo o Baixou! a enviar alertas de preço para este número pelo WhatsApp, por meio do CallMeBot. Posso desativar ou remover o número quando quiser.</span></label>
   <div className="alert-edit-actions"><button className="primary" disabled={busy||!consent}>Enviar código de confirmação</button>{editing&&<button type="button" className="secondary" onClick={()=>setEditing(false)}>Cancelar</button>}</div>
  </form>}
  {c&&!editing&&<div className="alert-edit-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>setEditing(true)}>Alterar número</button><button type="button" className="secondary" disabled={busy} onClick={()=>{if(confirm('Remover o número e parar os alertas pelo WhatsApp?'))run(()=>call('DELETE'),'Número removido.');}}>Remover número</button></div>}
 </section>;
}
