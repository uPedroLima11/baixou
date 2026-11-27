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
import {encodeSnapshot,decodeSnapshot,type CatalogSnapshot} from './catalog-snapshot';

export const LIST_FIELDS='id,store,url,title,category,brand,mpn,image,price,original_price,available,seller,sold,rating,review_count,specs,checked_at,expires_at,historical_median,historical_samples,historical_days,discount,evidence,discoveries,coupon_hint,coupon_validated,payment_note,product_id,gtin,variant,last_attempt_at,verification_status,market_median,market_lowest,market_stores,market_highest,market_expires_at,market_checked_at,seller_key,payment_basis,historical_max,reference_median,reference_samples,reference_days,reference_min,reference_max,card_price,card_installments,card_installment_value,card_interest_free,card_reference_median,card_reference_samples,card_reference_days,card_reference_min,card_reference_max,card_historical_max,card_market_median,card_market_lowest,card_market_highest,card_market_stores,card_market_expires_at';
// Egress (cota gratuita 5 GB/mês): carga completa ~5,8 MB sem compressão; delta traz só as linhas alteradas desde a
// leitura anterior (margem de 45 s para relógio/réplica). Atualização sob demanda: sem visitas, nada é lido.
const FULL_MS=60*60000,DELTA_MS=120000,META_MS=120000,PAGE=400,MARGIN_MS=45000;
type Meta={sources:SourceStatus[];stores:StoreRecord[];coverage:{generated_at:string;stores:StoreCoverage[]}|null};
type State={cardIndex?:CatalogIndex;pixIndex?:CatalogIndex;offers:Map<string,Offer>;fullAt:number;deltaAt:number;since:string;index:CatalogIndex;meta:Meta|null;metaAt:number;stats:{fullMs?:number;deltaMs?:number;deltaRows?:number;snapshotBytes?:number;snapshotAgeS?:number}};
let state:State|null=null,inflight:Promise<State>|null=null,metaInflight:Promise<Meta|null>|null=null;

