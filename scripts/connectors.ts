// Executa conectores oficiais/alternativos independentes (lib/connectors). Só roda os que estão implementados
// e com variáveis presentes; cada anúncio passa pela política de publicação antes de ser gravado.
import {adminDb} from '../lib/server';
import {connectors} from '../lib/connectors/registry';
import {acceptListing} from '../lib/connectors/policy';
import {listingToProduct} from '../lib/connectors/convert';
import {persistVerifiedProduct} from '../lib/connectors/persist';
import {storeNames} from '../lib/stores';
import {knownCodeInTitle,knownCodeInSlug,manufacturerCode,brandInTitle} from '../lib/identity';
import {ANNOUNCED_TTL_MINUTES} from '../lib/connectors/telegram-channels';
const db=adminDb(),env=process.env,deadline=Date.now()+Math.min(300000,Number(env.CONNECTOR_DEADLINE_MS)||240000);
const only=(env.CONNECTORS??'').split(',').map(s=>s.trim()).filter(Boolean);
let failedConnectors=0;
// Códigos de fabricante já registrados por marca (dados estruturados das lojas), para reconhecer o MESMO código
// impresso em títulos do Mercado Livre (knownCodeInTitle). Somente igualdade exata.
const known=new Map<string,Set<string>>();
// Marcas conhecidas (canônicas) para reconhecer o fabricante no título de anúncios que não informam marca.
const brands=new Set<string>();
for(let from=0;from<20000;from+=1000){const r=await db.from('catalog_products').select('brand,mpn').not('mpn','is',null).range(from,from+999);if(r.error)throw r.error;for(const row of r.data??[]){brands.add(row.brand);const set=known.get(row.brand)??new Set<string>();set.add(String(row.mpn));known.set(row.brand,set);}if((r.data?.length??0)<1000)break;}
for(const c of connectors){
 if(only.length&&!only.includes(c.id))continue;
 const missing=c.requiredEnv.filter(n=>!env[n]?.trim());
 if(!c.implemented||missing.length){console.log(JSON.stringify({connector:c.id,skipped:true,reason:!c.implemented?'não implementado':'variáveis ausentes: '+missing.join(',')}));continue;}
 const lease='connector:'+c.id,claim=await db.rpc('claim_collector_lease',{lease_name:lease,ttl_seconds:Math.ceil((deadline-Date.now())/1000)+60});
 if(claim.error)throw claim.error;if(!claim.data){console.log(JSON.stringify({connector:c.id,skipped:true,reason:'lease ocupado'}));continue;}
 let store='',runId:number|undefined,accepted=0,rejected=0,errors=0,discounts=0,olderPosts=0,liveAnnounced=0;const reasons:Record<string,number>={};
 try{
  for await(const listing of c.listings({env,fetch,deadline,maxListings:Number(env.CONNECTOR_MAX_LISTINGS)||600})){
   store=listing.source;
   if(runId===undefined){const run=await db.from('collection_runs').insert({store}).select('id').single();if(run.error)throw run.error;runId=run.data.id;}
   const decision=acceptListing(listing,{hosts:c.hosts,marketplace:c.marketplace});
   if(!decision.ok){rejected++;reasons[decision.reason]=(reasons[decision.reason]??0)+1;continue;}
   // Post anterior do mesmo produto (mesma execução, já gravado pelo mais recente): só histórico de preços anunciados.
   if(listing.announcement&&listing.announcement.latest===false){const a=listing.announcement,rec=await db.rpc('record_announcement',{p_offer:listingToProduct(listing,c.name).id,p_price:listing.price,p_posted_at:a.postedAt,p_post:a.channel+'/'+a.postId});if(rec.error){errors++;console.error(c.id,'histórico anunciado:',String(rec.error.message).slice(0,200));}else olderPosts++;continue;}
   if(listing.announcement&&Date.parse(listing.announcement.postedAt)>Date.now()-ANNOUNCED_TTL_MINUTES*60000)liveAnnounced++;
   // Último post do produto, mas já fora da validade de 6 h: a oferta não volta ao catálogo; basta o histórico anunciado
   // (1 chamada). Se o anúncio ainda não existe no banco (FK), cai na gravação completa abaixo.
   else if(listing.announcement){const a=listing.announcement,rec=await db.rpc('record_announcement',{p_offer:listingToProduct(listing,c.name).id,p_price:listing.price,p_posted_at:a.postedAt,p_post:a.channel+'/'+a.postId});if(!rec.error){olderPosts++;continue;}}
   if(!listing.brand)listing.brand=brandInTitle(listing.title,brands);
   if(!listing.mpn&&!listing.gtin&&listing.brand){const code=manufacturerCode(null,listing.title)??knownCodeInTitle(listing.title,listing.brand,known)??knownCodeInSlug(listing.url,listing.brand,known);if(code)listing.mpn=code;}
   try{const product=listingToProduct(listing,storeNames[listing.source]??c.name);if(listing.announcement){const a=listing.announcement;product.payment_note='Preço à vista anunciado no '+a.label+' em '+new Date(a.postedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+(a.installmentTotal?'; parcelado R$ '+a.installmentTotal.toLocaleString('pt-BR',{minimumFractionDigits:2}):'')+'. Página do produto não conferida pelo Baixou!: confirme preço e estoque na loja.';product.specs={...product.specs,'Fonte do preço':'Anúncio da loja no Telegram (t.me/'+a.channel+'/'+a.postId+')'};}
    const evidence=await persistVerifiedProduct(db,product,listing.announcement?{at:listing.announcement.postedAt,ttlMinutes:ANNOUNCED_TTL_MINUTES,post:listing.announcement.channel+'/'+listing.announcement.postId}:undefined);accepted++;if(evidence.evidence!=='none')discounts++;}
   catch(e){errors++;console.error(c.id,'gravação:',e&&typeof e==='object'&&'message' in e?String(e.message).slice(0,200):'erro');}
  }
  if(store){const status=await db.from('source_status').upsert({store,status:accepted?'ok':'degraded',checked_at:new Date().toISOString(),products:accepted,message:accepted?(c.id.endsWith('-telegram')?c.name+': '+liveAnnounced+' preços anunciados pela loja nas últimas 6 h, '+accepted+' produtos nas últimas 24 h (página do produto não conferida)':c.name+': anúncios confirmados nas vitrines públicas'):'Nenhum anúncio aprovado nesta execução; ofertas anteriores vencem pelo TTL'});if(status.error)throw status.error;}
 }catch(e){failedConnectors++;errors++;console.error(c.id,e&&typeof e==='object'&&'message' in e?String(e.message).slice(0,200):'erro');}
 finally{if(runId)await db.from('collection_runs').update({finished_at:new Date().toISOString(),verified:accepted,failed:errors,discovered:0,message:rejected?('Rejeitados pela política: '+JSON.stringify(reasons)).slice(0,300):null}).eq('id',runId);await db.rpc('release_collector_lease',{lease_name:lease});}
 console.log(JSON.stringify({connector:c.id,store,accepted,live_announced:liveAnnounced,older_posts_history:olderPosts,announced_or_proven_discounts:discounts,rejected,reasons,errors}));
 if(!accepted&&!store)failedConnectors++;
}
if(failedConnectors)process.exitCode=1;
