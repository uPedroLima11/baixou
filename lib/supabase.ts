import {createClient,type SupabaseClient} from '@supabase/supabase-js';
let browser:SupabaseClient|undefined;
export function supabase(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)return null;return browser??=createClient(url,key,{auth:{flowType:'pkce',detectSessionInUrl:true}});}
export function publicDb(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;return url&&key?createClient(url,key,{auth:{persistSession:false}}):null;}

