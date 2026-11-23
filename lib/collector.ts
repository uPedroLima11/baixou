import {ExcludedProduct} from './product-policy';
import robotsParser from 'robots-parser';import * as cheerio from 'cheerio/slim';import {createHash} from 'node:crypto';
import {adminDb,safeUrl} from './server';import {evidenceFromStats,classify,kitComponents,type Offer} from './types';
import {sources,candidateSourceIds,type Source} from '../scripts/sources';import {kabumDiscovery,kabumProduct} from '../scripts/parser';
import {parseStoreProduct,structuredProductLinks,ConfirmedUnavailable,type ParsedProduct} from '../scripts/store-adapters';import {identityForOffer,variantForOffer} from './identity';
import {productURL,categoryURL,candidateCategory,retryMinutes,verificationTTL,recheckMinutes,planBatch,pickDiscoveryPages} from './collection-policy';
type Options={check?:boolean;max?:number;stores?:string[];deadlineMs?:number;discoveryIntervalMinutes?:number;onProgress?:()=>Promise<void>};
function errorMessage(e:unknown){return e&&typeof e==='object'&&'message' in e?String(e.message).slice(0,220):'Falha sem mensagem';}
const agent='BaixouBot/1.0 (+https://github.com/uPedroLima11/baixou)';
export class RemovedProduct extends Error {constructor(status:number){super('HTTP '+status+' para página não encontrada da loja');}}
// Não segue redirects: apenas reconhece o destino explícito de remoção observado na Patoloco.
export function removedProductRedirect(url:string,status:number,location:string|null){
 if(![301,302,303,307,308].includes(status)||!location)return false;
 try{const source=new URL(url),target=new URL(location,source);return source.origin==='https://patoloco.com.br'&&target.origin===source.origin&&!target.username&&!target.password&&target.pathname==='/pagina-nao-encontrada'&&!target.search&&!target.hash;}catch{return false;}
}
export function collectorRetryMinutes(error:unknown,priorFailures:number){return error instanceof RemovedProduct?24*60:retryMinutes(priorFailures);}
function publicProductPath(url:string){const u=new URL(url);return u.origin+u.pathname;}
export async function runCollector(options:Options={}){
 const check=options.check??false,max=Math.min(100,Math.max(1,options.max??(Number(process.env.COLLECT_MAX_PRODUCTS)||40)));
 const enabled=options.stores??(process.env.COLLECT_STORES??candidateSourceIds.join(',')).split(',');
 const db=check?null:adminDb(),started=Date.now(),deadline=options.deadlineMs??(Math.min(420000,Number(process.env.COLLECT_DEADLINE_MS)||240000)),discoveryPages=options.deadlineMs?1:Math.min(4,Math.max(1,Number(process.env.COLLECT_DISCOVERY_PAGES)||1));let total=0,failures=0,discovered=0,ran=0,stockOnly=0,excluded=0;
 // Cortesia por domínio: pelo menos 1,5 s entre o início de duas requisições à mesma loja. O trabalho no banco
 // acontece durante esse intervalo, em vez de somar uma pausa fixa depois dele (mesma taxa máxima de requisições).
 let lastRequest=0;const pause=async()=>{const wait=lastRequest+1500-Date.now();if(wait>0)await new Promise(r=>setTimeout(r,wait));lastRequest=Date.now();};
 async function get(url:string){if(!safeUrl(url))throw Error('Host não permitido');const response=await fetch(url,{headers:{'User-Agent':agent,Accept:'text/html,application/xml'},redirect:'manual',signal:AbortSignal.timeout(8000)});if(removedProductRedirect(url,response.status,response.headers.get('location')))throw new RemovedProduct(response.status);if(!response.ok)throw Error('HTTP '+response.status);let text='',bytes=0;const reader=response.body?.getReader(),decoder=new TextDecoder();if(!reader)throw Error('Resposta vazia');for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>8000000){await reader.cancel();throw Error('Resposta maior que 8MB');}text+=decoder.decode(value,{stream:true});}return text;}
 for(const source of sources){if(!enabled.includes(source.id)||Date.now()-started>deadline-10000)continue;
  const lease='catalog:'+source.id;let claimed=false,count=0,errors=0,categoryErrors=0,newURLs=0,runId:number|undefined;
  const state=db?await db.from('collection_state').select('*').eq('store',source.id).maybeSingle():{data:null,error:null};if(state.error)throw state.error;
  if(state.data&&Date.parse(state.data.next_allowed_at)>Date.now())continue;
  if(db){const claim=await db.rpc('claim_collector_lease',{lease_name:lease,ttl_seconds:Math.ceil(deadline/1000)+30});if(claim.error)throw claim.error;if(!claim.data)continue;claimed=true;const run=await db.from('collection_runs').insert({store:source.id}).select('id').single();if(run.error)throw run.error;runId=run.data.id;}ran++;
  try{
   const rules=robotsParser(source.origin+'/robots.txt',await get(source.origin+'/robots.txt'));
   const allowed=(url:string)=>safeUrl(url)&&rules.isAllowed(url,agent)===true;
   const cursor=state.data?.cursor??0;
   let discover=true;
   if(db&&options.discoveryIntervalMinutes){const recent=await db.from('collection_pages').select('url').eq('store',source.id).gte('last_attempt_at',new Date(Date.now()-options.discoveryIntervalMinutes*60000).toISOString()).limit(1);if(recent.error)throw recent.error;discover=!recent.data?.length;}
   const fresh=new Set<string>();
   if(discover){
   if(db){const seeded=await db.from('collection_pages').upsert(source.paths.map(path=>({store:source.id,url:source.origin+path})),{onConflict:'store,url',ignoreDuplicates:true});if(seeded.error)throw seeded.error;}
   const duePages=db?await db.from('collection_pages').select('url,last_attempt_at').eq('store',source.id).lte('next_attempt_at',new Date().toISOString()).order('last_attempt_at',{ascending:true,nullsFirst:true}).order('url').limit(300):{data:[{url:source.origin+source.paths[cursor%source.paths.length],last_attempt_at:null}],error:null};if(duePages.error)throw duePages.error;
   const page={data:pickDiscoveryPages(duePages.data??[],new Set(source.paths.map(path=>source.origin+path)),db?discoveryPages:1,cursor)};
   for(const {url}of page.data??[]){if(!allowed(url)) {if(db)await db.from('collection_pages').update({last_attempt_at:new Date().toISOString(),next_attempt_at:new Date(Date.now()+86400000).toISOString()}).eq('store',source.id).eq('url',url);continue;}
    try{await pause();const html=await get(url),$=cheerio.load(html);
     const productLinks=source.id==='kabum'?kabumDiscovery(html):[...$('a[href]').toArray().map(a=>$(a).attr('href')!),...structuredProductLinks($)];
     for(const raw of productLinks){const u=productURL(raw,source);if(u&&allowed(u))fresh.add(u);}
     if(db){const categories=[...new Set($('a[href],link[rel="next"]').toArray().map(e=>categoryURL($(e).attr('href')??'',source)).filter((u):u is string=>!!u&&!!allowed(u)))].slice(0,150);
      if(categories.length){const inserted=await db.from('collection_pages').upsert(categories.map(url=>({store:source.id,url})),{onConflict:'store,url',ignoreDuplicates:true});if(inserted.error)throw inserted.error;}
      await db.from('collection_pages').update({last_attempt_at:new Date().toISOString(),next_attempt_at:new Date(Date.now()+60*60000).toISOString()}).eq('store',source.id).eq('url',url);
     }
    }catch(e){categoryErrors++;console.error(source.id,'categoria:',errorMessage(e));if(db)await db.from('collection_pages').update({last_attempt_at:new Date().toISOString(),next_attempt_at:new Date(Date.now()+6*3600000).toISOString()}).eq('store',source.id).eq('url',url);}
   }
   if(db&&fresh.size){const pool=await db.from('product_candidates').select('url',{count:'exact',head:true}).eq('store',source.id);if(pool.error)throw pool.error;const remaining=Math.max(0,2000-(pool.count??2000));if(remaining){const inserted=await db.from('product_candidates').upsert([...fresh].slice(0,Math.min(150,remaining)).map(url=>({store:source.id,url,category:candidateCategory(url)})),{onConflict:'store,url',ignoreDuplicates:true}).select('url');if(inserted.error)throw inserted.error;newURLs=inserted.data?.length??0;}}
   }
   const now=new Date().toISOString();
   // Até 20 candidatos nunca tentados por categoria (RPC), para o rodízio alcançar categorias recém-descobertas.
   const newRows=db?await db.rpc('diverse_candidates',{p_store:source.id,p_per_category:20}):{data:[...fresh].map(url=>({url,category:candidateCategory(url),failures:0})),error:null};
   // Prioridade no banco: acompanhados (alerta/favorito) > disponíveis pelo vencimento > demais (ver due_rechecks).
   const due=db?await db.rpc('due_rechecks',{p_store:source.id,p_limit:max}):{data:[],error:null};if(newRows.error||due.error)throw newRows.error??due.error;
   const signals=db?await db.from('discovery_events').select('canonical_url,discovery_sources!inner(enabled)').eq('status','ready').eq('discovery_sources.enabled',true).gte('posted_at',new Date(Date.now()-30*60000).toISOString()).order('received_at',{ascending:false}).limit(20):{data:[],error:null};if(signals.error)throw signals.error;
   const plan=planBatch((due.data??[]) as {url:string;category:string;failures:number}[],(newRows.data??[]) as {url:string;category:ReturnType<typeof candidateCategory>;failures:number}[],max),pending=plan.pending,rechecks=plan.rechecks;
   const urls=new Map<string,{url:string;failures:number}>();
   for(const signal of signals.data??[]){const u=productURL(signal.canonical_url,source);if(u)urls.set(u,{url:u,failures:0});}
   // Capacity-first: due rechecks are processed before new candidates; overdue items first by next_attempt_at.
   for(const item of [...rechecks,...pending])if(urls.size<max)urls.set(item.url,item);
   for(const {url,failures:priorFailures}of urls.values()){
    // Alertas exigem confirmação de até 5 min: o chamador pode enviar notificações durante a coleta longa.
    if(options.onProgress)await options.onProgress().catch(()=>console.error('Envio intermediário de alertas falhou'));
    if(Date.now()-started>deadline-10000)break;if(!allowed(url))continue;await pause();
    try{const html=await get(url);const base:ParsedProduct=source.id==='kabum'?kabumProduct(html,url):['terabyte','pichau'].includes(source.id)?generic(html,url,source):parseStoreProduct(source.id,html,url);
     if(base.category==='kit')for(const [k,v] of Object.entries(kitComponents(base.title)))base.specs['Componente do kit: '+k]??=v;
     if(!db){console.log(JSON.stringify({store:source.id,title:base.title,price:base.price,available:base.available,mpn:base.mpn,category:base.category}));count++;continue;}
     const [stats,provenance]=await Promise.all([db.rpc('price_history_stats',{p_offer_id:base.id}).single<{median:number|null;samples:number;days:number;max:number|null}>(),db.from('discovery_events').select('source_id,coupon_hint,discovery_sources!inner(name,attribution_url,enabled)').eq('canonical_url',url).eq('discovery_sources.enabled',true)]);if(stats.error)throw stats.error;if(provenance.error)throw provenance.error;
     const evidence=evidenceFromStats(base.price,base.original_price,stats.data??{median:null,samples:0,days:0}),ttl=verificationTTL(evidence.evidence,evidence.discount);
     const identity=identityForOffer({...base,...evidence} as Offer);let productId:string|null=null;
     if(identity){const resolved=await db.rpc('resolve_catalog_product',{p_brand:identity.brand,p_mpn:identity.mpn,p_gtin:identity.gtin,p_variant:identity.variant});if(resolved.error)throw resolved.error;productId=resolved.data;}
     const discoveries=[...new Map((provenance.data??[]).map((p:any)=>[p.source_id,{source:p.source_id,name:p.discovery_sources.name,url:p.discovery_sources.attribution_url}])).values()];
     const updated=await db.from('offers').upsert({...base,...evidence,product_id:productId,gtin:identity?.gtin??null,variant:identity?.variant??variantForOffer(base),discoveries,coupon_hint:provenance.data?.find(p=>p.coupon_hint)?.coupon_hint??null,coupon_validated:false,payment_note:base.payment_note??'À vista informado pela loja; frete e condições na origem.',last_attempt_at:new Date().toISOString(),verification_status:'verified',expires_at:new Date(Date.now()+ttl*60000).toISOString()});if(updated.error)throw updated.error;
     // Gravações independentes depois da oferta, em paralelo.
     const [hist,candidate]=await Promise.all([base.available?db.from('price_history').upsert({offer_id:base.id,price:base.price,bucket:new Date().toISOString().slice(0,13),observed_at:new Date().toISOString()},{onConflict:'offer_id,bucket',ignoreDuplicates:true}):Promise.resolve({error:null}),db.from('product_candidates').upsert({store:source.id,url,category:base.category,last_attempt_at:new Date().toISOString(),next_attempt_at:new Date(Date.now()+recheckMinutes(base.available,ttl)*60000).toISOString(),failures:0}),db.from('discovery_events').update({status:'validated',offer_id:base.id}).eq('canonical_url',url).eq('status','ready')]);if(hist.error)throw hist.error;if(candidate.error)throw candidate.error;count++;
    }catch(e){if(e instanceof ExcludedProduct){excluded++;if(db){const hidden=await db.from('offers').update({expires_at:new Date().toISOString(),verification_status:'excluded',last_attempt_at:new Date().toISOString()}).eq('url',url);if(hidden.error)throw hidden.error;const deferred=await db.from('product_candidates').upsert({store:source.id,url,category:candidateCategory(url),last_attempt_at:new Date().toISOString(),next_attempt_at:new Date(Date.now()+24*3600000).toISOString(),failures:0});if(deferred.error)throw deferred.error;}continue;}if(e instanceof ConfirmedUnavailable){stockOnly++;if(db){const stock=await db.from('offers').update({available:false,checked_at:new Date().toISOString(),expires_at:new Date().toISOString(),verification_status:'verified',last_attempt_at:new Date().toISOString()}).eq('url',url);if(stock.error)throw stock.error;const queued=await db.from('product_candidates').upsert({store:source.id,url,category:candidateCategory(url),last_attempt_at:new Date().toISOString(),next_attempt_at:new Date(Date.now()+180*60000).toISOString(),failures:0});if(queued.error)throw queued.error;}count++;continue;}errors++;console.error(source.id,'produto:',publicProductPath(url),errorMessage(e));if(db){await db.from('offers').update({last_attempt_at:new Date().toISOString(),verification_status:'failed'}).eq('url',url);await db.from('product_candidates').upsert({store:source.id,url,last_attempt_at:new Date().toISOString(),next_attempt_at:new Date(Date.now()+collectorRetryMinutes(e,priorFailures)*60000).toISOString(),failures:priorFailures+1});}}
   }
   if(!count&&(errors||categoryErrors)&&!state.data?.last_success_at)throw Error('Sem produtos verificáveis nesta fonte; consultar erros de categoria/produto');
   if(!count&&(errors||categoryErrors)&&state.data?.last_success_at){failures++;if(db)await db.from('source_status').upsert({store:source.id,status:'degraded',checked_at:new Date().toISOString(),products:0,message:'Tentativa com falha; última confirmação e ofertas preservadas até o TTL'});}
   if(db){const stateUpdate=await db.from('collection_state').upsert({store:source.id,cursor:cursor+(discover?1:0),failures:0,next_allowed_at:new Date().toISOString(),...(count?{last_success_at:new Date().toISOString()}:{})});if(stateUpdate.error)throw stateUpdate.error;
    if(count){const status=await db.from('source_status').upsert({store:source.id,status:'ok',checked_at:new Date().toISOString(),products:count,message:'Produtos confirmados na loja; descoberta progressiva'});if(status.error)throw status.error;}
   }total+=count;discovered+=newURLs;
  }catch(e){failures++;const message=errorMessage(e);console.error(source.id,message);if(db){await db.from('collection_state').upsert({store:source.id,failures:(state.data?.failures??0)+1,next_allowed_at:new Date(Date.now()+retryMinutes((state.data?.failures??0)+2)*60000).toISOString()});await db.from('source_status').upsert({store:source.id,status:'blocked',checked_at:new Date().toISOString(),products:count,message:message.slice(0,180)});}}
  finally{if(db){if(runId)await db.from('collection_runs').update({finished_at:new Date().toISOString(),discovered:newURLs,verified:count,failed:errors+categoryErrors,message:categoryErrors?'Falha de categoria; produtos e última confirmação foram preservados':null}).eq('id',runId);if(claimed)await db.rpc('release_collector_lease',{lease_name:lease});}}
 }
 if(db&&enabled.includes('kabum')&&total){await db.from('price_history').delete().lt('observed_at',new Date(Date.now()-35*86400000).toISOString());await db.from('collection_runs').delete().lt('started_at',new Date(Date.now()-7*86400000).toISOString());}
 return {total,failures,discovered,stock_only_checks:stockOnly,excluded,stores:enabled,skipped:ran===0};
}

