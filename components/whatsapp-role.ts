'use client';
import {useEffect,useState} from 'react';
import {callApi} from '@/lib/api-client';
type Tally=Record<string,number>;
export type Admin={admin:boolean;mode?:string;keyConfigured?:boolean;status?:string;phone?:string|null;lastConnectedAt?:string|null;problem?:string|null;
 history?:{day:Tally;week:Tally;queued:number;contacts:{confirmed:number;active:number;pending:number};recentFailures:{at:string;error:string}[]}};

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
