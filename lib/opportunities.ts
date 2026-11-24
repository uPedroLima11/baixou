import {normalize,type Offer} from './types';
import {baixouScore,SCORE_RANK} from './score';
// Ordenação padrão: relevância da busca, depois a qualidade REAL do preço (Baixou Score: classe, nota e confiança).
// Preço riscado, desconto anunciado, popularidade ou vendas estimadas não dão pontos.
export function opportunityQuality(o:Offer){const b=baixouScore(o);return {tier:SCORE_RANK[b.klass],savings:b.saving??0,score:b.score??-1,confidence:b.confidence==='alta'?2:b.confidence==='média'?1:0};}
export function compareOpportunities(a:Offer,b:Offer,query=''){
 const q=normalize(query),relevance=(o:Offer)=>q&&normalize(o.title).includes(q)?1:0;
 const x=opportunityQuality(a),y=opportunityQuality(b);
 const completeness=(o:Offer)=>Number(!!o.image)+Number(!!o.brand)+Math.min(Object.keys(o.specs??{}).length,5)/5;
 return relevance(b)-relevance(a)||y.tier-x.tier||y.score-x.score||y.confidence-x.confidence||Number(!!b.product_id)-Number(!!a.product_id)||completeness(b)-completeness(a)||Date.parse(b.checked_at)-Date.parse(a.checked_at)||a.id.localeCompare(b.id);
}
// Texto curto do card: nota e classe quando há evidência; nada quando não há (o selo de evidência já informa).
export function opportunityLabel(o:Offer){const b=baixouScore(o);return b.score===null?'':'Baixou Score '+b.score+' · '+b.label;}
