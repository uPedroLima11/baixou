'use client';
import {useCallback,useEffect,useState} from 'react';
import {Smartphone,RefreshCw} from 'lucide-react';
import {callApi} from './WhatsAppSettings';

type Tally=Record<string,number>;
type Admin={admin:boolean;mode?:string;keyConfigured?:boolean;status?:string;phone?:string|null;lastConnectedAt?:string|null;problem?:string|null;
 history?:{day:Tally;week:Tally;queued:number;contacts:{confirmed:number;active:number;pending:number};recentFailures:{at:string;error:string}[]}};
const labels:Record<string,string>={unlinked:'Não conectado',pairing:'Aguardando o código no celular',connected:'Conectado',logged_out:'Desconectado pelo celular — pareie de novo',error:'Erro'};
const when=(iso?:string|null)=>iso?new Date(iso).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—';
const sum=(t:Tally|undefined,...k:string[])=>k.reduce((n,x)=>n+(t?.[x]??0),0);

// Administração do remetente central (só WHATSAPP_ADMIN_USERS; o servidor recusa os demais em /api/whatsapp/sender).
// Menu: permissão guardada NESTE navegador por usuário (resposta imediata) e revalidada por consulta leve (?role=1).
// O cache só decide se o item aparece; toda ação/consulta continua autorizada no servidor.
const roleKey=(uid:string)=>'baixou-role:'+uid;
export function useWhatsAppAdmin(uid:string|null){
 const [ok,setOk]=useState(false);
 useEffect(()=>{if(!uid){setOk(false);return;}try{setOk(localStorage.getItem(roleKey(uid))==='admin');}catch{}
  callApi('/api/whatsapp/sender?role=1','GET').then(d=>{setOk(!!d.admin);try{localStorage.setItem(roleKey(uid),d.admin?'admin':'user');}catch{}}).catch(()=>{});},[uid]);
 return ok;}
// Pré-carga ao abrir o menu: o painel abre com os dados já pedidos (e com a última leitura desta aba, se houver).
let adminPromise:Promise<Admin>|null=null,adminAt=0;
export function prefetchAdmin(force=false){if(force||!adminPromise||Date.now()-adminAt>30000){adminAt=Date.now();adminPromise=callApi('/api/whatsapp/sender','GET').then(d=>{try{sessionStorage.setItem('baixou-wa-admin',JSON.stringify(d));}catch{}return d as Admin;});adminPromise.catch(()=>{adminPromise=null;});}return adminPromise;}
const cachedAdmin=():Admin|null=>{try{const v=sessionStorage.getItem('baixou-wa-admin');return v?JSON.parse(v):null;}catch{return null;}};

