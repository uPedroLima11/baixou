'use client';
// Cliente do Supabase no navegador sob demanda: o supabase-js (~66 KB comprimidos) sai do pacote inicial da página e
// carrega em paralelo à hidratação. A sessão local já gravada pelo próprio supabase-js (localStorage) é lida de forma
// síncrona apenas para exibição imediata (nome no botão da conta, id para pré-carga); permissões e dados privados
// continuam validados pelo servidor/RLS em toda consulta.
import type {SupabaseClient,User} from '@supabase/supabase-js';
let client:Promise<SupabaseClient|null>|null=null;
export function getSupabase():Promise<SupabaseClient|null>{
 client??=import('./supabase').then(m=>m.supabase());
 client.catch(()=>{client=null;});
 return client;
}
export function storageKey(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;if(!url)return null;try{return 'sb-'+new URL(url).hostname.split('.')[0]+'-auth-token';}catch{return null;}}
// Usuário da sessão local, sem rede. Sessão expirada há mais de 7 dias não é exibida (o refresh token pode ter caído).
export function localUser():User|null{
 try{const k=storageKey();if(!k)return null;const raw=localStorage.getItem(k);if(!raw)return null;const s=JSON.parse(raw) as {user?:User;expires_at?:number};
  if(!s?.user?.id)return null;if(s.expires_at&&s.expires_at*1000<Date.now()-7*86400000)return null;return s.user;}catch{return null;}
}
