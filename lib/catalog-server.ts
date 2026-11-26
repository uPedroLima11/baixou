// Cache do catálogo no servidor (por instância da Vercel), com atualização incremental para poupar o banco:
// - carga completa (anúncios vivos, páginas de 1.000 em paralelo) no início e a cada 60 min;
// - a cada 120 s (sob demanda), só as linhas alteradas desde a última leitura (checked_at, last_attempt_at ou market_checked_at),
//   que trazem também as que deixaram de estar disponíveis (são removidas).
// A validade (expires_at) é sempre conferida na consulta: nada vencido é servido para ganhar velocidade.
// Requisições simultâneas compartilham a mesma atualização em andamento.
import {publicDb} from './supabase';
import {buildIndex,type CatalogIndex} from './catalog-query';
import type {Offer,SourceStatus,StoreCoverage} from './types';
import type {StoreRecord} from './stores';

export const LIST_FIELDS='id,store,url,title,category,brand,mpn,image,price,original_price,available,seller,sold,rating,review_count,specs,checked_at,expires_at,historical_median,historical_samples,historical_days,discount,evidence,discoveries,coupon_hint,coupon_validated,payment_note,product_id,gtin,variant,last_attempt_at,verification_status,market_median,market_lowest,market_stores,market_highest,market_expires_at,market_checked_at,seller_key,payment_basis,historical_max,reference_median,reference_samples,reference_days,reference_min,reference_max';
// Egress (cota gratuita 5 GB/mês): carga completa ~5,8 MB sem compressão; delta traz só as linhas alteradas desde a
// leitura anterior (margem de 45 s para relógio/réplica). Atualização sob demanda: sem visitas, nada é lido.
const FULL_MS=60*60000,DELTA_MS=120000,META_MS=120000,PAGE=1000,MARGIN_MS=45000;
type Meta={sources:SourceStatus[];stores:StoreRecord[];coverage:{generated_at:string;stores:StoreCoverage[]}|null};
type State={offers:Map<string,Offer>;fullAt:number;deltaAt:number;since:string;index:CatalogIndex;meta:Meta|null;metaAt:number;stats:{fullMs?:number;deltaMs?:number;deltaRows?:number}};
let state:State|null=null,inflight:Promise<State>|null=null,metaInflight:Promise<Meta|null>|null=null;

async function fullLoad():Promise<State>{
 const db=publicDb();if(!db)throw Error('Supabase não configurado');
 const t=performance.now(),started=new Date(Date.now()-MARGIN_MS).toISOString(),now=new Date().toISOString();
 const first=await db.from('catalog_offers').select(LIST_FIELDS,{count:'exact'}).eq('available',true).gt('expires_at',now).order('id').range(0,PAGE-1);
 if(first.error)throw first.error;
 const total=first.count??first.data.length,pages=Math.ceil(total/PAGE);
 const rest=await Promise.all(Array.from({length:Math.max(0,pages-1)},(_,i)=>db.from('catalog_offers').select(LIST_FIELDS).eq('available',true).gt('expires_at',now).order('id').range((i+1)*PAGE,(i+2)*PAGE-1)));
 const offers=new Map<string,Offer>();for(const r of [first,...rest]){if(r.error)throw r.error;for(const o of r.data as unknown as Offer[])offers.set(o.id,o);}
 const at=Date.now();
 return {offers,fullAt:at,deltaAt:at,since:started,index:buildIndex([...offers.values()],at),meta:state?.meta??null,metaAt:state?.metaAt??0,stats:{fullMs:Math.round(performance.now()-t)}};
}
async function deltaLoad(s:State):Promise<State>{
 const db=publicDb();if(!db)throw Error('Supabase não configurado');
 const t=performance.now(),next=new Date(Date.now()-MARGIN_MS).toISOString();
 const r=await db.from('catalog_offers').select(LIST_FIELDS).or(`checked_at.gt.${s.since},last_attempt_at.gt.${s.since},market_checked_at.gt.${s.since}`).limit(5000);
 if(r.error)throw r.error;
 const offers=new Map(s.offers);for(const o of r.data as unknown as Offer[]){if(o.available)offers.set(o.id,o);else offers.delete(o.id);}
 const at=Date.now();
 return {...s,offers,deltaAt:at,since:next,index:buildIndex([...offers.values()],at),stats:{...s.stats,deltaMs:Math.round(performance.now()-t),deltaRows:r.data.length}};
}
export async function catalogIndex():Promise<CatalogIndex>{
 const now=Date.now();
 if(state&&now-state.fullAt<FULL_MS&&now-state.deltaAt<DELTA_MS)return state.index;
 inflight??=(async()=>{try{state=!state||now-state.fullAt>=FULL_MS?await fullLoad():await deltaLoad(state).catch(()=>fullLoad());return state;}finally{inflight=null;}})();
 try{return (await inflight).index;}catch(e){if(state)return state.index;throw e;}// falha de leitura: mantém o índice anterior (a validade continua sendo conferida na consulta)
}
export async function catalogMeta():Promise<Meta|null>{
 if(state?.meta&&Date.now()-state.metaAt<META_MS)return state.meta;
 metaInflight??=(async()=>{try{const db=publicDb();if(!db)return null;
  const [sources,stores,coverage]=await Promise.all([db.from('source_status').select('*'),db.from('store_registry').select('id,name,homepage,status,marketplace,test_product_url,verified_at').order('name'),db.rpc('catalog_coverage')]);
  if(sources.error)throw sources.error;const meta={sources:sources.data as SourceStatus[],stores:(stores.data??[]) as StoreRecord[],coverage:coverage.data??null};if(state){state.meta=meta;state.metaAt=Date.now();}return meta;}finally{metaInflight=null;}})();
 try{return await metaInflight;}catch{return state?.meta??null;}
}
export function catalogStats(){return state?{offers:state.offers.size,fullAgeS:Math.round((Date.now()-state.fullAt)/1000),deltaAgeS:Math.round((Date.now()-state.deltaAt)/1000),buildMs:state.index.buildMs,...state.stats}:null;}