function generic(html:string,url:string,source:typeof sources[number]){
const $=cheerio.load(html);let product:any;for(const el of $('script[type="application/ld+json"]').toArray()){try{const data=JSON.parse($(el).text()),nodes=Array.isArray(data)?data:data['@graph']??[data];product=nodes.find((n:any)=>n['@type']==='Product');if(product)break;}catch{}}
if(!product)throw Error('Sem dados estruturados verificáveis');const o=Array.isArray(product.offers)?product.offers[0]:product.offers;
if(!o||o.priceCurrency!=='BRL')throw Error('Sem preço em BRL');const seller=o.seller?.name??'';if(!seller.toLowerCase().includes(source.id==='terabyte'?'terabyte':'pichau'))throw Error('Vendedor próprio não confirmado');
const price=Number(o.price);if(!Number.isFinite(price)||price<=0)throw Error('Preço inválido');
const images=(Array.isArray(product.image)?product.image:[product.image]).map((i:any)=>typeof i==='string'?i:i?.url).filter((i:any)=>typeof i==='string'&&i.startsWith('https://'));
const now=new Date();return {id:source.id+'-'+createHash('sha256').update(url).digest('hex').slice(0,20),store:source.id,url,title:String(product.name),category:classify(product.name),brand:typeof product.brand==='string'?product.brand:product.brand?.name??null,mpn:product.mpn??null,image:images[0]??null,images,price,original_price:null,available:String(o.availability).endsWith('/InStock'),seller,sold:null,rating:Number(product.aggregateRating?.ratingValue)||null,review_count:Number(product.aggregateRating?.reviewCount)||null,specs:{},checked_at:now.toISOString(),expires_at:new Date(now.getTime()+30*60000).toISOString()};
}

