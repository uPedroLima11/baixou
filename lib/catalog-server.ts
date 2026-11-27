// Cache do catálogo no servidor (por instância da Vercel), com atualização incremental para poupar o banco:
// - carga completa (anúncios vivos, páginas por ID) no início e a cada 60 min;
// - a cada 120 s (sob demanda), só as linhas alteradas desde a última leitura (checked_at, last_attempt_at ou market_checked_at),
//   que trazem também as que deixaram de estar disponíveis (são removidas).
// A validade (expires_at) é sempre conferida na consulta: nada vencido é servido para ganhar velocidade.
// Requisições simultâneas compartilham a mesma atualização em andamento.
import {publicDb} from './supabase';
import {buildIndex,type CatalogIndex} from './catalog-query';
import type {Offer,SourceStatus,StoreCoverage} from './types';
import {offerForPayment,type Payment} from './payment';
import type {StoreRecord} from './stores';
import {unstable_cache} from 'next/cache';
import {after as afterResponse} from 'next/server';
import {withRetry} from './db-retry';
import {encodeSnapshot,decodeSnapshot,type CatalogSnapshot} from './catalog-snapshot';

export const LIST_FIELDS='id,store,url,title,category,brand,mpn,image,price,original_price,available,seller,sold,rating,review_count,specs,checked_at,expires_at,historical_median,historical_samples,historical_days,discount,evidence,discoveries,coupon_hint,coupon_validated,payment_note,product_id,gtin,variant,last_attempt_at,verification_status,market_median,market_lowest,market_stores,market_highest,market_expires_at,market_checked_at,seller_key,payment_basis,historical_max,reference_median,reference_samples,reference_days,reference_min,reference_max,card_price,card_installments,card_installment_value,card_interest_free,card_reference_median,card_reference_samples,card_reference_days,card_reference_min,card_reference_max,card_historical_max,card_market_median,card_market_lowest,card_market_highest,card_market_stores,card_market_expires_at';
// Egress (cota gratuita 5 GB/mês): carga completa ~5,8 MB sem compressão; delta traz só as linhas alteradas desde a
// leitura anterior (margem de 45 s para relógio/réplica). Atualização sob demanda: sem visitas, nada é lido.
const FULL_MS=60*60000,DELTA_MS=120000,META_MS=120000,PAGE=400,MARGIN_MS=45000,SNAPSHOT_MAX_MS=10*60000,STALE_MAX_MS=10*60000;
type Meta={sources:SourceStatus[];stores:StoreRecord[];coverage:{generated_at:string;stores:StoreCoverage[]}|null};
type State={cardIndex?:CatalogIndex;pixIndex?:CatalogIndex;offers:Map<string,Offer>;fullAt:number;deltaAt:number;since:string;index:CatalogIndex;meta:Meta|null;metaAt:number;stats:{fullMs?:number;deltaMs?:number;deltaRows?:number;snapshotBytes?:number;snapshotAgeS?:number}};
let state:State|null=null,inflight:Promise<State>|null=null,metaInflight:Promise<Meta|null>|null=null;

