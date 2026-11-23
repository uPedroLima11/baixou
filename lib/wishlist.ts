import {sameProduct} from './search';
import type {Offer} from './types';
export function offerState(o:Offer,now=Date.now()){
 if(!o.available)return 'out_of_stock';
 if(Date.parse(o.expires_at)<=now)return (o as Offer&{verification_status?:string}).verification_status==='failed'?'verification_failed':'expired';
 return 'active';
}
export function currentSavedOffer(saved:Offer,offers:Offer[],now=Date.now()){
 return offers.filter(o=>offerState(o,now)==='active'&&sameProduct(saved,o)).reduce((best,o)=>!best||o.price<best.price?o:best,null as Offer|null)??saved;
}
