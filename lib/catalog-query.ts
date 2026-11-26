// Catálogo no SERVIDOR: modalidade, busca, filtros técnicos, contagens, ordenação e paginação.
// Mesmo pipeline que o cliente usava (catalogSelection + consolidateOffers + offerFacets + Baixou Score), executado
// uma vez por consulta sobre um índice pré-calculado. O visitante recebe só a página pedida (48 cards) e as contagens,
// em vez de baixar e processar o catálogo inteiro (medição de 26/11: 9 requisições, 5,8 MB de JSON).
// Ofertas vencidas nunca entram: a validade é conferida no momento da consulta, não na montagem do índice.
import {offerFacets,FACETS,facetLabel,type SpecValue} from './specs';
import {effectiveDiscount,effectiveEvidence,type Evidence} from './market';
import {baixouScore,isOpportunity,SCORE_RANK,type BaixouScore} from './score';
import {comparisonIndex,consolidateOffers,matchesQuery,sameProduct} from './search';
import {groupReferences,type GroupReference} from './groups';
import {departmentOptions} from './departments';
import {normalize,type Offer} from './types';

export type Mode='market'|'history'|'retailer'|'all';
export type Entry={o:Offer;facets:Record<string,SpecValue>;score:BaixouScore;ev:Evidence;disc:number;group:GroupReference|null;compare:Offer[]|null;completeness:number;text:string};
export type CatalogIndex={entries:Entry[];byId:Map<string,Entry>;departments:ReturnType<typeof departmentOptions>;builtAt:number;buildMs:number};
const isLive=(o:Offer,now:number)=>o.available&&Date.parse(o.expires_at)>now;

export function buildIndex(offers:Offer[],now=Date.now()):CatalogIndex{
 const t=performance.now(),live=offers.filter(o=>isLive(o,now));
 const groups=groupReferences(live,now),comparisons=comparisonIndex(live);
 const entries=live.map(o=>{const group=groups.get(o.id)??null;return {o,facets:offerFacets(o),score:baixouScore({...o,group},now),ev:effectiveEvidence(o),disc:effectiveDiscount(o),group,compare:comparisons.get(o.id)??null,
  completeness:Number(!!o.image)+Number(!!o.brand)+Math.min(Object.keys(o.specs??{}).length,5)/5,text:normalize(o.title)};});
 return {entries,byId:new Map(entries.map(e=>[e.o.id,e])),departments:departmentOptions(live,now),builtAt:now,buildMs:Math.round(performance.now()-t)};
}

export type CatalogParams={mode?:Mode;category?:string;q?:string;stores?:string[];maxPrice?:number;minDiscount?:number;comparable?:boolean;sort?:'quality'|'discount'|'price'|'recent';facets?:Record<string,string[]>;offset?:number;limit?:number};
function inMode(e:Entry,mode:Mode,minDiscount:number){
 if(mode==='all')return true;
 if(mode==='market')return isOpportunity(e.score);
 if(mode==='history')return e.ev==='history'&&e.disc>=minDiscount;
 return e.ev!=='none'&&e.disc>=minDiscount;
}
// Mesma ordem padrão de lib/opportunities.ts, com o Score já calculado (inclui o freio por alternativas equivalentes).
function compareEntries(a:Entry,b:Entry,q:string){
 const rel=(e:Entry)=>q&&e.text.includes(q)?1:0;
 return rel(b)-rel(a)||SCORE_RANK[b.score.klass]-SCORE_RANK[a.score.klass]||(b.score.score??-1)-(a.score.score??-1)||
  (b.score.confidence==='alta'?2:b.score.confidence==='média'?1:0)-(a.score.confidence==='alta'?2:a.score.confidence==='média'?1:0)||
  Number(!!b.o.product_id)-Number(!!a.o.product_id)||b.completeness-a.completeness||Date.parse(b.o.checked_at)-Date.parse(a.o.checked_at)||a.o.id.localeCompare(b.o.id);
}
// Lista de produtos únicos (o anúncio mais barato de cada modelo exato), como consolidateOffers no cliente.
function select(index:CatalogIndex,live:Entry[],mode:Mode,p:CatalogParams){
 const min=p.minDiscount??5;
 const rows=live.filter(e=>inMode(e,mode,min)&&(!p.stores?.length||p.stores.includes(e.o.store))&&(!p.maxPrice||e.o.price<=p.maxPrice)&&(!p.q||matchesQuery(e.o,p.q)));
 return consolidateOffers(rows.map(e=>e.o)).map(o=>index.byId.get(o.id)!);
}
const facetMatch=(e:Entry,facets:Record<string,string[]>,skip?:string)=>Object.entries(facets).every(([k,vals])=>k===skip||!vals.length||vals.includes(String(e.facets[k])));

