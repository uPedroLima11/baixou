// Baixou Score: qualidade ATUAL do preço (0–100), separada da CONFIANÇA da avaliação. Não é previsão de queda.
//
// Evidências aceitas (nunca o preço riscado da loja):
//  1. Preço habitual próprio: mediana das verificações com mais de 24 h (reference_*, até 30 dias), exigindo
//     >=5 observações em >=3 dias. A promoção de hoje não entra na própria referência.
//  2. Lojas comparadas: mesmo produto canônico em >=2 outros vendedores independentes agora (market_*), com
//     dispersão <= 1,5× e referência ainda válida. Preço à vista/Pix comparável.
// Economia s = 1 − preço/referência. Com as duas evidências vale a MENOR (conservador).
// Pontos = 50 + 250·s, limitado a 0–100: preço igual à referência = 50; 10% abaixo = 75; 20% abaixo = 100.
//
// Faixas (calibradas com dados reais de 24/11/2026; ver docs/HANDOFF.md):
//  - |s| < 3%: preço normal. 94% dos dias-anúncio não variam e só ~1% dos anúncios mudou >3% entre dias, então
//    diferenças menores são ruído de arredondamento/Pix e não justificam destaque.
//  - 3–8%: competitivo; 8–15%: boa oportunidade; >=15%: excepcional (só com confiança alta; senão, boa).
//    O limite de 5% já usado na queda comprovada e na comparação de lojas fica dentro de "competitivo".
//  - s <= −5%: acima do habitual (simétrico ao limite de 5% das evidências).
// Ofertas apenas anunciadas pela loja (Telegram) ou só com preço riscado: "Dados insuficientes", nunca nota.
import {marketDiscount} from './market';
import type {Offer} from './types';
export type ScoreClass='exceptional'|'good'|'competitive'|'normal'|'above'|'insufficient';
export const SCORE_LABEL:Record<ScoreClass,string>={exceptional:'Oportunidade excepcional',good:'Boa oportunidade',competitive:'Preço competitivo',normal:'Preço normal',above:'Acima do preço habitual',insufficient:'Dados insuficientes para avaliar'};
export const SCORE_RANK:Record<ScoreClass,number>={exceptional:5,good:4,competitive:3,normal:2,above:1,insufficient:0};
export type Confidence='alta'|'média'|null;
export type BaixouScore={score:number|null;klass:ScoreClass;label:string;confidence:Confidence;saving:number|null;reasons:string[];basis:{history:number|null;market:number|null}};
type ScoreInput=Pick<Offer,'price'|'available'|'expires_at'|'evidence'|'discount'|'original_price'|'store'>&Partial<Pick<Offer,'verification_status'|'reference_median'|'reference_samples'|'reference_days'|'reference_min'|'reference_max'|'payment_basis'|'product_id'>>&{market_median?:number|string|null;market_lowest?:number|string|null;market_highest?:number|string|null;market_stores?:number|null;market_expires_at?:string|null};
const pct=(x:number)=>Math.floor(Math.abs(x)*1000+1e-6)/10;
const fmt=(x:number)=>pct(x).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
export const REFERENCE_MIN_SAMPLES=5,REFERENCE_MIN_DAYS=3;
export function historyReference(o:ScoreInput){const m=Number(o.reference_median),n=Number(o.reference_samples??0),d=Number(o.reference_days??0);return m>0&&n>=REFERENCE_MIN_SAMPLES&&d>=REFERENCE_MIN_DAYS?{median:m,samples:n,days:d,min:Number(o.reference_min)>0?Number(o.reference_min):null}:null;}
export function marketReference(o:ScoreInput){
 const stores=o.market_stores??0,d=marketDiscount(o as Parameters<typeof marketDiscount>[0]);if(stores<2||d===null)return null;
 const low=Number(o.market_lowest),high=Number(o.market_highest);if(low>0&&high>0&&high/low>1.5)return null;// referências dispersas demais
 return {median:Number(o.market_median),lowest:low>0?low:null,stores};
}
export function baixouScore(o:ScoreInput,now=Date.now()):BaixouScore{
 const reasons:string[]=[];const none=(why:string[]):BaixouScore=>({score:null,klass:'insufficient',label:SCORE_LABEL.insufficient,confidence:null,saving:null,reasons:why,basis:{history:null,market:null}});
 if(o.verification_status==='announced')return none(['Preço anunciado pela própria loja e não conferido na página do produto.']);
 if(!o.available||Date.parse(o.expires_at)<=now)return none(['Sem verificação recente do preço.']);
 const h=historyReference(o),m=marketReference(o);
 const sh=h?1-o.price/h.median:null,sm=m?1-o.price/m.median:null;
 if(sh===null&&sm===null){
  const why=['Ainda sem histórico suficiente (mín. '+REFERENCE_MIN_SAMPLES+' verificações em '+REFERENCE_MIN_DAYS+' dias, anteriores às últimas 24 h) nem comparação com 2+ outras lojas.'];
  if(o.evidence==='retailer'&&Number(o.discount)>0)why.unshift('Desconto anunciado pela loja ('+o.discount+'%), ainda não comprovado.');
  return none(why);
 }
 const s=sh!==null&&sm!==null?Math.min(sh,sm):(sh??sm)!;
 if(sh!==null)reasons.push(Math.abs(sh)<0.03?'Em linha com o preço habitual observado ('+h!.days+' dias).':fmt(sh)+(sh>0?' abaixo':' acima')+' do preço habitual observado ('+h!.days+' dias).');
 if(sm!==null)reasons.push(Math.abs(sm)<0.03?'Em linha com '+m!.stores+' outras lojas comparadas.':fmt(sm)+(sm>0?' abaixo':' acima')+' da mediana de '+m!.stores+' outras lojas comparadas.');
 if(h?.min&&o.price<=h.min&&h.days>=3)reasons.push('Menor preço registrado nos últimos '+h.days+' dias.');
 const cheaperElsewhere=m?.lowest!=null&&o.price>m.lowest;
 if(cheaperElsewhere)reasons.push('Há loja comparada com preço menor agora.');
 if(o.evidence==='retailer'&&Number(o.discount)>0)reasons.push('Desconto anunciado pela loja: '+o.discount+'% (não usado na nota).');
 const confidence:Confidence=(h&&h.days>=7&&h.samples>=10)||(m&&m.stores>=3)||(h&&m)?'alta':'média';
 let klass:ScoreClass=s>=0.15?'exceptional':s>=0.08?'good':s>=0.03?'competitive':s>-0.05?'normal':'above';
 if(klass==='exceptional'&&confidence!=='alta'){klass='good';reasons.push('Economia alta, mas com amostra limitada (confiança média): classificada como boa oportunidade.');}
 if(cheaperElsewhere&&SCORE_RANK[klass]>SCORE_RANK.competitive)klass='competitive';// não é destaque se outra loja está mais barata
 const score=Math.max(0,Math.min(100,Math.round(50+250*s)));
 return {score,klass,label:SCORE_LABEL[klass],confidence,saving:s,reasons,basis:{history:sh,market:sm}};
}
export const isOpportunity=(b:BaixouScore)=>b.klass==='exceptional'||b.klass==='good';
