import * as cheerio from 'cheerio';import type {Offer} from '../lib/types';import {classify} from '../lib/types';
export function kabumDiscovery(html:string){const $=cheerio.load(html);const next=JSON.parse($('#__NEXT_DATA__').text()||'{}');const raw=next.props?.pageProps?.data;const data=typeof raw==='string'?JSON.parse(raw):raw;return (data?.catalogServer?.data??[]).filter((p:any)=>p.code&&p.friendlyName).map((p:any)=>'https://www.kabum.com.br/produto/'+p.code+'/'+p.friendlyName);}
export function kabumProduct(html:string,url:string):Omit<Offer,'historical_median'|'historical_samples'|'historical_days'|'discount'|'evidence'>{
 const $=cheerio.load(html);const next=JSON.parse($('#__NEXT_DATA__').text()||'{}');const p=next.props?.pageProps?.product;
 if(!p?.title||!p?.prices)throw new Error('Produto não encontrado no HTML');
 if(Number(p.sellerId)!==0||p.sellerName!=='KaBuM!'||p.flags?.isMarketplace||p.flags?.isMarketPlaceProduct)throw new Error('Vendedor fora da lista de confiança');
 if(p.flags?.isPreOrder||p.flags?.isOpenbox)throw new Error('Pré-venda/open box não incluídos');
 const price=Number(p.prices.priceWithDiscount);if(!Number.isFinite(price)||price<=0)throw new Error('Preço inválido');
 const specDoc=cheerio.load(p.technicalInformation?.text??'');specDoc('br').replaceWith('\n');specDoc('p,li,tr').append('\n');
 const lines=specDoc.root().text().split(/\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
 const specs:Record<string,string>={};for(let i=0;i<lines.length;i++){const line=lines[i];const split=line.indexOf(':');if(split>0&&split<80){const k=line.slice(0,split).replace(/^[-•]\s*/,'');const v=line.slice(split+1).trim()||lines[i+1];if(v)specs[k.slice(0,80)]=v.slice(0,400);}}
 const mpn=Object.entries(specs).find(([k])=>/^(modelo|part number|mpn)$/i.test(k))?.[1]??null;
 const images=(p.medias??[]).map((m:any)=>m.images?.gg??m.images?.g).filter((s:any)=>typeof s==='string'&&s.startsWith('https://')&&new URL(s).hostname.endsWith('kabum.com.br')).slice(0,10);
 const now=new Date();return {id:'kabum-'+(p.id??new URL(url).pathname.split('/')[2]),store:'kabum',url:url.split('?')[0],title:String(p.title).slice(0,500),category:classify(p.title),brand:p.manufacturer?.name??null,mpn,image:images[0]??null,images,price,original_price:Number(p.prices.oldPrice)>price?Number(p.prices.oldPrice):null,available:!!p.available&&p.flags?.isAvailable===true&&p.flags?.isActive===true,seller:p.sellerName,sold:null,rating:p.rating?.score?Number(p.rating.score):p.rating?.average?Number(p.rating.average):null,review_count:Number(p.rating?.count)||null,specs,checked_at:now.toISOString(),expires_at:new Date(now.getTime()+30*60000).toISOString()};
}
