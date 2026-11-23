import type {Offer} from './types';
// Três evidências distintas, nunca confundidas:
// - 'history': queda comprovada no histórico do próprio Baixou! (mediana confiável, ver calculateEvidence);
// - 'market':  abaixo do preço de mercado, comparado com o MESMO produto canônico em >=2 outras lojas agora;
// - 'retailer': desconto anunciado pela loja (preço riscado), sem validação.
// Referência vem de refresh_market_reference() (um preço por loja, mediana robusta).
export const MARKET_MIN_STORES=2;
export const MARKET_MIN_DISCOUNT=5;
type MarketFields=Pick<Offer,'price'|'discount'|'evidence'>&{market_median?:number|string|null;market_lowest?:number|string|null;market_highest?:number|null;market_stores?:number|null;market_expires_at?:string|null};
export type MarketStatus='below'|'near'|'above'|'single'|'uncertain'|'none';
export function marketDiscount(o:MarketFields){if(o.market_expires_at!==undefined&&(!o.market_expires_at||Date.parse(o.market_expires_at)<=Date.now()))return null;const m=Number(o.market_median);return Number.isFinite(m)&&m>0?(1-Number(o.price)/m)*100:null;}
export function marketStatus(o:MarketFields):MarketStatus{
 const stores=o.market_stores??0,d=marketDiscount(o);
 if(!stores||d===null)return 'none';
 if(stores<MARKET_MIN_STORES)return 'single';
 // Comparação exata (sem arredondar) para decidir.
 // Duas referências muito distantes não sustentam uma promoção. O preço também deve ser o menor.
 const consistent=!o.market_highest||!o.market_lowest||o.market_highest/Number(o.market_lowest)<=1.5;
 if(!consistent)return 'uncertain';
 return consistent&&(!o.market_lowest||o.price<=Number(o.market_lowest))&&d>=MARKET_MIN_DISCOUNT?'below':d>-MARKET_MIN_DISCOUNT?'near':'above';
}
export type Evidence='history'|'market'|'retailer'|'none';
export function effectiveEvidence(o:MarketFields):Evidence{
 if(o.evidence==='history')return 'history';
 if(marketStatus(o)==='below')return 'market';
 return o.evidence==='retailer'?'retailer':'none';
}
// Desconto usado para ordenar, filtrar e exibir. Preço riscado nunca supera o que outras lojas mostram:
// havendo qualquer comparação atual (mesmo 1 loja), o desconto anunciado é limitado à diferença para o mercado.
export function effectiveDiscount(o:MarketFields){
 const ev=effectiveEvidence(o),d=marketDiscount(o);
 if(ev==='history')return Number(o.discount)||0;
 if(ev==='market')return Math.floor(d!);
 if(ev==='retailer'){const cap=Number(o.market_lowest)>0?(1-o.price/Number(o.market_lowest))*100:d;return (o.market_stores??0)>0&&d!==null&&cap!==null?Math.min(Number(o.discount)||0,Math.max(0,Math.floor(cap))):Number(o.discount)||0;}
 return 0;
}
// Anúncio com preço riscado muito acima do que outras lojas praticam agora.
export function announcedOverstated(o:MarketFields){return o.evidence==='retailer'&&(o.market_stores??0)>0&&(Number(o.discount)||0)-effectiveDiscount(o)>=10;}
