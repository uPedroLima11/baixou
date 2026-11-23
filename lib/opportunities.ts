import {effectiveEvidence,marketDiscount,marketStatus} from './market';
import {normalize,type Offer} from './types';
// Critérios editoriais explícitos, sem popularidade ou vendas estimadas. Preço riscado não dá pontos.
export function opportunityQuality(o:Offer){
 const history=o.evidence==='history'&&o.historical_samples>=5&&o.historical_days>=3&&Number(o.historical_median)>0;
 const market=marketStatus(o)==='below';
 const savings=Math.max(history?(1-o.price/Number(o.historical_median))*100:0,market?marketDiscount(o)??0:0);
 return {tier:history&&market?3:history||market?2:0,savings};
}
export function compareOpportunities(a:Offer,b:Offer,query=''){
 const q=normalize(query),relevance=(o:Offer)=>q&&normalize(o.title).includes(q)?1:0;
 const x=opportunityQuality(a),y=opportunityQuality(b);
 return relevance(b)-relevance(a)||y.tier-x.tier||y.savings-x.savings||Number(!!b.product_id)-Number(!!a.product_id)||Date.parse(b.checked_at)-Date.parse(a.checked_at)||a.id.localeCompare(b.id);
}
export function opportunityLabel(o:Offer){const q=opportunityQuality(o);return q.tier===3?'Histórico e mercado favoráveis':q.tier===2?'Oportunidade com evidência verificada':effectiveEvidence(o)==='retailer'?'Desconto anunciado pela loja':'Produto monitorado';}