// Faixas de ID lidas em paralelo (cursor dentro de cada faixa). Caminho crítico de ~13 páginas em série para ~2.
// As faixas formam fatias do snapshot compartilhado: cada uma é uma entrada própria do Data Cache (teto de ~2 MB por
// entrada), então o catálogo pode crescer várias vezes sem que instâncias novas voltem a ler tudo do banco.
const SHARDS:[string,string][][]=[[['','kabum-']],[['kabum-','kabum-3'],['kabum-3','kabum-6']],[['kabum-6','kabum-9'],['kabum-9','kabun']],[['kabun','s']],[['s','\uffff']]];
const SHARD_LIMIT=1800000;
async function fetchRanges(ranges:[string,string][]):Promise<CatalogSnapshot>{
 const db=publicDb();if(!db)throw Error('Supabase não configurado');
 const started=new Date(Date.now()-MARGIN_MS).toISOString(),now=new Date().toISOString();
 const range=async([from,to]:[string,string])=>{const rows:Offer[]=[];let after=from;
  for(;;){const cursor=after;
   const page=()=>{let q=db.from('catalog_offers').select(LIST_FIELDS).eq('available',true).gt('expires_at',now).lt('id',to);q=rows.length?q.gt('id',cursor):q.gte('id',cursor);return q.order('id').limit(PAGE);};
   const {data,error}=await withRetry(page);if(error)throw error;
   const got=data as unknown as Offer[];rows.push(...got);if(got.length<PAGE)return rows;after=got[got.length-1].id;}};
 const parts=await Promise.all(ranges.map(range));
 return {offers:parts.flat(),at:Date.now(),since:started};
}
const shardCache=SHARDS.map((ranges,i)=>unstable_cache(async()=>{const encoded=encodeSnapshot(await fetchRanges(ranges));return encoded.length<=SHARD_LIMIT?encoded:'';},['baixou-public-catalog-shard-v2',String(i),JSON.stringify(ranges),LIST_FIELDS,process.env.NEXT_PUBLIC_SUPABASE_URL??'unconfigured'],{revalidate:120}));
// Cada fatia: Data Cache se couber e tiver até SNAPSHOT_MAX_MS (a revalidação stale-while-revalidate pode devolver
// uma versão antiga; cada oferta continua conferida pelo próprio expires_at e o delta vem logo depois, em segundo
// plano); senão leitura direta só daquela fatia.
async function loadShard(i:number):Promise<{snap:CatalogSnapshot;bytes:number}>{
 try{const encoded=await shardCache[i]();if(encoded){const snap=decodeSnapshot(encoded);if(Date.now()-snap.at<=SNAPSHOT_MAX_MS)return {snap,bytes:encoded.length};}}catch{/* Data Cache indisponível */}
 return {snap:await fetchRanges(SHARDS[i]),bytes:0};
}
async function fullLoad():Promise<State>{
 const t=performance.now(),shards=await Promise.all(SHARDS.map((_,i)=>loadShard(i)));
 const offers:Offer[]=shards.flatMap(x=>x.snap.offers),oldest=shards.reduce((a,x)=>x.snap.at<a.snap.at?x:a);
 const at=Date.now(),map=new Map(offers.map(o=>[o.id,o]));
 // O relógio da fatia mais antiga vale para o conjunto: o delta seguinte cobre tudo o que mudou desde ela.
 return {offers:map,fullAt:at,deltaAt:oldest.snap.at,since:oldest.snap.since,index:buildIndex(offers,at),meta:state?.meta??null,metaAt:state?.metaAt??0,stats:{fullMs:Math.round(performance.now()-t),snapshotBytes:shards.reduce((n,x)=>n+x.bytes,0),snapshotAgeS:Math.round((at-oldest.snap.at)/1000)}};
}
// Delta paginado: o PostgREST corta cada resposta em 1.000 linhas (max-rows), então o antigo limit(5000) perdia o
// restante em silêncio — inclusive ofertas que deixaram de estar disponíveis. Cursor por id até esgotar.
const DELTA_PAGE=1000;
async function deltaLoad(s:State):Promise<State>{
 const db=publicDb();if(!db)throw Error('Supabase não configurado');
 const t=performance.now(),next=new Date(Date.now()-MARGIN_MS).toISOString(),rows:Offer[]=[];
 for(let cursor='';;){const c=cursor;
  const r=await withRetry(()=>{const q=db.from('catalog_offers').select(LIST_FIELDS).or(`checked_at.gt.${s.since},last_attempt_at.gt.${s.since},market_checked_at.gt.${s.since}`);return (c?q.gt('id',c):q).order('id').limit(DELTA_PAGE);});
  if(r.error)throw r.error;const got=r.data as unknown as Offer[];rows.push(...got);
  if(got.length<DELTA_PAGE)break;cursor=got[got.length-1].id;
  if(rows.length>=20000)throw Error('delta excessivo');// algo anômalo: a carga completa é mais barata
 }
 const offers=new Map(s.offers);for(const o of rows){if(o.available)offers.set(o.id,o);else offers.delete(o.id);}
 const at=Date.now();
 return {...s,cardIndex:undefined,pixIndex:undefined,offers,deltaAt:at,since:next,index:buildIndex([...offers.values()],at),stats:{...s.stats,deltaMs:Math.round(performance.now()-t),deltaRows:rows.length}};
}
// Índice por modalidade: o do cartão é montado sob demanda a partir das ofertas projetadas no cartão (preço total no
// cartão, habitual e lojas comparadas no cartão) e só contém ofertas com preço no cartão informado pela loja.
// all = catálogo unificado (nada excluído; ordenação/Score pelo preço principal à vista). pix = só preços à vista/Pix
// (exclui preços do ML sem Pix explícito). card = só ofertas com total no cartão.
function indexFor(s:State,pay:Payment|'all'):CatalogIndex{if(pay==='all')return s.index;
 if(pay==='pix'){if(!s.pixIndex){const cash=[...s.offers.values()].filter(o=>o.store!=='mercadolivre'||o.payment_basis==='cash');s.pixIndex={...buildIndex(cash,s.deltaAt),withoutCard:s.offers.size-cash.length};}return s.pixIndex;}
 if(!s.cardIndex){const projected=[...s.offers.values()].map(o=>offerForPayment(o,'card')).filter((o):o is Offer=>!!o);s.cardIndex={...buildIndex(projected,s.deltaAt),withoutCard:s.offers.size-projected.length};}
 return s.cardIndex;}
