// Executa conectores oficiais/alternativos independentes (lib/connectors). Só roda os que estão implementados
// e com variáveis presentes; cada anúncio passa pela política de publicação antes de ser gravado.
import {adminDb} from '../lib/server';
import {connectors} from '../lib/connectors/registry';
import {acceptListing} from '../lib/connectors/policy';
import {listingToProduct} from '../lib/connectors/convert';
import {persistVerifiedProduct} from '../lib/connectors/persist';
import {storeNames} from '../lib/stores';
import {ANNOUNCED_TTL_MINUTES} from '../lib/connectors/telegram-channels';
import {loadKnownCodes,enrichListing,announcedProduct,recordAnnouncement} from '../lib/connectors/announce';
const db=adminDb(),env=process.env,deadline=Date.now()+Math.min(300000,Number(env.CONNECTOR_DEADLINE_MS)||240000);
const only=(env.CONNECTORS??'').split(',').map(s=>s.trim()).filter(Boolean);
let failedConnectors=0;
// Códigos de fabricante e marcas já registrados (dados estruturados das lojas), só para igualdade exata.
const {known,brands}=await loadKnownCodes(db);
for(const c of connectors){
 if(only.length&&!only.includes(c.id))continue;
 const missing=c.requiredEnv.filter(n=>!env[n]?.trim());
 if(!c.implemented||missing.length){console.log(JSON.stringify({connector:c.id,skipped:true,reason:!c.implemented?'não implementado':'variáveis ausentes: '+missing.join(',')}));continue;}
 const lease='connector:'+c.id,claim=await db.rpc('claim_collector_lease',{lease_name:lease,ttl_seconds:Math.ceil((deadline-Date.now())/1000)+60});
 if(claim.error)throw claim.error;if(!claim.data){console.log(JSON.stringify({connector:c.id,skipped:true,reason:'lease ocupado'}));continue;}
 let store='',runId:number|undefined,accepted=0,rejected=0,errors=0,discounts=0,olderPosts=0,liveAnnounced=0;const reasons:Record<string,number>={};
 try{
  const own=Math.min(deadline,Date.now()+(c.budgetMs??Infinity));
  const announcementTitles=new Map<string,string>();
  if(c.id.endsWith('-telegram')){for(let from=0;from<10000;from+=1000){const r=await db.from('offers').select('url,title').eq('store',c.id.replace('-telegram','')).eq('verification_status','announced').order('id').range(from,from+999);if(r.error)throw r.error;for(const row of r.data??[])announcementTitles.set(row.url,row.title);if(r.data.length<1000)break;}}
  for await(const listing of c.listings({env,fetch,deadline:own,maxListings:Number(env.CONNECTOR_MAX_LISTINGS)||600,announcementTitles})){
   if(Date.now()>own){console.log(JSON.stringify({connector:c.id,budget_exhausted:true}));break;}
   store=listing.source;
   if(runId===undefined){const run=await db.from('collection_runs').insert({store}).select('id').single();if(run.error)throw run.error;runId=run.data.id;}
   const decision=acceptListing(listing,{hosts:c.hosts,marketplace:c.marketplace});
   if(!decision.ok){rejected++;reasons[decision.reason]=(reasons[decision.reason]??0)+1;continue;}
   // Post anterior do mesmo produto (mesma execução, já gravado pelo mais recente): só histórico de preços anunciados.
   if(listing.announcement&&listing.announcement.latest===false){if(await recordAnnouncement(db,listing,c.name))olderPosts++;else{errors++;console.error(c.id,'histórico anunciado falhou');}continue;}
   if(listing.announcement&&Date.parse(listing.announcement.postedAt)>Date.now()-ANNOUNCED_TTL_MINUTES*60000)liveAnnounced++;
   // Último post do produto, mas já fora da validade de 6 h: a oferta não volta ao catálogo; basta o histórico anunciado
   // (1 chamada). Se o anúncio ainda não existe no banco (FK), cai na gravação completa abaixo.
   else if(listing.announcement&&await recordAnnouncement(db,listing,c.name)){olderPosts++;continue;}
   enrichListing(listing,known,brands);
   try{const product=listing.announcement?announcedProduct(listing,c.name):listingToProduct(listing,storeNames[listing.source]??c.name);
    const evidence=await persistVerifiedProduct(db,product,listing.announcement?{at:listing.announcement.postedAt,ttlMinutes:ANNOUNCED_TTL_MINUTES,post:listing.announcement.channel+'/'+listing.announcement.postId}:undefined);accepted++;if(evidence.evidence!=='none')discounts++;}
   catch(e){errors++;console.error(c.id,'gravação:',e&&typeof e==='object'&&'message' in e?String(e.message).slice(0,200):'erro');}
  }
  if(store){const status=await db.from('source_status').upsert({store,status:accepted||olderPosts?'ok':'degraded',checked_at:new Date().toISOString(),products:accepted,message:accepted||olderPosts?(c.id.endsWith('-telegram')?c.name+': '+liveAnnounced+' preços anunciados pela loja nas últimas 6 h (página do produto não conferida)':c.name+': anúncios confirmados nas vitrines públicas'):'Nenhum anúncio aprovado nesta execução; ofertas anteriores vencem pelo TTL'});if(status.error)throw status.error;}
 }catch(e){failedConnectors++;errors++;console.error(c.id,e&&typeof e==='object'&&'message' in e?String(e.message).slice(0,200):'erro');}
 finally{if(runId)await db.from('collection_runs').update({finished_at:new Date().toISOString(),verified:accepted,failed:errors,discovered:0,message:rejected?('Rejeitados pela política: '+JSON.stringify(reasons)).slice(0,300):null}).eq('id',runId);await db.rpc('release_collector_lease',{lease_name:lease});}
 console.log(JSON.stringify({connector:c.id,store,accepted,live_announced:liveAnnounced,older_posts_history:olderPosts,announced_or_proven_discounts:discounts,rejected,reasons,errors}));
 if(!accepted&&!olderPosts&&!store)failedConnectors++;
}
if(failedConnectors)process.exitCode=1;
