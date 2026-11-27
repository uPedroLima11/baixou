// Estatísticas (painel): dados calculados no servidor, compartilhados pela página (HTML já com o conteúdo) e pela API.
// Grupos = configurações reais de compra: RAM por geração + uso (desktop/notebook/servidor) + módulo × kit (divisão)
// + capacidade total; GPU por modelo + VRAM. Preços são do módulo/kit/placa inteiros (nunca R$/GB como métrica
// principal). Só preço verificado à vista/Pix comparável; anúncio apenas divulgado (Telegram) nunca entra.
// Variação do período: mesma amostra consistente (mesmo anúncio no início e no fim; RPC price_changes).
import {publicDb} from './supabase';
import {withRetry} from './db-retry';
import {catalogIndex} from './catalog-server';
import {offerFacets,facetLabel} from './specs';
import {statsGroup,cashComparable,isLive,panel,type ChangeRow,type StatOffer} from './stats';
import {independentSeller} from './search';
import {median,spDay,DAY} from './history';
import type {Offer} from './types';

export type StatsCategory='ram'|'gpu';
export type StatsFilters=Record<string,string>;
// Filtros aceitos por categoria (chave = faceta de lib/specs.ts, exceto form/kind/chip derivados do grupo).
export const STATS_FILTERS:Record<StatsCategory,{key:string;label:string}[]>={
 ram:[{key:'ddr',label:'Geração'},{key:'kind',label:'Módulo/kit'},{key:'total_gb',label:'Capacidade'},{key:'frequency',label:'Frequência'},{key:'brand',label:'Marca'}],
 gpu:[{key:'chip_vendor',label:'Chip'},{key:'gpu_model',label:'GPU'},{key:'vram_gb',label:'VRAM'},{key:'brand',label:'Fabricante da placa'}],
};
type Facts={group:{key:string;label:string;order:number[];tier?:string;gb?:number};values:Record<string,string>};
export function statFacts(o:StatOffer,c:StatsCategory):Facts|null{
 const g=statsGroup(o,c);if(!g)return null;const f=offerFacets(o),v:Record<string,string>={};
 if(c==='ram'){v.ddr=String(f.ddr);v.form=g.tier!.split(' ')[1];v.kind=Number(f.modules)>1?'kit':'módulo';v.total_gb=String(f.total_gb);if(f.frequency)v.frequency=String(f.frequency);}
 else{if(f.chip_vendor)v.chip_vendor=String(f.chip_vendor);v.gpu_model=String(f.gpu_model);v.vram_gb=String(f.vram_gb);}
 if(f.brand)v.brand=String(f.brand);
 return {group:g,values:v};
}
const passes=(x:Facts,f:StatsFilters)=>Object.entries(f).every(([k,want])=>!want||x.values[k]===want);
const optionLabel=(k:string,v:string)=>k==='form'||k==='kind'?v.charAt(0).toUpperCase()+v.slice(1):facetLabel(k==='frequency'?'frequency':k,['total_gb','vram_gb','frequency'].includes(k)?Number(v):v);

export type Pick={id:string;title:string;store:string;seller:string;price:number};
export type StatGroup={key:string;label:string;tier:string;offers:number;sellers:number;low:Pick;median:number;high:number;change:{pct:number;abs:number;paired:number}|null};
export type StatsResult={payment?:'pix'|'card';category:StatsCategory;generatedAt:number;days:number;windows:number[];firstDay:string|null;historyDays:number;
 filters:{key:string;label:string;options:{value:string;label:string;count:number}[]}[];applied:StatsFilters;
 groups:StatGroup[];moves:{down:Move[];up:Move[]};sample:{live:number;grouped:number;stores:number;paired:number}};
export type Move={id:string;title:string;store:string;seller:string;base:number;last:number;change:number};

// pay='card': índice do cartão (ofertas projetadas no total no cartão) e resumo diário SÓ do cartão (price_changes_card).
// Histórico do cartão começa em 26–27/11/2026; nenhum dia vem do Pix.
// Primeiro dia do histórico (muda uma vez por dia) e variações do período (resumo diário): memória da instância.
// A variação usa dias completos, então 10 min de memória não altera o resultado do dia; falha não fica memorizada.
const memo=new Map<string,{at:number;p:Promise<unknown>}>();
function remember<T>(key:string,ms:number,run:()=>Promise<T>):Promise<T>{const hit=memo.get(key);if(hit&&Date.now()-hit.at<ms)return hit.p as Promise<T>;
 const p=run();memo.set(key,{at:Date.now(),p});p.catch(()=>memo.delete(key));if(memo.size>200)for(const [k,v] of memo)if(Date.now()-v.at>ms)memo.delete(k);return p;}
function loadFirstDay(pay:'pix'|'card'){return remember('first:'+pay,3600000,async()=>{const db=publicDb()!;const r=await withRetry(()=>(pay==='card'?db.from('price_daily').select('day').not('card_min_cents','is',null):db.from('price_daily').select('day')).order('day').limit(1));if(r.error)throw r.error;return r;});}
async function priceChanges(pay:'pix'|'card',ids:string[],days:number):Promise<ChangeRow[]>{const key=pay+':'+days+':'+ids.slice().sort().join(',');
 return remember('chg:'+key,600000,async()=>{const db=publicDb()!;const r=await withRetry(()=>db.rpc(pay==='card'?'price_changes_card':'price_changes',{p_ids:ids,p_days:days}));if(r.error)throw r.error;return r.data as ChangeRow[];});}
