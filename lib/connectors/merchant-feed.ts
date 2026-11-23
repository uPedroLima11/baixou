import * as cheerio from 'cheerio';
import {validGTIN} from '../identity';
import type {Connector,ConnectorContext,MarketplaceListing,ListingCondition} from './types';

// Leitor de feed de produtos no padrão Google Merchant (RSS/Atom com namespace g:), o formato que lojas e redes de
// afiliados costumam entregar. Usado apenas com feed AUTORIZADO pela loja/rede (Terabyte via Lomadee, Pichau via
// Creator Network). Nada é inferido: campo ausente fica null e a política (policy.ts) descarta o anúncio.
// Preço de feed não declara forma de pagamento: paymentBasis fica null, então o anúncio NÃO entra na referência de
// mercado (que compara só preços à vista/Pix) até a loja confirmar a base do preço.
const money=(v:string|undefined)=>{const m=(v??'').trim().match(/^([\d.,]+)\s*([A-Z]{3})?$/);if(!m)return {value:NaN,currency:null as string|null};const raw=m[1];const n=Number(raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw);return {value:n,currency:m[2]??null};};
const availability=(v:string)=>{const a=v.trim().toLowerCase().replace(/\s+/g,'_');return a==='in_stock'?true:a==='out_of_stock'?false:null;};// preorder/backorder: não confirmado
const condition=(v:string):ListingCondition=>{const c=v.trim().toLowerCase();return c==='new'||c==='novo'?'new':c==='used'||c==='usado'?'used':c==='refurbished'||c==='recondicionado'?'refurbished':null;};
function saleActive(range:string|undefined,now:number){if(!range?.trim())return true;const [a,b]=range.split('/').map(s=>Date.parse(s.trim()));return (!Number.isFinite(a)||a<=now)&&(!Number.isFinite(b)||now<=b);}

export function parseMerchantFeed(xml:string,opts:{source:string;sellerName:string;now?:number}):MarketplaceListing[]{
 const $=cheerio.load(xml,{xml:true}),now=opts.now??Date.now(),fetchedAt=new Date(now).toISOString(),out:MarketplaceListing[]=[];
 $('item, entry').each((_,el)=>{
  const f=(name:string)=>{const node=$(el).children().filter((_,c)=>{const tag=(c as {name?:string}).name??'';return tag===name||tag==='g:'+name;}).first();return node.length?node.text().trim():'';};
  const id=f('id'),title=f('title'),link=f('link')||$(el).children('link').attr('href')||'';
  if(!id||!title||!link)return;
  const base=money(f('price')),sale=money(f('sale_price')),useSale=Number.isFinite(sale.value)&&sale.value>0&&saleActive(f('sale_price_effective_date'),now);
  const price=useSale?sale.value:base.value,currency=(useSale?sale.currency:base.currency)??'';
  const gtinRaw=f('gtin').replace(/\D/g,''),images=[f('image_link'),...$(el).children().filter((_,c)=>/(^|:)additional_image_link$/.test((c as {name?:string}).name??'')).toArray().map(c=>$(c).text().trim())].filter(u=>/^https:\/\//.test(u)).slice(0,10);
  out.push({source:opts.source,externalId:id.slice(0,120),url:link,title:title.slice(0,500),price,originalPrice:useSale&&base.value>price?base.value:null,currency,available:availability(f('availability')),condition:condition(f('condition')||'new'),
   seller:{id:null,name:opts.sellerName,official:true,reputationLevel:'official',positiveRate:null,completedSales:null},images,brand:f('brand')||null,mpn:f('mpn')||null,gtin:validGTIN(gtinRaw)?gtinRaw:null,couponHint:null,fetchedAt,paymentBasis:null});
 });
 return out;
}

async function* feedListings(ctx:ConnectorContext,envName:string,source:string,sellerName:string,host:string){
 const url=ctx.env[envName];if(!url)return;const u=new URL(url);if(u.protocol!=='https:')throw Error('Feed precisa de HTTPS');
 const r=await ctx.fetch(url,{headers:{'User-Agent':'BaixouBot/1.0 (+https://github.com/uPedroLima11/baixou)'},signal:AbortSignal.timeout(Math.max(1000,Math.min(30000,ctx.deadline-Date.now())))});
 if(!r.ok)throw Error('Feed HTTP '+r.status);const text=await r.text();if(text.length>25_000_000)throw Error('Feed maior que 25 MB');
 let n=0;for(const l of parseMerchantFeed(text,{source,sellerName})){if(n++>=ctx.maxListings)break;if(new URL(l.url).hostname===host)yield l;}
}
// Desligados (implemented=false) até a loja/rede autorizar o feed e um teste hospedado comprovar preço, estoque e URL reais.
export const terabyteFeed:Connector={id:'terabyte-feed',name:'TerabyteShop (feed autorizado)',marketplace:false,requiredEnv:['TERABYTE_FEED_URL'],hosts:['www.terabyteshop.com.br'],implemented:false,listings:ctx=>feedListings(ctx,'TERABYTE_FEED_URL','terabyte','TerabyteShop','www.terabyteshop.com.br')};
export const pichauFeed:Connector={id:'pichau-feed',name:'Pichau (feed autorizado)',marketplace:false,requiredEnv:['PICHAU_FEED_URL'],hosts:['www.pichau.com.br'],implemented:false,listings:ctx=>feedListings(ctx,'PICHAU_FEED_URL','pichau','Pichau','www.pichau.com.br')};
