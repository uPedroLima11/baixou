import robotsParser from 'robots-parser';import * as cheerio from 'cheerio';import {createHash} from 'node:crypto';import {adminDb,safeUrl} from '../lib/server';import {calculateEvidence,classify} from '../lib/types';import {sources} from './sources';import {kabumDiscovery,kabumProduct} from './parser';
const check=process.argv.includes('--check');const max=Math.min(120,Math.max(1,Number(process.env.COLLECT_MAX_PRODUCTS)||36));const enabled=(process.env.COLLECT_STORES??'kabum,terabyte,pichau').split(',');
const agent='BaixouBot/1.0 (+https://github.com/uPedroLima11/baixou)';const db=check?null:adminDb();
const pause=()=>new Promise(r=>setTimeout(r,1500));let failures=0;
async function get(url:string){if(!safeUrl(url))throw Error('Host não permitido');const r=await fetch(url,{headers:{'User-Agent':agent,'Accept':'text/html'},signal:AbortSignal.timeout(15000),redirect:'manual'});if(!r.ok)throw Error('HTTP '+r.status);const size=Number(r.headers.get('content-length')??0);if(size>8000000)throw Error('Resposta muito grande');const body=await r.text();if(body.length>8000000)throw Error('Resposta muito grande');return body;}
function generic(html:string,url:string,source:typeof sources[number]){
 const $=cheerio.load(html);let product:any;for(const el of $('script[type="application/ld+json"]').toArray()){try{const data=JSON.parse($(el).text());const nodes=Array.isArray(data)?data:data['@graph']??[data];product=nodes.find((n:any)=>n['@type']==='Product');if(product)break;}catch{}}
 if(!product)throw Error('Sem dados estruturados verificáveis');const o=Array.isArray(product.offers)?product.offers[0]:product.offers;
 if(!o||o.priceCurrency!=='BRL')throw Error('Sem preço em BRL');const seller=o.seller?.name??'';
 if(!seller.toLowerCase().includes(source.id==='terabyte'?'terabyte':'pichau'))throw Error('Vendedor próprio não confirmado');
 const price=Number(o.price);if(!Number.isFinite(price)||price<=0)throw Error('Preço inválido');
 const imgs=(Array.isArray(product.image)?product.image:[product.image]).map((i:any)=>typeof i==='string'?i:i?.url).filter((i:any)=>typeof i==='string'&&i.startsWith('https://'));
 const now=new Date();return {id:source.id+'-'+createHash('sha256').update(url).digest('hex').slice(0,20),store:source.id,url,title:String(product.name),category:classify(product.name),brand:typeof product.brand==='string'?product.brand:product.brand?.name??null,mpn:product.mpn??null,image:imgs[0]??null,images:imgs,price,original_price:null,available:String(o.availability).endsWith('/InStock'),seller,sold:null,rating:Number(product.aggregateRating?.ratingValue)||null,review_count:Number(product.aggregateRating?.reviewCount)||null,specs:{},checked_at:now.toISOString(),expires_at:new Date(now.getTime()+30*60000).toISOString()};
}
for(const source of sources){if(!enabled.includes(source.id))continue;let count=0;try{
 const robots=robotsParser(source.origin+'/robots.txt',await get(source.origin+'/robots.txt'));
 const existing=db?await db.from('offers').select('url').eq('store',source.id).order('checked_at',{ascending:true}).limit(Math.ceil(max/2)):{data:[]};
 const urls=new Set<string>((existing.data??[]).map(x=>x.url));
 const slot=Math.floor(Date.now()/(15*60000));const paths=[source.paths[slot%source.paths.length],source.paths[(slot+1)%source.paths.length]];
 for(const path of paths){const url=source.origin+path;if(robots.isAllowed(url,agent)!==true)continue;await pause();const html=await get(url);if(source.id==='kabum')kabumDiscovery(html).forEach((u:string)=>urls.add(u));else{const $=cheerio.load(html);$('a[href]').each((_,a)=>{const u=new URL($(a).attr('href')!,source.origin);if(u.origin===source.origin&&!u.search&&source.product.test(u.pathname))urls.add(u.href);});}}
 for(const url of [...urls].slice(0,max)){if(robots.isAllowed(url,agent)!==true)continue;await pause();try{
 const html=await get(url);const base=source.id==='kabum'?kabumProduct(html,url):generic(html,url,source);
 if(base.available&&base.review_count!==null&&base.review_count<10)continue;
 if(!db){console.log(JSON.stringify({store:source.id,id:base.id,title:base.title,price:base.price,available:base.available,reviews:base.review_count,image:base.image}));count++;continue;}
 const history=await db.from('price_history').select('price,observed_at').eq('offer_id',base.id).gte('observed_at',new Date(Date.now()-30*86400000).toISOString()).order('observed_at',{ascending:false}).limit(1000);
 if(history.error)throw history.error;
 const evidence=calculateEvidence(base.price,base.original_price,history.data??[]);
 const ttl=Math.min(120,Math.max(10,Number(process.env.OFFER_TTL_MINUTES)||30));
 const {error}=await db.from('offers').upsert({...base,...evidence,expires_at:new Date(Date.now()+ttl*60000).toISOString()});if(error)throw error;
 if(base.available){const bucket=new Date().toISOString().slice(0,13);const {error:he}=await db.from('price_history').upsert({offer_id:base.id,price:base.price,bucket,observed_at:new Date().toISOString()},{onConflict:'offer_id,bucket',ignoreDuplicates:true});if(he)throw he;}
 count++;
 }catch(e){console.error(source.id,'produto ignorado:',e instanceof Error?e.message:'erro');}}
 if(!count)throw Error('Nenhum produto validado');
 if(db){const {error}=await db.from('source_status').upsert({store:source.id,status:'ok',checked_at:new Date().toISOString(),products:count,message:'Produtos confirmados na loja'});if(error)throw error;}console.log(source.id+': '+count+' produtos validados');
 }catch(e){failures++;const message=e instanceof Error?e.message:'Falha de coleta';console.error(source.id+': '+message);if(db)await db.from('source_status').upsert({store:source.id,status:'blocked',checked_at:new Date().toISOString(),products:count,message:message.startsWith('HTTP')?message:'Fonte indisponível para coleta'});}}
if(db){const cutoff=new Date(Date.now()-35*86400000).toISOString();const {error}=await db.from('price_history').delete().lt('observed_at',cutoff);if(error)throw error;}
if(failures===enabled.length)process.exitCode=1;
