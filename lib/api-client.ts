'use client';
import {getSupabase} from './supabase-browser';
// Chamada autenticada às rotas privadas (/api/whatsapp/*): token da sessão atual; o servidor valida sempre.
export async function callApi(path:string,method:string,body?:unknown){
 const db=await getSupabase();const token=(await db?.auth.getSession())?.data.session?.access_token;if(!token)throw Error('Entre novamente na sua conta.');
 const r=await fetch(path,{method,headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(typeof data.error==='string'&&data.error.length>12?data.error:'Não foi possível concluir agora.');return data;
}
