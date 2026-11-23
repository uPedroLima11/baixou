import {FACETS,facetLabel,offerFacets} from './specs';
import {categories,type Offer} from './types';
import {consolidateOffers} from './search';
export function departmentOptions(offers:Offer[],now=Date.now()){
 const live=consolidateOffers(offers.filter(o=>o.available&&Date.parse(o.expires_at)>now));
 return categories.filter(([id])=>id!=='all').map(([id,label])=>{
  const rows=live.filter(o=>o.category===id),specs=rows.map(offerFacets);
  return {id,label,count:rows.length,facets:(FACETS[id]??[]).map(def=>{
   const counts=new Map<string,number>();for(const s of specs){if(s[def.key]!==undefined){const value=String(s[def.key]);counts.set(value,(counts.get(value)??0)+1);}}
   return {key:def.key,label:def.label,options:[...counts].map(([value,count])=>({value,count,label:facetLabel(def.key,def.numeric?Number(value):value)})).sort((a,b)=>def.numeric?Number(a.value)-Number(b.value):a.label.localeCompare(b.label,'pt-BR'))};
  }).filter(f=>f.options.length)};
 }).filter(d=>d.count);
}