export function queryCatalog(index:CatalogIndex,p:CatalogParams,now=Date.now()){
 const live=index.entries.filter(e=>isLive(e.o,now));
 // Sem escolha explícita: modalidade Baixou! quando há oportunidade; senão, catálogo completo pelo Score.
 const mode:Mode=p.mode??(live.some(e=>isOpportunity(e.score))?'market':'all');
 const facets=p.facets??{},category=p.category&&p.category!=='all'?p.category:'all',q=p.q?.trim()??'';
 const params={...p,q};
 const cache=new Map<Mode,Entry[]>();const sel=(m:Mode)=>{let r=cache.get(m);if(!r){r=select(index,live,m,params);cache.set(m,r);}return r;};
 const eligibleAll=sel(mode),eligible=p.comparable?eligibleAll.filter(e=>e.compare):eligibleAll;
 const counts:Record<string,number>={all:eligible.length};for(const e of eligible)counts[e.o.category]=(counts[e.o.category]??0)+1;
 const inCat=(rows:Entry[])=>rows.filter(e=>(!p.comparable||e.compare)&&(category==='all'||e.o.category===category)&&facetMatch(e,facets)).length;
 const modeCounts={market:inCat(sel('market')),history:inCat(sel('history')),retailer:inCat(sel('retailer')),all:inCat(sel('all'))};
 const inCategory=eligible.filter(e=>category==='all'||e.o.category===category);
 const facetOptions=(FACETS[category]??[]).map(def=>{const c=new Map<string,{value:SpecValue;count:number}>();for(const e of inCategory){if(!facetMatch(e,facets,def.key))continue;const v=e.facets[def.key];if(v===undefined)continue;const k=String(v),x=c.get(k);if(x)x.count++;else c.set(k,{value:v,count:1});}
  const options=[...c.entries()].map(([key,x])=>({key,label:facetLabel(def.key,x.value),count:x.count})).sort((a,b)=>def.numeric?Number(a.key)-Number(b.key):b.count-a.count||a.label.localeCompare(b.label));
  return {key:def.key,label:def.label,options};}).filter(f=>f.options.length>1||(facets[f.key]?.length??0)>0);
 const qn=normalize(q),sort=p.sort??'quality';
 const filtered=inCategory.filter(e=>facetMatch(e,facets)).sort((a,b)=>sort==='price'?a.o.price-b.o.price||a.o.id.localeCompare(b.o.id):sort==='recent'?Date.parse(b.o.checked_at)-Date.parse(a.o.checked_at):sort==='discount'?b.disc-a.disc||compareEntries(a,b,qn):compareEntries(a,b,qn));
 const offset=Math.max(0,p.offset??0),limit=Math.min(Math.max(1,p.limit??48),480);
 return {mode,total:filtered.length,offset,items:filtered.slice(offset,offset+limit).map(cardPayload),counts,modeCounts,facets:facetOptions,comparableCount:eligibleAll.filter(e=>e.compare).length,live:live.length};
}

// Card: sem ficha técnica nem galeria (a página do produto busca o registro completo). Score e comparação já prontos.
export type CardOffer=Omit<Offer,'specs'|'images'>&{specs:Record<string,string>;images:string[];score:BaixouScore;compare:{count:number;lowest:number;lowestStore:string}|null};
export function cardPayload(e:Entry):CardOffer{
 const {specs:_s,images:_i,...rest}=e.o as Offer&{images?:string[]};void _s;void _i;
 return {...rest,specs:{},images:[],score:e.score,compare:e.compare?{count:e.compare.length,lowest:Number(e.compare[0].price),lowestStore:e.compare[0].store}:null};
}
// Lista de desejos: anúncio ativo mais barato do mesmo produto (ou o próprio) para cada id salvo.
export function currentForSaved(index:CatalogIndex,saved:Offer[],now=Date.now()){
 return saved.map(s=>{let best:Entry|null=null;for(const e of index.entries){if(!isLive(e.o,now))continue;if(e.o.id===s.id||sameProduct(s,e.o)){if(!best||e.o.price<best.o.price)best=e;}}return best?cardPayload(best):null;});
}
export {facetLabel};
