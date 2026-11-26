import * as cheerio from 'cheerio/slim';
import {kabumDiscovery,chipartLinks} from './parser';
import {vtexLinkTexts,structuredProductLinks} from './store-adapters';
import {sources} from './sources';
import {productURL} from '../lib/collection-policy';
export const TARGETED_STORES=['kabum','patoloco','ibyte','chipart','shopinfo'];
// Lojas cuja descoberta direcionada usa o sitemap publicado (busca bloqueada por limite de taxa).
export const SITEMAP_STORES=['chipart'];
export function sitemapLocs(xml:string){return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m=>m[1].replace(/&amp;/g,'&')).filter(u=>/^https:\/\//.test(u)).slice(0,50000);}
export function replacementUrls(urls:string[],protectedUrls:Set<string>,exact:string[],limit:number){return urls.filter(u=>!protectedUrls.has(u)&&!exact.includes(u)).slice(0,Math.max(0,Math.min(3,limit)));}
export function targetedSearchUrl(id:string,mpn:string){
 const origin=sources.find(s=>s.id===id)?.origin;if(!origin)return null;
 if(id==='kabum')return origin+'/busca/'+encodeURIComponent(mpn.toLowerCase().replace(/[^a-z0-9]/g,''));
 if(id==='patoloco')return origin+'/busca/?buscar-por='+encodeURIComponent(mpn);
 if(id==='ibyte')return origin+'/'+encodeURIComponent(mpn.toLowerCase().replace(/[^a-z0-9-]/g,'-'));
 if(id==='chipart')return origin+'/pesquisa?q='+encodeURIComponent(mpn);
 if(id==='shopinfo')return origin+'/search?q='+encodeURIComponent(mpn)+'&type=product';
 return null;
}
export function targetedProductLinks(id:string,html:string):string[]{
 const source=sources.find(s=>s.id===id);if(!source)return [];
 const $=cheerio.load(html);
 const links:string[]=id==='kabum'?kabumDiscovery(html):id==='chipart'?chipartLinks(html):id==='ibyte'?vtexLinkTexts(html).map(slug=>source.origin+'/'+slug+'/p'):[...$('a[href]').toArray().map(a=>String($(a).attr('href')??'')).map(h=>id==='shopinfo'?h.replace(/^\/collections\/[^/]+(?=\/products\/)/,''):h),...structuredProductLinks($)];
 return [...new Set(links.map(l=>productURL(l,source)).filter((l):l is string=>!!l))];
}