async function fetchSnapshot():Promise<CatalogSnapshot>{
 const db=publicDb();if(!db)throw Error('Supabase não configurado');
 const started=new Date(Date.now()-MARGIN_MS).toISOString(),now=new Date().toISOString();
 const offers:Offer[]=[];
 let after:string|undefined;
 // O cursor evita recontar a tabela e reler todos os offsets anteriores em cada consulta.
 for(;;){
  const query=db.from('catalog_offers').select(LIST_FIELDS).eq('available',true).gt('expires_at',now).order('id').limit(PAGE);
  const {data,error}=await (after?query.gt('id',after):query);
  if(error)throw error;
  const rows=data as unknown as Offer[];
  offers.push(...rows);
  if(rows.length<PAGE)break;
  after=rows[rows.length-1].id;
 }
 return {offers,at:Date.now(),since:started};
}
const sharedSnapshot=unstable_cache(async()=>{const encoded=encodeSnapshot(await fetchSnapshot());return encoded.length<=1800000?encoded:'';},['baixou-public-catalog-brotli-v1',LIST_FIELDS,process.env.NEXT_PUBLIC_SUPABASE_URL??'unconfigured'],{revalidate:120});
async function fullLoad():Promise<State>{
 const t=performance.now();let snapshot:CatalogSnapshot,bytes=0;
 try{const encoded=await sharedSnapshot();bytes=encoded.length;snapshot=encoded?decodeSnapshot(encoded):await fetchSnapshot();
  // A revalidação do Data Cache pode devolver uma versão antiga: não iniciar uma instância com snapshot >2 min.
  if(Date.now()-snapshot.at>DELTA_MS)snapshot=await fetchSnapshot();
 }catch{snapshot=await fetchSnapshot();}
 const at=Date.now(),offers=new Map(snapshot.offers.map(o=>[o.id,o]));
 return {offers,fullAt:at,deltaAt:snapshot.at,since:snapshot.since,index:buildIndex(snapshot.offers,at),meta:state?.meta??null,metaAt:state?.metaAt??0,stats:{fullMs:Math.round(performance.now()-t),snapshotBytes:bytes,snapshotAgeS:Math.round((at-snapshot.at)/1000)}};
}
async function deltaLoad(s:State):Promise<State>{
 const db=publicDb();if(!db)throw Error('Supabase não configurado');
 const t=performance.now(),next=new Date(Date.now()-MARGIN_MS).toISOString();
 const r=await db.from('catalog_offers').select(LIST_FIELDS).or(`checked_at.gt.${s.since},last_attempt_at.gt.${s.since},market_checked_at.gt.${s.since}`).limit(5000);
 if(r.error)throw r.error;
 const offers=new Map(s.offers);for(const o of r.data as unknown as Offer[]){if(o.available)offers.set(o.id,o);else offers.delete(o.id);}
 const at=Date.now();
 return {...s,cardIndex:undefined,pixIndex:undefined,offers,deltaAt:at,since:next,index:buildIndex([...offers.values()],at),stats:{...s.stats,deltaMs:Math.round(performance.now()-t),deltaRows:r.data.length}};
}
// Índice por modalidade: o do cartão é montado sob demanda a partir das ofertas projetadas no cartão (preço total no
// cartão, habitual e lojas comparadas no cartão) e só contém ofertas com preço no cartão informado pela loja.
// all = catálogo unificado (nada excluído; ordenação/Score pelo preço principal à vista). pix = só preços à vista/Pix
// (exclui preços do ML sem Pix explícito). card = só ofertas com total no cartão.
function indexFor(s:State,pay:Payment|'all'):CatalogIndex{if(pay==='all')return s.index;
 if(pay==='pix'){if(!s.pixIndex){const cash=[...s.offers.values()].filter(o=>o.store!=='mercadolivre'||o.payment_basis==='cash');s.pixIndex={...buildIndex(cash,s.deltaAt),withoutCard:s.offers.size-cash.length};}return s.pixIndex;}
 if(!s.cardIndex){const projected=[...s.offers.values()].map(o=>offerForPayment(o,'card')).filter((o):o is Offer=>!!o);s.cardIndex={...buildIndex(projected,s.deltaAt),withoutCard:s.offers.size-projected.length};}
 return s.cardIndex;}
export async function catalogIndex(pay:Payment|'all'='all'):Promise<CatalogIndex>{
 const now=Date.now();
 if(state&&now-state.fullAt<FULL_MS&&now-state.deltaAt<DELTA_MS)return indexFor(state,pay);
 inflight??=(async()=>{try{state=!state||now-state.fullAt>=FULL_MS?await fullLoad():await deltaLoad(state).catch(()=>fullLoad());return state;}finally{inflight=null;}})();
 try{return indexFor(await inflight,pay);}catch(e){if(state)return indexFor(state,pay);throw e;}// falha de leitura: mantém o índice anterior (a validade continua sendo conferida na consulta)
}
export async function catalogMeta():Promise<Meta|null>{
 if(state?.meta&&Date.now()-state.metaAt<META_MS)return state.meta;
 metaInflight??=(async()=>{try{const db=publicDb();if(!db)return null;
  const [sources,stores,coverage]=await Promise.all([db.from('source_status').select('*'),db.from('store_registry').select('id,name,homepage,status,marketplace,test_product_url,verified_at').order('name'),db.rpc('catalog_coverage')]);
  if(sources.error)throw sources.error;const meta={sources:sources.data as SourceStatus[],stores:(stores.data??[]) as StoreRecord[],coverage:coverage.data??null};if(state){state.meta=meta;state.metaAt=Date.now();}return meta;}finally{metaInflight=null;}})();
 try{return await metaInflight;}catch{return state?.meta??null;}
}
export function catalogStats(){return state?{offers:state.offers.size,fullAgeS:Math.round((Date.now()-state.fullAt)/1000),deltaAgeS:Math.round((Date.now()-state.deltaAt)/1000),buildMs:state.index.buildMs,...state.stats}:null;}