export function WhatsAppAdmin({notify}:{notify:(s:string)=>void}){
 const [s,setS]=useState<Admin|null>(()=>cachedAdmin()),[phone,setPhone]=useState(''),[code,setCode]=useState<string|null>(null),[busy,setBusy]=useState(false);
 const load=useCallback(async(force=false)=>{try{setS(await prefetchAdmin(force));}catch{setS(x=>x??{admin:false});}},[]);
 useEffect(()=>{load();},[load]);
 useEffect(()=>{if(!code)return;const t=setInterval(async()=>{const d=await callApi('/api/whatsapp/sender','GET').catch(()=>null);if(d){setS(d);if(d.status==='connected'){setCode(null);notify('Número remetente conectado.');}else if(d.status!=='pairing')setCode(null);}},4000);return ()=>clearInterval(t);},[code,notify]);
 if(!s)return <div className="admin-wa" aria-busy="true">{[0,1,2].map(i=><section key={i} className="admin-card skeleton-block"><div className="sk-line w40"/><div className="sk-line"/><div className="sk-line w70"/><div className="sk-line w55"/></section>)}</div>;
 if(!s.admin)return <p className="muted">Acesso restrito ao administrador.</p>;
 const h=s.history,act=async(fn:()=>Promise<unknown>,ok:string)=>{setBusy(true);try{const d=await fn();notify(ok+(d&&typeof d==='object'&&'skipped' in d?' ('+String((d as {skipped:string}).skipped)+')':''));}catch(e){notify(e instanceof Error?e.message:'Falha.');}finally{setBusy(false);load(true);}};
 return <div className="admin-wa">
  <section className="admin-card"><h3><Smartphone size={16}/>Remetente</h3>
   <dl className="kv"><div><dt>Status</dt><dd className={s.status==='connected'?'ok':'warn'}>{labels[s.status??'unlinked']??s.status}</dd></div><div><dt>Número</dt><dd>{s.phone??'—'}</dd></div><div><dt>Última conexão</dt><dd>{when(s.lastConnectedAt)}</dd></div><div><dt>Liberação</dt><dd>{s.mode==='on'?'Todos os usuários':s.mode==='test'?'Somente teste':'Desligado'}</dd></div></dl>
   {s.problem&&<p className="notice" role="alert">{s.problem}</p>}
   {code&&<div className="confirm-box"><p>No celular remetente: WhatsApp → <strong>Aparelhos conectados</strong> → <strong>Conectar aparelho</strong> → <strong>Conectar com número de telefone</strong>:</p><p className="pair-code" aria-live="polite">{code}</p><p className="muted">Válido por ~2 minutos. Esta tela atualiza sozinha.</p></div>}
   {s.status!=='connected'&&!code&&<form className="inline-row" onSubmit={async e=>{e.preventDefault();setBusy(true);try{const d=await callApi('/api/whatsapp/sender','POST',{action:'pair',phone});setCode(d.code);await load(true);}catch(err){notify(err instanceof Error?err.message:'Falha ao gerar o código.');}finally{setBusy(false);}}}><input type="tel" required aria-label="Número remetente com DDD" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(11) 91234-5678"/><button className="primary" disabled={busy||!s.keyConfigured}>Gerar código de pareamento</button></form>}
   {s.status==='connected'&&<div className="inline-row"><button type="button" className="secondary" disabled={busy} onClick={()=>act(()=>callApi('/api/whatsapp/sender','POST',{action:'test'}),'Ciclo executado')}><RefreshCw size={14}/>Executar ciclo agora</button><button type="button" className="secondary" disabled={busy} onClick={()=>{if(confirm('Desconectar o número remetente? Os alertas pelo WhatsApp param até um novo pareamento.'))act(()=>callApi('/api/whatsapp/sender','POST',{action:'unlink'}),'Remetente desconectado');}}>Desconectar</button></div>}
  </section>
  <section className="admin-card"><h3>Envios</h3>
   <table className="mini-table"><thead><tr><th/><th>24 h</th><th>7 dias</th></tr></thead><tbody>
    <tr><td>Aceitos/entregues</td><td>{sum(h?.day,'accepted','delivered','sent')}</td><td>{sum(h?.week,'accepted','delivered','sent')}</td></tr>
    <tr><td>Com recibo de entrega</td><td>{sum(h?.day,'delivered')}</td><td>{sum(h?.week,'delivered')}</td></tr>
    <tr><td>Falhas</td><td>{sum(h?.day,'failed')}</td><td>{sum(h?.week,'failed')}</td></tr>
    <tr><td>Sem resposta (não reenviados)</td><td>{sum(h?.day,'unknown')}</td><td>{sum(h?.week,'unknown')}</td></tr>
   </tbody></table>
   <p className="muted">Na fila agora: {h?.queued??0} · Contatos confirmados: {h?.contacts.confirmed??0} ({h?.contacts.active??0} ativos) · Aguardando código: {h?.contacts.pending??0}</p>
   {!!h?.recentFailures.length&&<details><summary>Últimas falhas</summary><ul className="mini-list">{h.recentFailures.map((f,i)=><li key={i}><small>{when(f.at)}</small> {f.error}</li>)}</ul></details>}
  </section>
  <section className="admin-card"><h3>Diagnóstico</h3>
   <dl className="kv"><div><dt>Chave da sessão (Vercel)</dt><dd className={s.keyConfigured?'ok':'warn'}>{s.keyConfigured?'Configurada':'Ausente'}</dd></div><div><dt>Sessão</dt><dd>{s.status==='connected'?'Salva e criptografada no banco':'Sem sessão ativa'}</dd></div><div><dt>Ciclos</dt><dd>Com fila, código pendente ou a cada 2 h</dd></div></dl>
  </section>
 </div>;
}
