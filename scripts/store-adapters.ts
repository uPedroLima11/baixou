import * as cheerio from 'cheerio/slim';
import {createHash} from 'node:crypto';
import {classify,normalize,type Offer} from '../lib/types';
export type ParsedProduct=Omit<Offer,'discount'|'evidence'|'historical_median'|'historical_samples'|'historical_days'>;
const names:Record<string,string>={ibyte:'iByte',waz:'WAZ',oficinadosbits:'Oficina dos Bits',guerradigital:'Guerra Digital',patoloco:'Patoloco'};
export class ConfirmedUnavailable extends Error {constructor(){super('Indisponibilidade explícita confirmada no produto');}}
export function brl(value:unknown){if(typeof value==='number')return value;const text=String(value??'').replace(/[^\d.,-]/g,'');return Number(text.includes(',')?text.replace(/\./g,'').replace(',','.'):text);}
function clean(html:string){const $=cheerio.load(html);$('script,style,noscript').remove();return $.text().replace(/\s+/g,' ').trim();}
export function structuredNodes($:cheerio.CheerioAPI){const nodes:any[]=[];function visit(n:any){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(visit);return;}nodes.push(n);if(n.mainEntity)visit(n.mainEntity);if(n['@graph'])visit(n['@graph']);}for(const e of $('script[type="application/ld+json"]').toArray()){try{visit(JSON.parse($(e).text()));}catch{}}return nodes;}
// VTEX (iByte): o estado renderizado no servidor lista os produtos da categoria como "linkText":"slug". Só slugs seguros.
export function vtexLinkTexts(html:string){return [...new Set([...html.matchAll(/"linkText":"([a-z0-9]+(?:-[a-z0-9]+)+)"/g)].map(m=>m[1]))].slice(0,200);}
// iByte imprime o código do fabricante como último termo do título, separado por espaço ("… SATA III SA400S37/480G").
// Aceito só com '-' ou '/', letras e >=3 dígitos, e nunca termos de especificação (DDR4-3200, PCIe-4.0, USB-C…).
export function ibyteTitleCode(title:string){const last=title.trim().split(/\s+/).at(-1)??'';return /^[A-Za-z0-9]+(?:[-/][A-Za-z0-9]+)+$/.test(last)&&last.length>=7&&/[A-Za-z]/.test(last)&&(last.match(/\d/g)?.length??0)>=3&&!/^(?:G?DDR\d|PCIE?|USB|HDMI|LGA|AM\d|WI-?FI|RGB|ARGB|SATA|NVME|M\.?2)/i.test(last)?last:null;}
export function structuredProductLinks($:cheerio.CheerioAPI){const links=new Set<string>();let visited=0;function walk(n:any,depth=0){if(depth>12||visited++>5000||!n)return;if(Array.isArray(n)){n.forEach(x=>walk(x,depth+1));return;}if(typeof n!=='object')return;for(const value of [n.url,n['@id']])if(typeof value==='string')links.add(value);for(const key of ['@graph','mainEntity','itemListElement','item','offers']){if(typeof n[key]==='string'&&key==='item')links.add(n[key]);else walk(n[key],depth+1);}}for(const script of $('script[type="application/ld+json"]').toArray()){try{walk(JSON.parse($(script).text()));}catch{}}return [...links];}
const isType=(n:any,type:string)=>[n?.['@type']].flat().includes(type);
function equalURL(a:string,b:string){try{const x=new URL(a),y=new URL(b);return x.hostname===y.hostname&&x.pathname.replace(/\/$/,'')===y.pathname.replace(/\/$/,'');}catch{return false;}}
function mainProduct($:cheerio.CheerioAPI,url:string){const nodes=structuredNodes($),h1=normalize($('h1').first().text());const products=nodes.filter(n=>isType(n,'Product'));
 const match=products.filter(p=>[p['@id'],p.url,p.mainEntityOfPage?.['@id'],...(Array.isArray(p.offers)?p.offers:[p.offers]).map((o:any)=>o?.url)].some(x=>typeof x==='string'&&equalURL(x,url)));
 if(match.length===1)return match[0];
 const sameName=products.filter(p=>normalize(p.name??'')===h1);if(sameName.length===1)return sameName[0];throw Error('Produto principal não identificado sem ambiguidade');}
