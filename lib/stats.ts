// Estatísticas de RAM e placas de vídeo. Regras:
// - grupos só reúnem produtos equivalentes (geração, capacidade, módulo × kit e divisão do kit; GPU exata + VRAM);
//   atributo desconhecido exclui o anúncio do grupo (nunca é presumido);
// - retrato atual usa somente preço à vista/Pix comparável e ofertas dentro do TTL;
// - variação usa painel de amostra consistente: só anúncios observados no dia-base E recentemente.
import {offerFacets} from './specs';
import {independentSeller} from './search';
import {median} from './history';
import type {Offer} from './types';
import {excludedCondition} from './product-policy';
export type StatOffer=Pick<Offer,'id'|'store'|'title'|'category'|'brand'|'specs'|'variant'|'price'|'url'|'seller'|'seller_key'|'payment_basis'|'available'|'expires_at'|'image'|'verification_status'>;
export type GroupKey={key:string;label:string;order:number[];gb?:number;tier?:string};
export function ramGroup(o:StatOffer):GroupKey|null{
 const f=offerFacets(o),ddr=Number(f.ddr),total=Number(f.total_gb),modules=Number(f.modules),per=Number(f.per_module_gb);
 if(!ddr||!total)return null;
 let kind:string;
 if(modules>1&&per)kind='kit '+modules+'×'+per+' GB';
 else if(/\bkit\b/i.test(o.title))return null;// kit sem divisão identificável: não presumir
 else kind='módulo';
 // Memória de servidor (ECC/registrada) não se compara com módulos comuns.
 const form=/\b(ecc|rdimm|registered|registrada|server|servidor)\b/i.test(o.title)?'servidor':f.form_factor==='notebook'?'notebook':'desktop';
 return {key:['ddr'+ddr,form,kind,total].join('|'),label:'DDR'+ddr+' · '+total+' GB · '+kind,order:[ddr,form==='notebook'?1:form==='servidor'?2:0,total,modules>1?modules:1],gb:total,tier:'DDR'+ddr+' '+form};
}
const GPU_ORDER=(m:string)=>{const n=Number(m.match(/\d{3,4}/)?.[0]??0),suffix=/Ti Super/.test(m)?3:/Ti|XTX/.test(m)?2:/Super|XT|GRE/.test(m)?1:0;return n*10+suffix;};
export function gpuGroup(o:StatOffer):GroupKey|null{const f=offerFacets(o),model=f.gpu_model?String(f.gpu_model):'',vram=Number(f.vram_gb);if(!model||!vram)return null;const vendor=String(f.chip_vendor??'');return {key:model+'|'+vram,label:model+' · '+vram+' GB',order:[vendor==='nvidia'?0:vendor==='amd'?1:2,GPU_ORDER(model),vram],tier:vram+' GB'};}
// Recorte editorial APENAS de Estatísticas. Catálogo, alertas e grupos do Score conservam todas as categorias.
export function statsGroup(o:StatOffer,c:'ram'|'gpu'):GroupKey|null{
 if(excludedCondition(o.title))return null;
 const f=offerFacets(o);
 if(c==='ram'){
  if(![4,5].includes(Number(f.ddr))||Number(f.total_gb)<8||!Number(f.total_gb)||f.form_factor!=='desktop')return null;
  const g=ramGroup(o);return g?.tier?.endsWith('desktop')?g:null;
 }
 const model=String(f.gpu_model??''),n=Number(model.match(/\d{3,4}/)?.[0]);
 return (/^RTX /.test(model)&&n>=2050&&n%100>=50||/^RX /.test(model)&&n>=5000)?gpuGroup(o):null;
}
// Estatísticas verificadas: preço à vista comparável e NUNCA preço apenas anunciado pela loja (canais no Telegram).
export const cashComparable=(o:Pick<Offer,'store'|'payment_basis'>&{verification_status?:string|null})=>o.verification_status!=='announced'&&(o.payment_basis==='cash'||o.store!=='mercadolivre');
export const isLive=(o:Pick<Offer,'available'|'expires_at'>,now=Date.now())=>o.available&&Date.parse(o.expires_at)>now;
export type Snapshot={key:string;label:string;tier?:string;offers:number;sellers:number;brands:number;low:number;median:number;high:number;perGbLow?:number;perGbMedian?:number;best:{id:string;title:string;store:string;seller:string;url:string;price:number};ids:string[];order:number[]};
export function snapshot(offers:StatOffer[],group:(o:StatOffer)=>GroupKey|null,now=Date.now()):Snapshot[]{
 const map=new Map<string,{g:GroupKey;list:StatOffer[]}>();
 for(const o of offers){if(!isLive(o,now)||!cashComparable(o))continue;const g=group(o);if(!g)continue;const e=map.get(g.key)??{g,list:[]};e.list.push(o);map.set(g.key,e);}
 return [...map.values()].map(({g,list})=>{const prices=list.map(o=>Number(o.price)),best=list.reduce((a,b)=>Number(b.price)<Number(a.price)?b:a);
  return {key:g.key,label:g.label,tier:g.tier,offers:list.length,sellers:new Set(list.map(independentSeller)).size,brands:new Set(list.map(o=>(o.brand??'').toLowerCase()).filter(Boolean)).size,low:Math.min(...prices),median:median(prices)!,high:Math.max(...prices),
   ...(g.gb?{perGbLow:Math.min(...prices)/g.gb,perGbMedian:median(prices)!/g.gb}:{}),best:{id:best.id,title:best.title,store:best.store,seller:best.seller,url:best.url,price:Number(best.price)},ids:list.map(o=>o.id),order:g.order};})
  .sort((a,b)=>{for(let i=0;i<Math.max(a.order.length,b.order.length);i++){const d=(a.order[i]??0)-(b.order[i]??0);if(d)return d;}return a.label.localeCompare(b.label);});
}
export type ChangeRow={offer_id:string;base_day:string|null;base_price:number|null;last_day:string;last_price:number};
export type Panel={offers:number;median:number|null;down:number;up:number;stable:number};
export const MOVE=0.02;// variação mínima para contar como queda/alta (abaixo disso: estável)
export function panel(rows:ChangeRow[],recentDay:string):{panel:Panel;changes:Map<string,number>}{
 const changes=new Map<string,number>();for(const r of rows){if(r.base_price==null||!r.base_day||r.last_day<recentDay||r.base_day>=r.last_day)continue;const b=Number(r.base_price),l=Number(r.last_price);if(b>0&&l>0)changes.set(r.offer_id,l/b-1);}
 const v=[...changes.values()];return {panel:{offers:v.length,median:median(v),down:v.filter(x=>x<=-MOVE).length,up:v.filter(x=>x>=MOVE).length,stable:v.filter(x=>Math.abs(x)<MOVE).length},changes};
}
export function groupPanel(ids:string[],changes:Map<string,number>):Panel{const v=ids.map(id=>changes.get(id)).filter((x):x is number=>x!==undefined);return {offers:v.length,median:median(v),down:v.filter(x=>x<=-MOVE).length,up:v.filter(x=>x>=MOVE).length,stable:v.filter(x=>Math.abs(x)<MOVE).length};}
// Índice encadeado (base 100): multiplica a mediana diária das razões dia/dia anterior. Dia com menos de
// `minOffers` anúncios pareados interrompe a série (null) em vez de estimar.
export function chainIndex(rows:{day:string;offers:number;ratio:number|null}[],minOffers=5){let level=100,started=false;return rows.map(r=>{if(!started){started=true;return {day:r.day,value:100,offers:r.offers};}if(r.ratio==null||r.offers<minOffers){return {day:r.day,value:null as number|null,offers:r.offers};}level*=Number(r.ratio);return {day:r.day,value:level,offers:r.offers};});}
// Série diária de grupo (RPC group_daily). "Menor" = menor preço observado no dia (pode cair só porque entrou um
// anúncio mais barato: é o que estava disponível). "Típico" = nível encadeado: começa na mediana dos menores diários
// e evolui pela mediana das variações dos MESMOS anúncios de um dia para o outro; com menos de `minPairs` pares a
// linha é interrompida e recomeça na mediana do dia seguinte (novo trecho, sem ligar os pontos).
export type GroupDay={day:string;offers:number;lowest:number;lowest_offer:string;median_low:number;pairs:number;ratio:number|null};
export type GroupPoint=GroupDay&{typical:number|null;segment:number};
export function consistentSeries(days:GroupDay[],minPairs=3,minOffers=3):GroupPoint[]{
 let level:number|null=null,segment=0;
 return [...days].sort((a,b)=>a.day.localeCompare(b.day)).map(d=>{
  if(level!=null&&d.ratio!=null&&d.pairs>=minPairs)level=level*Number(d.ratio);
  else if(d.offers>=minOffers){if(level!=null)segment++;level=Number(d.median_low);}
  else{if(level!=null)segment++;level=null;}
  return {...d,lowest:Number(d.lowest),median_low:Number(d.median_low),ratio:d.ratio==null?null:Number(d.ratio),typical:level,segment};
 });
}
// Variação do preço típico entre o primeiro e o último ponto do MESMO trecho contínuo (amostra consistente).
export function typicalChange(points:GroupPoint[]){const last=points.filter(p=>p.typical!=null).at(-1);if(!last)return null;const first=points.find(p=>p.segment===last.segment&&p.typical!=null)!;return first.day===last.day?null:{from:first.day,to:last.day,change:last.typical!/first.typical!-1};}
