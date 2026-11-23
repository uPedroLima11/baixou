import {consolidateOffers,matchesQuery} from './search';
import type {Offer} from './types';
export type CatalogFilters={verified:boolean;savedOnly?:boolean;stores?:string[];maxPrice?:number;minDiscount:number;query:string};
// Both facets and cards consume this exact eligibility + grouping pipeline.
export function catalogSelection(offers:Offer[],filters:CatalogFilters,now=Date.now()){
 return consolidateOffers(offers.filter(o=>
  (filters.savedOnly||(o.available&&Date.parse(o.expires_at)>now&&(o.evidence==='history'||(!filters.verified&&o.evidence==='retailer'))&&o.discount>=filters.minDiscount))&&
  (!filters.stores?.length||filters.stores.includes(o.store))&&(!filters.maxPrice||o.price<=filters.maxPrice)&&matchesQuery(o,filters.query)
 ));
}
export function categoryCounts(offers:Offer[]){const counts:Record<string,number>={all:offers.length};for(const o of offers)counts[o.category]=(counts[o.category]??0)+1;return counts;}
