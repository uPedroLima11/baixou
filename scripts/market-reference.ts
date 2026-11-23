// Recalcula a referência de preço de mercado (refresh_market_reference) depois das coletas do ciclo.
import {adminDb} from '../lib/server';
const db=adminDb();
const r=await db.rpc('refresh_market_reference');if(r.error)throw r.error;
const s=await db.from('offers').select('market_stores').gt('market_stores',0).gt('expires_at',new Date().toISOString());if(s.error)throw s.error;
const dist:Record<number,number>={};for(const row of s.data??[])dist[row.market_stores]=(dist[row.market_stores]??0)+1;
console.log(JSON.stringify({evaluated:r.data,with_other_stores:s.data?.length??0,by_other_store_count:dist}));