function availability(value:unknown){const state=String(value??'').split('/').at(-1);if(!['InStock','OutOfStock','SoldOut','Discontinued','PreOrder','BackOrder'].includes(state!))throw Error('Estoque não informado');return state==='InStock';}
function manufacturerPart(p:any,title:string,specs:Record<string,string>){const candidates=[specs.Modelo,specs['Part Number'],p.mpn,title.match(/\b([A-Z0-9]+(?:[-/][A-Z0-9]+)+)\s*\(/)?.[1],...(title.match(/\(([^()]+)\)\s*$/)?.slice(1)??[]),title.match(/\s-\s([A-Za-z0-9][A-Za-z0-9./_-]{3,99})\s*$/)?.[1]];return candidates.find(x=>typeof x==='string'&&!/\s/.test(x)&&/[a-z]/i.test(x)&&/\d/.test(x)&&!/^\d+(gb|tb|mhz)$/i.test(x))??null;}
function specificationData($:cheerio.CheerioAPI,p:any,id:string){const specs:Record<string,string>={};for(const entry of p.additionalProperty??[]){if(entry.name&&entry.value)specs[String(entry.name).slice(0,100)]=clean(String(entry.value)).slice(0,2000);}
 const selectors:Record<string,string>={waz:'[class*="productDescriptionContainer"], [class*="specificationValue"]',oficinadosbits:'.description-section',guerradigital:'#product-description',patoloco:'#description'};
 const scope=$(selectors[id]).first().clone();scope.find('script,style').remove();const description=scope.text().trim()||clean(String(p.description??''));if(description)specs['Descrição do fabricante']=description.slice(0,10000);
 for(const line of description.split(/\n/)){const m=line.trim().match(/^-?\s*(Marca|Modelo|Part Number|EAN|GTIN|Capacidade|Frequência|Socket)\s*:\s*(.+)$/i);if(m)specs[m[1].charAt(0).toUpperCase()+m[1].slice(1)]=m[2].trim().slice(0,180);}
 return specs;}
export function parseStoreProduct(id:string,html:string,url:string):ParsedProduct{
 const $=cheerio.load(html),canonical=$('link[rel="canonical"]').attr('href');if(!canonical||!equalURL(canonical,url))throw Error('URL canônica diverge do produto');
 let p:any,o:any,price:number,original:number|null=null,payment='Preço informado pela loja; confirmar pagamento e frete na origem.';
 if(id==='patoloco'){
  const root=$('[itemtype$="/Product"]').first(),offers=root.find('[itemprop="offers"]').first();
  if(!root.length||normalize($('meta[property="og:site_name"]').attr('content')??'')!=='patoloco'||!$('footer').text().includes('29.823.090/0001-00'))throw Error('Identidade de loja própria não confirmada');
  if(!offers.length&&/Este produto está indisponível no momento!/i.test($('h1').first().parent().parent().text()))throw new ConfirmedUnavailable();
  p={name:root.find('[itemprop="name"]').first().text().trim(),brand:root.find('[itemprop="brand"]').first().text().trim(),image:root.find('[itemprop="image"]').toArray().map(e=>$(e).attr('src')??$(e).attr('href')).filter(Boolean)};
  o={priceCurrency:offers.find('[itemprop="priceCurrency"]').attr('content'),availability:offers.find('[itemprop="availability"]').attr('href')??offers.find('[itemprop="availability"]').attr('content')};
  price=brl(offers.find('[itemprop="price"]').attr('content'));original=brl(offers.find('s').first().text())||null;payment='À vista no Pix ou boleto, conforme informado no produto.';
 }else{
  p=mainProduct($,url);const offers=Array.isArray(p.offers)?p.offers:[p.offers];o=offers.find((x:any)=>isType(x,'AggregateOffer'))??offers[0];
  if(id==='waz'){const variants=Array.isArray(o?.offers)?o.offers:[o];o=variants.find((x:any)=>normalize(x?.seller?.name??'')==='waz');if(!o)throw Error('Vendedor WAZ não confirmado');price=brl(o.price);const pix=brl($('[class*="spotPriceValue--pdp"]').first().text());
   // Esgotado na WAZ: schema do vendedor WAZ declara OutOfStock e a página não exibe preço Pix. Não vira oferta com preço do schema.
   if(!pix&&/\/OutOfStock$/i.test(String(o.availability??'')))throw new ConfirmedUnavailable();if(!pix||Math.abs(pix-price)>.02)throw Error('Preço Pix diverge do schema');original=brl($('[class*="flexRow--pdp-price-buy-btn"]').first().find('[class*="listPriceValue"]').first().text())||null;payment='À vista no Pix, confirmado no produto.';
  }else if(id==='ibyte'){
   // Vendedor próprio no schema e preço Pix impresso no DOM ("Por: R$ X no PIX") igual ao schema. highPrice do AggregateOffer não é preço antigo.
   const variants=Array.isArray(o?.offers)?o.offers:[o];o=variants.find((x:any)=>normalize(x?.seller?.name??'')==='ibyte');if(!o)throw Error('Vendedor iByte não confirmado');price=brl(o.price);
   const selling=$('[class*="sellingPrice--product-page-best-price"]').first(),pix=brl(selling.find('[class*="sellingPriceValue"]').first().text());
   if(!pix&&/\/OutOfStock$/i.test(String(o.availability??'')))throw new ConfirmedUnavailable();
   if(!pix||!/no\s+pix/i.test(selling.text())||Math.abs(pix-price)>.02)throw Error('Preço Pix diverge do schema');
   original=brl($('[class*="listPriceValue"]').first().text())||null;payment='À vista no Pix, confirmado no produto.';
   // O "De" da iByte costuma ser o preço a prazo (ex.: De R$ 839,90 = 10x R$ 83,99). Preço de cartão não é preço antigo.
   const parcels=Number($('[class*="installmentsNumber"]').first().text().trim()),parcel=brl($('[class*="installmentValue"]').first().text());
   if(original&&parcels>0&&parcel>0&&Math.abs(parcels*parcel-original)<=Math.max(.11,parcels*.01))original=null;
   // mpn/gtin do schema da iByte são códigos internos; o código do fabricante vem do fim do título.
   p={...p,mpn:ibyteTitleCode(String(p.name??''))};
  }else if(id==='oficinadosbits'){
   const store=structuredNodes($).find(n=>isType(n,'Store')&&normalize(n.name??'')==='oficina dos bits'&&equalURL(n.url,'https://www.oficinadosbits.com.br/'));
   if(!store||o?.seller&&normalize(o.seller.name)!=='oficina dos bits')throw Error('Loja própria não confirmada');price=brl(o?.price);const pix=brl($('.price-discount__pix').first().text().match(/R\$\s*[\d.,]+/)?.[0]);if(!pix||Math.abs(pix-price)>.02)throw Error('Preço Pix não confirmado');payment='À vista no Pix, confirmado no produto.';
  }else if(id==='guerradigital'){
   if(normalize(o?.seller?.name??'')!=='guerra digital')throw Error('Vendedor Guerra Digital não confirmado');const display=$('#price_display');price=brl(display.text());const cents=Number(display.attr('data-product-price'))/100;if(!price||Math.abs(price-cents)>.02||!/pix/i.test(display.parent().parent().text()))throw Error('Preço Pix não confirmado');original=brl($('#compare_price_display').text())||null;payment='À vista no Pix, confirmado no produto; preço regular pode ser diferente.';
  }else throw Error('Adaptador não habilitado');
 }
 if(o?.priceCurrency!=='BRL'||!Number.isFinite(price)||price<=0)throw Error('Preço BRL inválido');
 const available=availability(o.availability),title=String(p.name??'').trim();if(!title||title.length>1000)throw Error('Nome inválido');
 const specs=specificationData($,p,id);const images=[...new Set((Array.isArray(p.image)?p.image:[p.image]).map((x:any)=>typeof x==='string'?x:x?.url).filter((x:any)=>typeof x==='string'&&x.startsWith('https://'))) ] as string[];
 let brand=typeof p.brand==='string'?p.brand:p.brand?.name??null;if(brand&&['diversos','generico'].includes(normalize(brand)))brand=null;if(!brand&&specs.Marca)brand=specs.Marca;
 const now=new Date().toISOString();return {id:id+'-'+createHash('sha256').update(canonical).digest('hex').slice(0,20),store:id,url:canonical,title,category:classify(title),brand,mpn:manufacturerPart(p,title,specs),image:images[0]??null,images,price,original_price:original&&original>price?original:null,available,seller:names[id],sold:null,rating:Number(p.aggregateRating?.ratingValue)||null,review_count:Number(p.aggregateRating?.reviewCount)||null,specs,payment_note:payment,checked_at:now,expires_at:now};
}