export async function buildStats(c:StatsCategory,applied:StatsFilters,daysWanted:number,pay:'pix'|'card'='pix'):Promise<StatsResult>{
 const db=publicDb();if(!db)throw Error('Supabase não configurado');
 const now=Date.now(),[index,first]=await Promise.all([catalogIndex(pay),loadFirstDay(pay)]);
 const live=index.entries.map(e=>e.o).filter(o=>o.category===c&&isLive(o,now)&&(pay==='card'?o.verification_status!=='announced':cashComparable(o))) as (Offer&StatOffer)[];
 const facts=new Map<string,Facts>();for(const o of live){const x=statFacts(o,c);if(x)facts.set(o.id,x);}
 // Opções de cada filtro respeitam os OUTROS filtros (contagens reais; valor desconhecido nunca vira opção).
 const filters=STATS_FILTERS[c].map(def=>{const counts=new Map<string,number>();for(const x of facts.values()){if(!passes(x,{...applied,[def.key]:''}))continue;const v=x.values[def.key];if(v)counts.set(v,(counts.get(v)??0)+1);}
  const numeric=['total_gb','vram_gb','frequency'].includes(def.key);
  return {key:def.key,label:def.label,options:[...counts].filter(([,n])=>def.key!=='brand'||n>=2).map(([value,count])=>({value,count,label:optionLabel(def.key,value)})).sort((a,b)=>numeric?Number(a.value)-Number(b.value):b.count-a.count||a.label.localeCompare(b.label,'pt-BR'))};}).filter(f=>f.options.length>1||applied[f.key]);
 const chosen=live.filter(o=>{const x=facts.get(o.id);return x&&passes(x,applied);});
 const byGroup=new Map<string,{g:Facts['group'];list:(Offer&StatOffer)[]}>();for(const o of chosen){const g=facts.get(o.id)!.group;const e=byGroup.get(g.key)??{g,list:[]};e.list.push(o);byGroup.set(g.key,e);}
 // Histórico disponível e janelas com dia-base real.
 if(first.error)throw first.error;
 const firstDay:string|null=first.data[0]?.day??null,today=spDay(now),historyDays=firstDay?Math.round((Date.parse(today)-Date.parse(firstDay))/DAY):0;
 const windows=[...(historyDays>=1&&historyDays<7?[historyDays]:[]),...[7,30,90,180,365].filter(d=>d<=historyDays)];
 const days=windows.includes(daysWanted)?daysWanted:windows[0]??0;
 let rows:ChangeRow[]=[];let changes=new Map<string,number>();
 if(days){const ids=chosen.map(o=>o.id).slice(0,600);rows=await priceChanges(pay,ids,days);changes=panel(rows,spDay(now-DAY)).changes;}
 const rowOf=new Map(rows.map(r=>[r.offer_id,r]));
 const pick=(o:Offer):Pick=>({id:o.id,title:o.title,store:o.store,seller:o.seller,price:Number(o.price)});
 const groups:(StatGroup&{order:number[]})[]=[...byGroup.values()].map(({g,list})=>{const prices=list.map(o=>Number(o.price)).sort((a,b)=>a-b),best=list.reduce((a,b)=>Number(b.price)<Number(a.price)?b:a);
  const paired=list.filter(o=>changes.has(o.id)),pcts=paired.map(o=>changes.get(o.id)!),abs=paired.map(o=>{const r=rowOf.get(o.id)!;return Number(r.last_price)-Number(r.base_price);});
  return {key:g.key,label:g.label,tier:g.tier??'',order:g.order,offers:list.length,sellers:new Set(list.map(independentSeller)).size,low:pick(best),median:median(prices)!,high:prices[prices.length-1],change:paired.length?{pct:median(pcts)!,abs:median(abs)!,paired:paired.length}:null};})
  .sort((a,b)=>{for(let i=0;i<Math.max(a.order.length,b.order.length);i++){const d=(a.order[i]??0)-(b.order[i]??0);if(d)return d;}return a.label.localeCompare(b.label);});
 const byId=new Map(chosen.map(o=>[o.id,o]));
 const move=(id:string,v:number):Move=>{const o=byId.get(id)!,r=rowOf.get(id)!;return {id,title:o.title,store:o.store,seller:o.seller,base:Number(r.base_price),last:Number(r.last_price),change:v};};
 const entries=[...changes.entries()].filter(([id])=>byId.has(id));
 return {payment:pay,category:c,generatedAt:now,days,windows,firstDay,historyDays,filters,applied,
  groups:groups.map(({order:_o,...g})=>{void _o;return g;}),
  moves:{down:entries.filter(([,v])=>v<=-0.02).sort((a,b)=>a[1]-b[1]).slice(0,6).map(([id,v])=>move(id,v)),up:entries.filter(([,v])=>v>=0.02).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([id,v])=>move(id,v))},
  sample:{live:live.length,grouped:chosen.length,stores:new Set(chosen.map(o=>o.store)).size,paired:changes.size}};
}
export function parseStatsQuery(sp:URLSearchParams){
 const c:StatsCategory=sp.get('c')==='gpu'?'gpu':'ram',applied:StatsFilters={};
 for(const {key} of STATS_FILTERS[c]){const v=(sp.get(key)??'').slice(0,40);if(v&&/^[\p{L}\p{N} .×-]{1,40}$/u.test(v))applied[key]=v;}
 const days=Number(sp.get('dias'))||7;return {c,applied,days,pay:(sp.get('pag')==='cartao'?'card':'pix') as 'pix'|'card'};
}
