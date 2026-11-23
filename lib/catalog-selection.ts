import {consolidateOffers,matchesQuery} from './search';
import {effectiveDiscount,effectiveEvidence,marketStatus} from './market';
import type {Offer} from './types';
// verified=true: só quedas comprovadas no histórico. market=true: só abaixo do preço de mercado (>=2 outras lojas).
// Ambos falsos: inclui também descontos anunciados. O desconto considerado é o efetivo (lib/market.ts),
// então um preço riscado nunca vale mais do que a diferença real para outras lojas.
export type CatalogFilters={verified:boolean;market?:boolean;savedOnly?:boolean;stores?:string[];maxPrice?:number;minDiscount:number;query:string};
function inMode(o:Offer,f:CatalogFilters){if(f.market)return marketStatus(o)==='below';const ev=effectiveEvidence(o);if(f.verified)return ev==='history';return ev!=='none';}
// Both facets and cards consume this exact eligibility + grouping pipeline.
export function catalogSelection(offers:Offer[],filters:CatalogFilters,now=Date.now()){
 return consolidateOffers(offers.filter(o=>
  (filters.savedOnly||(o.available&&Date.parse(o.expires_at)>now&&inMode(o,filters)&&effectiveDiscount(o)>=filters.minDiscount))&&
  (!filters.stores?.length||filters.stores.includes(o.store))&&(!filters.maxPrice||o.price<=filters.maxPrice)&&matchesQuery(o,filters.query)
 ));
}
export function categoryCounts(offers:Offer[]){const counts:Record<string,number>={all:offers.length};for(const o of offers)counts[o.category]=(counts[o.category]??0)+1;return counts;}
