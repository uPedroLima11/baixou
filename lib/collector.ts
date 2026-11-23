import robotsParser from 'robots-parser';import * as cheerio from 'cheerio';import {createHash} from 'node:crypto';
import {adminDb,safeUrl} from './server';import {calculateEvidence,classify,type Offer} from './types';import {sources} from '../scripts/sources';import {kabumDiscovery,kabumProduct} from '../scripts/parser';
import {identityForOffer,variantForOffer} from './identity';
type Options={check?:boolean;max?:number;stores?:string[];deadlineMs?:number};
export async function runCollector(options:Options={}){
const check=options.check??false,max=Math.min(120,Math.max(1,options.max??(Number(process.env.COLLECT_MAX_PRODUCTS)||36)));
const enabled=options.stores??(process.env.COLLECT_STORES??'kabum,terabyte,pichau').split(',');
const agent='BaixouBot/1.0 (+https://github.com/uPedroLima11/baixou)',db=check?null:adminDb();
const started=Date.now(),deadline=options.deadlineMs??4*60000,pause=()=>new Promise(r=>setTimeout(r,1500));
let total=0,failures=0;
if(db){const {data,error}=await db.rpc('claim_collector_lease',{lease_name:'catalog',ttl_seconds:Math.ceil(deadline/1000)+30});if(error)throw error;if(!data)return {skipped:true,total:0,failures:0};}
async function get(url:string){if(!safeUrl(url))throw Error('Host não permitido');const r=await fetch(url,{headers:{'User-Agent':agent,'Accept':'text/html'},signal:AbortSignal.timeout(12000),redirect:'manual'});if(!r.ok)throw Error('HTTP '+r.status);if(Number(r.headers.get('content-length')??0)>8000000)throw Error('Resposta muito grande');let body='',bytes=0;const reader=r.body?.getReader();if(!reader)throw Error('Resposta vazia');const decoder=new TextDecoder();for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>8000000){await reader.cancel();throw Error('Resposta muito grande');}body+=decoder.decode(value,{stream:true});}return body;}
try{for(const source of sources){if(!enabled.includes(source.id)||Date.now()-started>deadline-15000)continue;let count=0;
try{
 const robots=robotsParser(source.origin+'/robots.txt',await get(source.origin+'/robots.txt'));
 const prior=db?await db.from('offers').select('url').eq('store',source.id).order('checked_at',{ascending:true}).limit(options.deadlineMs?max:Math.floor(max/2)):{data:[]};
 if('error' in prior&&prior.error)throw prior.error;
 const signals=db?await db.from('discovery_events').select('canonical_url,discovery_sources!inner(enabled)').eq('status','ready').eq('discovery_sources.enabled',true).gte('posted_at',new Date(Date.now()-30*60000).toISOString()).order('received_at',{ascending:false}).limit(30):{data:[]};
 const urls=new Set<string>((signals.data??[]).map(x=>x.canonical_url).filter((u:string)=>u&&new URL(u).origin===source.origin));
 (prior.data??[]).forEach(x=>urls.add(x.url));
 const slot=Math.floor(Date.now()/(5*60000)),paths=[source.paths[slot%source.paths.length],source.id==='kabum'?'/hardware':source.paths[(slot+1)%source.paths.length]];
 for(const path of paths){const url=source.origin+path;if(robots.isAllowed(url,agent)!==true)continue;try{await pause();const html=await get(url);
 if(source.id==='kabum')kabumDiscovery(html).forEach((u:string)=>urls.add(u));else{const $=cheerio.load(html);$('a[href]').each((_,a)=>{try{const u=new URL($(a).attr('href')!,source.origin);if(u.origin===source.origin&&!u.search&&source.product.test(u.pathname))urls.add(u.href);}catch{}});}
 }catch(e){console.error(source.id,'categoria indisponível:',e instanceof Error?e.message:'falha');}}
 for(const url of [...urls].slice(0,max)){if(Date.now()-started>deadline-15000)break;if(!safeUrl(url)||robots.isAllowed(url,agent)!==true)continue;await pause();
 try{const html=await get(url),base=source.id==='kabum'?kabumProduct(html,url):generic(html,url,source);
 if(!db){console.log(JSON.stringify({store:source.id,id:base.id,title:base.title,price:base.price,available:base.available,reviews:base.review_count,image:base.image}));count++;continue;}
 const history=await db.from('price_history').select('price,observed_at').eq('offer_id',base.id).gte('observed_at',new Date(Date.now()-30*86400000).toISOString()).order('observed_at',{ascending:false}).limit(1000);if(history.error)throw history.error;
 const evidence=calculateEvidence(base.price,base.original_price,history.data??[]);
 const {data:provenance,error:pe}=await db.from('discovery_events').select('source_id,coupon_hint,discovery_sources!inner(name,attribution_url,enabled)').eq('canonical_url',url).eq('discovery_sources.enabled',true);if(pe)throw pe;
 const discoveries=[...new Map((provenance??[]).map((p:any)=>[p.source_id,{source:p.source_id,name:p.discovery_sources.name,url:p.discovery_sources.attribution_url}])).values()];
 const ttl=Math.min(120,Math.max(10,Number(process.env.OFFER_TTL_MINUTES)||30));
 const identity=identityForOffer({...base,...evidence} as Offer);let productId:string|null=null;if(identity){const resolved=await db.rpc('resolve_catalog_product',{p_brand:identity.brand,p_mpn:identity.mpn,p_gtin:identity.gtin,p_variant:identity.variant});if(resolved.error)throw resolved.error;productId=resolved.data;}
 const {error}=await db.from('offers').upsert({...base,...evidence,last_attempt_at:new Date().toISOString(),verification_status:'verified',product_id:productId,gtin:identity?.gtin??null,variant:identity?.variant??variantForOffer(base),discoveries,coupon_hint:provenance?.find(p=>p.coupon_hint)?.coupon_hint??null,coupon_validated:false,payment_note:'Preço à vista informado pela loja. Frete, parcelas e cupons devem ser confirmados na origem.',expires_at:new Date(Date.now()+ttl*60000).toISOString()});if(error)throw error;
 if(base.available){const bucket=new Date().toISOString().slice(0,13);const {error:he}=await db.from('price_history').upsert({offer_id:base.id,price:base.price,bucket,observed_at:new Date().toISOString()},{onConflict:'offer_id,bucket',ignoreDuplicates:true});if(he)throw he;}
 await db.from('discovery_events').update({status:'validated',offer_id:base.id}).eq('canonical_url',url).eq('status','ready');count++;
 }catch(e){if(db)await db.from('offers').update({last_attempt_at:new Date().toISOString(),verification_status:'failed'}).eq('url',url);console.error(source.id,'produto ignorado:',e instanceof Error?e.message:'erro');}}
 if(!count)throw Error('Nenhum produto validado');
 if(db){const {error}=await db.from('source_status').upsert({store:source.id,status:'ok',checked_at:new Date().toISOString(),products:count,message:'Produtos confirmados na loja'});if(error)throw error;}total+=count;console.log(source.id+': '+count+' produtos validados');
}catch(e){failures++;const message=e instanceof Error?e.message:'Falha de coleta';console.error(source.id+': '+message);if(db){const {error}=await db.from('source_status').upsert({store:source.id,status:'blocked',checked_at:new Date().toISOString(),products:count,message:message.startsWith('HTTP')?message:'Fonte indisponível para coleta'});if(error)throw error;}}}
if(db){const {error}=await db.from('price_history').delete().lt('observed_at',new Date(Date.now()-35*86400000).toISOString());if(error)throw error;}
return {total,failures,skipped:false};
}finally{if(db)await db.rpc('release_collector_lease',{lease_name:'catalog'});}
}
function generic(html:string,url:string,source:typeof sources[number]){
const $=cheerio.load(html);let product:any;for(const el of $('script[type="application/ld+json"]').toArray()){try{const data=JSON.parse($(el).text()),nodes=Array.isArray(data)?data:data['@graph']??[data];product=nodes.find((n:any)=>n['@type']==='Product');if(product)break;}catch{}}
if(!product)throw Error('Sem dados estruturados verificáveis');const o=Array.isArray(product.offers)?product.offers[0]:product.offers;
if(!o||o.priceCurrency!=='BRL')throw Error('Sem preço em BRL');const seller=o.seller?.name??'';if(!seller.toLowerCase().includes(source.id==='terabyte'?'terabyte':'pichau'))throw Error('Vendedor próprio não confirmado');
const price=Number(o.price);if(!Number.isFinite(price)||price<=0)throw Error('Preço inválido');
const images=(Array.isArray(product.image)?product.image:[product.image]).map((i:any)=>typeof i==='string'?i:i?.url).filter((i:any)=>typeof i==='string'&&i.startsWith('https://'));
const now=new Date();return {id:source.id+'-'+createHash('sha256').update(url).digest('hex').slice(0,20),store:source.id,url,title:String(product.name),category:classify(product.name),brand:typeof product.brand==='string'?product.brand:product.brand?.name??null,mpn:product.mpn??null,image:images[0]??null,images,price,original_price:null,available:String(o.availability).endsWith('/InStock'),seller,sold:null,rating:Number(product.aggregateRating?.ratingValue)||null,review_count:Number(product.aggregateRating?.reviewCount)||null,specs:{},checked_at:now.toISOString(),expires_at:new Date(now.getTime()+30*60000).toISOString()};
}

