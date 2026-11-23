export const categories = [['all','Todas as ofertas'],['ram','Memória RAM'],['gpu','Placas de vídeo'],['motherboard','Placas-mãe'],['cpu','Processadores'],['ssd','SSDs e HDs'],['monitor','Monitores'],['mouse','Mouses'],['keyboard','Teclados'],['chair','Cadeiras'],['pc','PCs completos'],['kit','Kits upgrade'],['peripherals','Periféricos'],['notebook','Notebooks'],['other','Outros eletrônicos']] as const;
export type Category=typeof categories[number][0];
export type Offer={product_id?:string|null;gtin?:string|null;variant?:import("./identity").Variant;id:string;store:string;url:string;title:string;category:Category;brand:string|null;mpn:string|null;image:string|null;images:string[];price:number;original_price:number|null;available:boolean;seller:string;sold:number|null;rating:number|null;review_count:number|null;specs:Record<string,string>;discoveries?:{source:string;name:string;url:string}[];coupon_hint?:string|null;coupon_validated?:boolean;payment_note?:string;checked_at:string;expires_at:string;historical_median:number|null;historical_samples:number;historical_days:number;discount:number;evidence:'history'|'retailer'|'none'};
export type SourceStatus={store:string;status:string;checked_at:string;message:string;products:number};
export type StoreCoverage={store:string;collected:number;available:number;displayable:number;expired_awaiting_check:number};
export type Catalog={coverage?:{generated_at:string;stores:StoreCoverage[]}|null;truncated?:boolean;offers:Offer[];sources:SourceStatus[];stores?:import('./stores').StoreRecord[];configured:boolean;error?:string};
export type Alert={product_id?:string|null;product_variant?:import("./identity").Variant;id?:string;user_id?:string;category:string;offer_id:string|null;max_price:number|null;min_discount:number|null;min_drop_amount?:number|null;brands?:string[];spec_filters?:Record<string,string|number>;enabled:boolean};
export const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
export const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function classify(title:string):Category {
 const t=' '+normalize(title)+' ';
 if(isUpgradeKit(t,title))return 'kit';
 if(/^\s*(notebook|laptop)\b/.test(t))return 'notebook';
 if(/^\s*(computador|pc gamer|desktop completo)\b/.test(t))return 'pc';
 if(/^\s*(kit|combo)\b.*\b(teclado|mouse|headset|fone)\b/.test(t))return 'peripherals';
 if(/placa mae|motherboard/.test(t)&&!/^\s*processador\b/.test(t))return 'motherboard';
 if(/placa de video|geforce|radeon|rtx|gtx/.test(t))return 'gpu';
 if(/processador|ryzen|intel core/.test(t)&&!/notebook|computador|pc gamer/.test(t))return 'cpu';
 if(/memoria|\bram\b|\bddr\s*[345]\b/.test(t)&&!/notebook.*ssd|computador|pc gamer/.test(t))return 'ram';
 if(/notebook|laptop/.test(t))return 'notebook';
 if(/computador|pc gamer|desktop completo/.test(t))return 'pc';
 if(/ssd|disco rigido| hd /.test(t))return 'ssd';if(/monitor/.test(t))return 'monitor';
 if(/mousepad|mouse pad/.test(t))return 'peripherals';if(/mouse/.test(t))return 'mouse';if(/teclado/.test(t))return 'keyboard';if(/cadeira/.test(t))return 'chair';
 if(/headset|fone|webcam|microfone|controle|gabinete|fonte|cooler/.test(t))return 'peripherals';return 'other';
}
export function calculateEvidence(price:number,reference:number|null,history:{price:number;observed_at:string}[],now=Date.now()){
 const valid=history.filter(x=>x.price>0&&Date.parse(x.observed_at)<now-3600000&&Date.parse(x.observed_at)>now-30*86400000);
 const days=new Set(valid.map(x=>x.observed_at.slice(0,10))).size;
 const sorted=valid.map(x=>x.price).sort((a,b)=>a-b);
 const n=sorted.length;const median=n?(n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2):null;
 return evidenceFromStats(price,reference,{median,samples:n,days});
}
// Same decision from aggregates computed in Postgres (price_history_stats), so the collector does not download raw history.
export function evidenceFromStats(price:number,reference:number|null,stats:{median:number|null;samples:number;days:number}){
 const n=stats.samples,days=stats.days,median=n&&stats.median!=null&&Number(stats.median)>0?Number(stats.median):null;
 const enough=n>=5&&days>=3;
 const historicalDiscount=median?Math.round((1-price/median)*100):0;
 const announced=reference&&reference>price?Math.round((1-price/reference)*100):0;
 return {historical_median:enough?median:null,historical_samples:n,historical_days:days,discount:enough&&historicalDiscount>=5?historicalDiscount:announced,evidence:enough&&historicalDiscount>=5?'history' as const:announced>=5?'retailer' as const:'none' as const};
}

