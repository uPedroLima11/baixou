export const categories = [['all','Todas as ofertas'],['ram','Memória RAM'],['gpu','Placas de vídeo'],['motherboard','Placas-mãe'],['cpu','Processadores'],['ssd','SSDs e HDs'],['monitor','Monitores'],['mouse','Mouses'],['keyboard','Teclados'],['chair','Cadeiras'],['pc','PCs completos'],['kit','Kits upgrade'],['peripherals','Periféricos'],['notebook','Notebooks'],['other','Outros eletrônicos']] as const;
export type Category=typeof categories[number][0];
export type Offer={product_id?:string|null;gtin?:string|null;variant?:import("./identity").Variant;id:string;store:string;url:string;title:string;category:Category;brand:string|null;mpn:string|null;image:string|null;images:string[];price:number;original_price:number|null;available:boolean;seller:string;sold:number|null;rating:number|null;review_count:number|null;specs:Record<string,string>;discoveries?:{source:string;name:string;url:string}[];coupon_hint?:string|null;coupon_validated?:boolean;payment_note?:string;verification_status?:string;checked_at:string;expires_at:string;historical_median:number|null;historical_max?:number|null;historical_samples:number;historical_days:number;discount:number;evidence:'history'|'retailer'|'none';market_median?:number|null;market_lowest?:number|null;market_stores?:number;market_highest?:number|null;market_expires_at?:string|null;seller_key?:string|null;payment_basis?:string|null;market_checked_at?:string|null};
export type SourceStatus={store:string;status:string;checked_at:string;message:string;products:number};
export type StoreCoverage={store:string;collected:number;available:number;displayable:number;expired_awaiting_check:number};
export type Catalog={coverage?:{generated_at:string;stores:StoreCoverage[]}|null;truncated?:boolean;offers:Offer[];sources:SourceStatus[];stores?:import('./stores').StoreRecord[];configured:boolean;error?:string};
export type Alert={product_id?:string|null;product_variant?:import("./identity").Variant;id?:string;user_id?:string;category:string;offer_id:string|null;max_price:number|null;min_discount:number|null;min_drop_amount?:number|null;brands?:string[];spec_filters?:Record<string,string|number|(string|number)[]>;enabled:boolean};
export const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
export const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function classify(title:string):Category {
 const t=' '+normalize(title)+' ';
 if(isUpgradeKit(t,title))return 'kit';
 // 1) Identidade principal: o tipo de produto no início do título prevalece sobre palavras soltas
 //    ("Cooler para Processador" é cooler; "Celular ... 8GB RAM" é celular; "Webcam Full HD" não é HD).
 for(const [re,category] of HEAD_RULES)if(re.test(t))return category;
 // 2) Títulos que começam pela marca (comum na Guerra Digital e no Mercado Livre).
 if(/\b(smart\s*tv|smartphone|celular|smartwatch|tablet)\b/.test(t))return 'other';
 if(MOBILE_CPU_RE.test(t))return 'notebook';
 if(/\bchipset\b/.test(t)||((/\b(am[45]|lga\s*\d{4})\b/.test(t)||/\b(e\s*atx|atx|matx|m\s*atx|micro\s*atx|mini\s*itx)\b/.test(t))&&/\b[abhxzqw]r?x?\d{3}[a-z]?m?\b/.test(t)&&!CPU_MODEL_RE.test(t)))return 'motherboard';
 if(/\b(geforce|radeon|rtx\s*\d{3,4}|gtx\s*\d{3,4}|rx\s*\d{3,4}|arc\s*[ab]\d{3})\b/.test(t)&&/\b\d{1,2}\s*gb\b/.test(t))return 'gpu';
 if(CPU_MODEL_RE.test(t)&&!/\b(cooler|notebook|computador|pc)\b/.test(t))return 'cpu';
 // 3) Último recurso: palavras-chave, com exclusões para não confundir menções de especificação.
 if(/\b(notebook|laptop|macbook)\b/.test(t))return 'notebook';
 if(/\b(computador|pc gamer|desktop completo)\b/.test(t))return 'pc';
 if(/\bssd\b|\bdisco rigido\b|\bhdd\b/.test(t))return 'ssd';
 if(/mousepad|mouse pad/.test(t))return 'peripherals';if(/\bmouse\b/.test(t))return 'mouse';if(/\bteclado\b/.test(t))return 'keyboard';if(/\bcadeira\b/.test(t))return 'chair';
 if(/\b(headset|fone|webcam|microfone|controle|gabinete|fonte|cooler|ventoinha)\b/.test(t))return 'peripherals';
 return 'other';
}
const MOBILE_CPU_RE=/\b(?:i[3579]\s*\d{4,5}(?:h|hx|hs|u)|ryzen\s*[3579]\s*\d{4}(?:h|hs|hx|u)|core\s*ultra\s*[3579]\s*\d{3}(?:h|u|v))\b/;
// Ordem importa: acessórios que citam o produto principal vêm antes dele ("suporte para monitor", "fonte para notebook").
const HEAD_RULES:[RegExp,Category][]=[
 [/^\s*(suporte|braco articulado|carregador|fonte p(ara)?|bateria|capa|case|bolsa|mochila|pelicula|base refrigerada|cooler para notebook)\b/,'peripherals'],
 [/^\s*(cartao de memoria|cartao micro\s*sd|micro\s*sd|pen\s*drive|pendrive|memoria flash)\b/,'other'],
 [/^\s*(smart\s*tv|tv|televisor|smartphone|celular|iphone|tablet|ipad|smartwatch|relogio|galaxy\s*(watch|tab|buds)|console|playstation|xbox|nintendo|jogo|game|microsoft 365|antivirus|kaspersky|garantia|refrigerador|geladeira)\b/,'other'],
 [/^\s*(notebook|laptop|macbook|chromebook|ultrabook|workstation movel)\b/,'notebook'],
 [/^\s*(computador|pc|desktop|imac|mini\s*pc|all\s*in\s*one|workstation|servidor|personal ai supercomputer)\b/,'pc'],
 [/^\s*monitor\b/,'monitor'],
 [/^\s*(cadeira|poltrona)\b/,'chair'],
 [/^\s*(placa de video|placa grafica|tarjeta grafica|tarjeta de video)\b/,'gpu'],
 [/^\s*(placa mae|motherboard)\b/,'motherboard'],
 [/^\s*processador\b/,'cpu'],
 [/^\s*(memoria|kit de memoria|kit memoria)\b/,'ram'],
 [/^\s*(ssd\w*|hd|hdd|disco|nvme|m 2|seagate barracuda)\b/,'ssd'],
 [/^\s*(kit|combo)\b.*\b(teclado|mouse|headset|fone)\b/,'peripherals'],
 [/^\s*(teclado e mouse|mouse e teclado)\b/,'peripherals'],
 [/^\s*(mousepad|mouse pad)\b/,'peripherals'],
 [/^\s*mouse\b/,'mouse'],
 [/^\s*teclado\b/,'keyboard'],
 [/^\s*(cooler|water\s*cooler|air\s*cooler|ventoinha|fan|kit fan|kit ventoinhas|pasta termica|dissipador|controlador(a)? de fan|controladora|gabinete|fonte|headset|fones?|microfone|webcam|camera web|camera webcam|caixa de som|soundbar|controle|joystick|volante|hub|cabo|adaptador|estabilizador|nobreak|filtro de linha|protetor|roteador|switch|placa de rede|placa de captura|conferencecam)\b/,'peripherals'],
];
export function calculateEvidence(price:number,reference:number|null,history:{price:number;observed_at:string}[],now=Date.now()){
 const valid=history.filter(x=>x.price>0&&Date.parse(x.observed_at)<now-3600000&&Date.parse(x.observed_at)>now-30*86400000);
 const days=new Set(valid.map(x=>x.observed_at.slice(0,10))).size;
 const sorted=valid.map(x=>x.price).sort((a,b)=>a-b);
 const n=sorted.length;const median=n?(n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2):null;
 return evidenceFromStats(price,reference,{median,samples:n,days});
}
// Same decision from aggregates computed in Postgres (price_history_stats), so the collector does not download raw history.
export function evidenceFromStats(price:number,reference:number|null,stats:{median:number|null;samples:number;days:number;max?:number|null}){
 const n=stats.samples,days=stats.days,median=n&&stats.median!=null&&Number(stats.median)>0?Number(stats.median):null;
 const enough=n>=5&&days>=3;
 const historicalPercent=median?(1-price/median)*100:0;
 const historicalDiscount=Math.floor(historicalPercent+1e-9);
 const announced=reference&&reference>price?Math.round((1-price/reference)*100):0;
 return {historical_median:enough?median:null,historical_max:enough&&Number(stats.max)>0?Number(stats.max):null,historical_samples:n,historical_days:days,discount:enough&&historicalPercent>=5?historicalDiscount:announced,evidence:enough&&historicalPercent>=5?'history' as const:announced>=5?'retailer' as const:'none' as const};
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
