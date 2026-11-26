// Estado do catálogo <-> parâmetros de URL. O mesmo formato vale para a API (/api/catalog?...) e para a barra de
// endereço da página, então voltar de um produto restaura busca, categoria, filtros, ordenação e modalidade.
// modo, cat, q, lojas (a,b), max, desc, cmp=1, ordem, f (chave:v1|v2;chave2:v), n (itens carregados).
import type {CatalogParams,Mode} from './catalog-query';
export type CatalogState={mode?:Mode;category:string;q:string;stores:string[];maxPrice:string;minDiscount:number;comparable:boolean;sort:'quality'|'discount'|'price'|'recent';facets:Record<string,string[]>;count:number};
export const DEFAULT_STATE:CatalogState={category:'all',q:'',stores:[],maxPrice:'',minDiscount:5,comparable:false,sort:'quality',facets:{},count:48};
const MODES=['market','history','retailer','all'],SORTS=['quality','discount','price','recent'];
const clean=(s:string|null,max=80)=>(s??'').slice(0,max);
export function encodeFacets(f:Record<string,string[]>){return Object.entries(f).filter(([,v])=>v.length).map(([k,v])=>k+':'+v.join('|')).join(';');}
export function decodeFacets(s:string|null){const out:Record<string,string[]>={};for(const part of clean(s,400).split(';')){const i=part.indexOf(':');if(i<1)continue;const k=part.slice(0,i).replace(/[^a-z_]/g,''),v=part.slice(i+1).split('|').map(x=>x.slice(0,40)).filter(Boolean).slice(0,20);if(k&&v.length)out[k]=v;}return out;}
export function stateFromSearch(sp:URLSearchParams):CatalogState{
 const mode=sp.get('modo'),sort=sp.get('ordem'),desc=Number(sp.get('desc')),n=Number(sp.get('n'));
 return {mode:MODES.includes(mode??'')?mode as Mode:undefined,category:clean(sp.get('cat'),20)||'all',q:clean(sp.get('q')),stores:clean(sp.get('lojas'),200).split(',').filter(Boolean).slice(0,30),
  maxPrice:/^\d{1,7}$/.test(sp.get('max')??'')?sp.get('max')!:'',minDiscount:desc>=5&&desc<=90?Math.round(desc/5)*5:5,comparable:sp.get('cmp')==='1',
  sort:SORTS.includes(sort??'')?sort as CatalogState['sort']:'quality',facets:decodeFacets(sp.get('f')),count:Number.isInteger(n)&&n>48&&n<=480?n:48};
}
// Só grava o que difere do padrão: URL curta e cache de borda compartilhado pelo estado inicial.
export function searchFromState(s:CatalogState,{includeCount=true}={}){
 const sp=new URLSearchParams();
 if(s.mode)sp.set('modo',s.mode);if(s.category!=='all')sp.set('cat',s.category);if(s.q.trim())sp.set('q',s.q.trim());if(s.stores.length)sp.set('lojas',s.stores.join(','));
 if(s.maxPrice)sp.set('max',s.maxPrice);if(s.minDiscount!==5)sp.set('desc',String(s.minDiscount));if(s.comparable)sp.set('cmp','1');if(s.sort!=='quality')sp.set('ordem',s.sort);
 const f=encodeFacets(s.facets);if(f)sp.set('f',f);if(includeCount&&s.count>48)sp.set('n',String(s.count));
 return sp;
}
export function parseCatalogParams(sp:URLSearchParams):CatalogParams{
 const s=stateFromSearch(sp),off=Number(sp.get('o')),lim=Number(sp.get('l'));
 return {mode:s.mode,category:s.category,q:s.q,stores:s.stores,maxPrice:Number(s.maxPrice)||undefined,minDiscount:s.minDiscount,comparable:s.comparable,sort:s.sort,facets:s.facets,
  offset:Number.isInteger(off)&&off>=0&&off<5000?off:0,limit:Number.isInteger(lim)&&lim>0?Math.min(lim,480):48};
}
