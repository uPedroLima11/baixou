import type {MarketplaceListing} from './types';
export type ListingDecision={ok:true}|{ok:false;reason:string};
// Regras mínimas antes de um anúncio vindo de API virar oferta pública. Marketplaces exigem vendedor confiável.
// Níveis aceitos são valores das próprias APIs (ex.: Mercado Livre 5_green/4_light_green; lojas oficiais/indicadas).
export const MARKETPLACE_RULES={minPositiveRate:0.95,minCompletedSales:100,trustedLevels:['5_green','4_light_green','official','preferred','preferred_plus']};
export function acceptListing(l:MarketplaceListing,opts:{hosts:string[];marketplace:boolean}):ListingDecision{
 if(!l.title?.trim())return {ok:false,reason:'sem título'};
 if(!Number.isFinite(l.price)||l.price<=0)return {ok:false,reason:'preço inválido'};
 if(l.currency!=='BRL')return {ok:false,reason:'moeda diferente de BRL'};
 if(l.available!==true)return {ok:false,reason:l.available===false?'indisponível':'disponibilidade não confirmada'};
 if(l.condition!=='new')return {ok:false,reason:'condição não confirmada como novo'};
 let host='';
 try{const u=new URL(l.url);if(u.protocol!=='https:'||u.username||u.password)return {ok:false,reason:'URL insegura'};host=u.hostname;}catch{return {ok:false,reason:'URL inválida'};}
 if(!opts.hosts.includes(host))return {ok:false,reason:'host fora da lista permitida'};
 if(l.originalPrice!=null&&!(l.originalPrice>0))return {ok:false,reason:'preço original inválido'};
 if(opts.marketplace){
  const s=l.seller;if(!s.id&&!s.name)return {ok:false,reason:'vendedor não identificado'};
  const level=(s.reputationLevel??'').toLowerCase();
  const trusted=s.official===true||MARKETPLACE_RULES.trustedLevels.includes(level)||(s.positiveRate!=null&&s.positiveRate>=MARKETPLACE_RULES.minPositiveRate&&s.completedSales!=null&&s.completedSales>=MARKETPLACE_RULES.minCompletedSales);
  if(!trusted)return {ok:false,reason:'reputação do vendedor insuficiente ou desconhecida'};
 }
 return {ok:true};
}
