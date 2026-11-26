import {evidenceFromStats,type Offer} from './types';

// Modalidade de pagamento (Pix/à vista × cartão de crédito).
// - Cartão = valor INFORMADO pela loja: total explícito ou parcelas sem juros publicadas (N × valor). Nunca porcentagem sobre o Pix.
// - Inconsistência entre total e parcelas: fica só o que é coerente; sem dado coerente, "não informado" (null).
// - Toda a inteligência (Score, histórico, mercado, alertas) roda sobre a oferta PROJETADA na modalidade (offerForPayment),
//   então Pix e cartão nunca se comparam entre si.
export type Payment='pix'|'card';
export const PAYMENTS:Payment[]=['pix','card'];
export const isPayment=(v:unknown):v is Payment=>v==='pix'||v==='card';
export type CardTerms={card_price:number|null;card_installments:number|null;card_installment_value:number|null;card_interest_free:boolean|null};
export const NO_CARD:CardTerms={card_price:null,card_installments:null,card_installment_value:null,card_interest_free:null};
export type InstallmentRow={n:number;value:number;interestFree:boolean|null;total:number|null};

const money=(s:string)=>Number(s.replace(/\./g,'').replace(',','.'));
const near=(a:number,b:number,n=1)=>Math.abs(a-b)<=Math.max(.11,n*.011);
const round2=(v:number)=>Math.round(v*100)/100;

// Linhas "12 x de R$ 366,58 sem juros [R$ 4.399,00]" / "10× R$ 304,02 sem juros" / "10 x R$ 558,98 s/ juros".
export function installmentRows(text:string):InstallmentRow[]{
 const t=String(text??'').replace(/&times;/g,'×').replace(/\s+/g,' ');
 const re=/(\d{1,2})\s*(?:x|×)\s*(?:de\s*)?R\$\s*([\d.]+,\d{2})(?:\s*(sem juros|s\/\s*juros|com juros|c\/\s*juros))?(?:\s*(?:Total:?\s*)?R\$\s*([\d.]+,\d{2}))?/gi;
 const rows:InstallmentRow[]=[];for(const m of t.matchAll(re)){const n=Number(m[1]),value=money(m[2]);if(!(n>=1&&n<=48&&value>0))continue;
  const flag=m[3]?!/com|c\//i.test(m[3]):null;rows.push({n,value,interestFree:flag,total:m[4]?money(m[4]):null});}
 return rows;
}

// Escolhe as condições do cartão a partir do que a loja publicou.
// total: total explícito no cartão (se houver). rows: tabela/linha de parcelas. pix: preço à vista (sanidade).
export function cardTerms({pix,total,rows=[],interestFreeHint=null}:{pix:number;total?:number|null;rows?:InstallmentRow[];interestFreeHint?:boolean|null}):CardTerms{
 const valid=(t:number)=>t>0&&t>=pix-.01&&t<=pix*1.8;
 const free=rows.filter(r=>r.interestFree===true||(r.interestFree===null&&interestFreeHint===true));
 if(total&&valid(total)){
  const fit=free.filter(r=>near(r.n*r.value,total,r.n)).sort((a,b)=>b.n-a.n)[0];
  if(fit)return {card_price:round2(total),card_installments:fit.n,card_installment_value:fit.value,card_interest_free:true};
  const any=rows.filter(r=>r.interestFree!==true&&r.total&&near(r.total,total)).sort((a,b)=>b.n-a.n)[0];
  if(any)return {card_price:round2(total),card_installments:any.n,card_installment_value:any.value,card_interest_free:any.interestFree};
  return {card_price:round2(total),card_installments:null,card_installment_value:null,card_interest_free:null};
 }
 // Sem total explícito: só parcelas SEM JUROS coerentes entre si (a maior quantidade define o total pago).
 const withTotal=free.map(r=>({...r,sum:r.total&&near(r.total,r.n*r.value,r.n)?r.total:round2(r.n*r.value)}));
 const best=withTotal.sort((a,b)=>b.n-a.n)[0];if(!best||!valid(best.sum))return NO_CARD;
 const agree=withTotal.filter(r=>r.n>=2&&near(r.sum,best.sum,r.n));
 if(withTotal.filter(r=>r.n>=2).length>1&&agree.length<2)return NO_CARD; // tabela incoerente (provavelmente de outro produto)
 return {card_price:best.sum,card_installments:best.n,card_installment_value:best.value,card_interest_free:true};
}

export function installmentLabel(o:Pick<Offer,'card_installments'|'card_installment_value'|'card_interest_free'>){
 if(!o.card_installments||!o.card_installment_value)return null;
 const v=Number(o.card_installment_value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 return o.card_installments+'× de '+v+(o.card_interest_free===true?' sem juros':o.card_interest_free===false?' com juros':'');
}

// Oferta projetada na modalidade. Pix = a própria oferta. Cartão = preço total no cartão, preço habitual do cartão
// (price_daily.card_*), comparação com outras lojas no cartão (card_market_*). Sem preço no cartão: null.
export function offerForPayment<T extends Offer>(o:T,pay:Payment):T|null{
 // Oferta já projetada no cartão: só serve ao cartão (nunca reconstruir o Pix a partir dela).
 if(o.payment_basis==='card')return pay==='card'?o:null;
 if(pay==='pix')return o;
 const card=Number(o.card_price);if(!(card>0))return null;
 const ev=evidenceFromStats(card,o.original_price,{median:null,samples:0,days:0,max:o.card_historical_max??null,ref_median:o.card_reference_median??null,ref_samples:o.card_reference_samples??0,ref_days:o.card_reference_days??0,ref_min:o.card_reference_min??null,ref_max:o.card_reference_max??null});
 const terms=installmentLabel(o);
 return {...o,pix_price:Number(o.price),price:card,...ev,
  market_median:o.card_market_median??null,market_lowest:o.card_market_lowest??null,market_highest:o.card_market_highest??null,market_stores:o.card_market_stores??0,market_expires_at:o.card_market_expires_at??null,
  payment_basis:'card',payment_note:'Total no cartão de crédito'+(terms?' ('+terms+')':'')+', informado pela loja.'};
}

type CardStats={max:number|null;ref_median:number|null;ref_samples:number|null;ref_days:number|null;ref_min:number|null;ref_max:number|null};
// Campos do preço habitual NO CARTÃO a partir de card_price_stats (mesma regra do Pix). Sem cartão hoje: tudo nulo.
export function cardReferenceFields(cardPrice:number|null|undefined,s:CardStats|null){
 const ok=Number(cardPrice)>0&&s;const num=(v:unknown)=>Number(v)>0?Number(v):null;
 return {card_reference_median:ok?num(s!.ref_median):null,card_reference_samples:ok?Number(s!.ref_samples??0):null,card_reference_days:ok?Number(s!.ref_days??0):null,card_reference_min:ok?num(s!.ref_min):null,card_reference_max:ok?num(s!.ref_max):null,card_historical_max:ok?num(s!.max):null};
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadCardReference(db:any,offerId:string,cardPrice:number|null|undefined){
 if(!(Number(cardPrice)>0))return cardReferenceFields(null,null);
 const r=await db.rpc('card_price_stats',{p_offer_id:offerId}).single();if(r.error)throw r.error;return cardReferenceFields(cardPrice,r.data as CardStats);
}