const CPU_RE=/\b(processador|ryzen\s*[3579]|core\s*(?:ultra\s*)?i?[3579]|athlon|pentium|celeron)\b/;
const MB_RE=/\b(placa\s*mae|motherboard|[abhxzq]\d{3}[a-z]?m?)\b/;
// Kit upgrade = processador + placa-mãe (com ou sem memória) vendidos juntos. Não é PC completo nem kit de memória RAM.
export function isUpgradeKit(normalized:string,raw=''){const t=' '+normalized.trim()+' ';
 if(/^\s*(computador|pc gamer|pc|desktop|notebook|laptop|memoria)\b/.test(t))return false;
 if(/\bkit\s*upgrade\b|\bupgrade\s*kit\b/.test(t))return true;
 if(/\b(kit|combo)\b/.test(t)&&CPU_RE.test(t)&&MB_RE.test(t))return true;
 // Sem a palavra kit (ex.: KaBuM "Processador Ryzen 3 3200G + Placa Mãe A520M"): exige modelo concreto de CPU E placa-mãe nomeada.
 if(/\bcompativel\b|\bsuporta\b|\bsuporte\s+a\b/.test(t)||!/\b(placa\s*mae|motherboard)\b/.test(t))return false;
 if(CPU_MODEL_RE.test(t))return true;
 // Combo com '+' em que a CPU aparece abreviada (ex.: KaBuM "Placa Mãe A520M + 5 5500F + Cooler").
 return /\+\s*(?:processador\s+)?(?:amd\s+)?(?:ryzen\s+)?[3579]\s+\d{4}[a-z0-9]*\b/i.test(raw);}
const CPU_MODEL_RE=/\b(ryzen\s*[3579]\s*(?:pro\s*)?\d{4}[a-z0-9]*|core\s*(?:ultra\s*)?i?[3579]\s*\d{3,5}[a-z0-9]*|athlon\s*\d{3,4}[a-z]*)\b/;
// Componentes declarados no título do kit (dado da loja; não é verificação técnica de compatibilidade).
export function kitComponents(title:string){const parts:Record<string,string>={},plain=title.replace(/\s+/g,' ');
 const cpu=plain.match(/((?:AMD\s+)?Ryzen\s*[3579]\s+(?:PRO\s+)?\d{4}\w*(?:\s*X3D)?|(?:Intel\s+)?Core\s*(?:Ultra\s*)?i?[3579][-\s]?\d{3,5}\w*)/i);const short=cpu?null:plain.match(/\+\s*((?:AMD\s+)?(?:Ryzen\s+)?[3579]\s+\d{4}\w*)/i);if(cpu??short)parts['Processador']=(cpu??short)![1].trim();
 const mb=plain.match(/Placa[-\s]?M[ãa]e\s+([^+,]{3,60}?)(?=\s*(?:\+|,|$|\bMem[óo]ria\b|\bSSD\b))/i)??plain.match(/\b((?:ASUS|Gigabyte|MSI|ASRock|Biostar|Afox|Pcyes|Mancer|Machinist)\s+[^+,]{0,40}?[ABHXZQ]\d{3}[A-Z]?M?[^+,]{0,25}?)(?=\s*(?:\+|,|$))/i);if(mb)parts['Placa-mãe']=mb[1].trim();
 const ram=plain.match(/(\d{1,3}\s*GB(?:\s*\(\s*\d\s*x\s*\d{1,3}\s*GB\s*\))?\s*DDR[345](?:\s*\d{4}\s*MHz)?)/i);if(ram)parts['Memória']=ram[1].trim();
 return parts;}