// Atualização do índice fora do caminho do usuário: com um índice de até STALE_MAX_MS na memória, a resposta sai
// dele na hora (validade conferida por oferta na consulta) e o delta/carga completa roda depois da resposta (after).
// Só espera o banco quando não há índice (instância nova sem snapshot recente) ou ele passou de STALE_MAX_MS.
function refresh(now:number):Promise<State>{
 inflight??=(async()=>{try{state=!state||now-state.fullAt>=FULL_MS?await fullLoad():await deltaLoad(state).catch(()=>fullLoad());return state;}finally{inflight=null;}})();
 return inflight;
}
function inBackground(p:Promise<unknown>){p.catch(e=>console.error('catálogo: atualização em segundo plano',e instanceof Error?e.message:e));try{afterResponse(()=>p.catch(()=>{}));}catch{/* fora de uma requisição (testes/scripts) */}}
export async function catalogIndex(pay:Payment|'all'='all'):Promise<CatalogIndex>{
 const now=Date.now();
 if(state&&now-state.fullAt<FULL_MS&&now-state.deltaAt<DELTA_MS)return indexFor(state,pay);
 if(state&&now-state.deltaAt<STALE_MAX_MS){inBackground(refresh(now));return indexFor(state,pay);}
 try{const s=await refresh(now);
  // Instância nova iniciada por um snapshot compartilhado recente, mas não atual: delta logo em seguida.
  if(Date.now()-s.deltaAt>=DELTA_MS)inBackground(refresh(Date.now()));
  return indexFor(s,pay);}catch(e){if(state)return indexFor(state,pay);throw e;}// falha de leitura: mantém o índice anterior (a validade continua sendo conferida na consulta)
}
export async function catalogMeta():Promise<Meta|null>{
 if(state?.meta&&Date.now()-state.metaAt<META_MS)return state.meta;
 if(state?.meta&&Date.now()-state.metaAt<STALE_MAX_MS){inBackground(loadMeta());return state.meta;}
 return loadMeta();
}
async function loadMeta():Promise<Meta|null>{
 metaInflight??=(async()=>{try{const db=publicDb();if(!db)return null;
  const [sources,stores,coverage]=await Promise.all([withRetry(()=>db.from('source_status').select('*')),withRetry(()=>db.from('store_registry').select('id,name,homepage,status,marketplace,test_product_url,verified_at').order('name')),withRetry(()=>db.rpc('catalog_coverage'))]);
  if(sources.error)throw sources.error;const meta={sources:sources.data as SourceStatus[],stores:(stores.data??[]) as StoreRecord[],coverage:coverage.data??null};if(state){state.meta=meta;state.metaAt=Date.now();}return meta;}finally{metaInflight=null;}})();
 try{return await metaInflight;}catch{return state?.meta??null;}
}
export function catalogStats(){return state?{offers:state.offers.size,fullAgeS:Math.round((Date.now()-state.fullAt)/1000),deltaAgeS:Math.round((Date.now()-state.deltaAt)/1000),buildMs:state.index.buildMs,...state.stats}:null;}
