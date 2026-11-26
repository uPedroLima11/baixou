// Busca pública por código forte. Só descobre candidatos: preço/estoque/vendedor/identidade são conferidos depois.
// Rodar DEPOIS das rechecagens. Lease compartilhado, 1,5 s/domínio, 8 MB, timeout 8 s, teto 2.000 candidatos.
import robotsParser from 'robots-parser';
import {adminDb} from '../lib/server';
import {candidateCategory} from '../lib/collection-policy';
import {sources} from './sources';
import {TARGETED_STORES,targetedSearchUrl,targetedProductLinks,replacementUrls} from './targeted-adapters';
const UA='BaixouBot/1.0 (+https://github.com/uPedroLima11/baixou)',PRIORITY=['ram','gpu','cpu','ssd'];
export const compact=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
export function searchableCode(mpn:string|null|undefined){const c=compact(mpn??'');return c.length>=6&&c.length<=30&&/[a-z]/.test(c)&&/\d/.test(c)?c:null;}
export function sameCodeUrl(url:string,code:string){try{
 const parts=new URL(url).pathname.split('/').filter(Boolean);if(parts.at(-1)==='p'||/^\d+$/.test(parts.at(-1)??''))parts.pop();
 const slug=decodeURIComponent(parts.at(-1)??'').toLowerCase(),c=searchableCode(code);if(!c)return false;
 return new RegExp('(?:^|[^a-z0-9])'+[...c].join('[-_/.]*')+'(?:$|[^a-z0-9])').test(slug);
 }catch{return false;}}
async function body(r:Response){let text='',size=0;const reader=r.body?.getReader(),d=new TextDecoder();if(!reader)throw Error('Resposta vazia');for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8000000){await reader.cancel();throw Error('Resposta maior que 8MB');}text+=d.decode(value,{stream:true});}return text+d.decode();}
async function main(){
 const stores=(process.env.TARGETED_STORES??process.env.COLLECT_STORES??'kabum').split(',').filter(s=>TARGETED_STORES.includes(s));if(!stores.length)return;
 const max=Math.min(15,Math.max(1,Number(process.env.TARGETED_MAX)||5)),budget=Math.min(60000,Math.max(10000,Number(process.env.TARGETED_DEADLINE_MS)||30000));
 const db=adminDb(),now=new Date().toISOString();
 const [live,wish,alerts]=await Promise.all([
  db.from('catalog_offers').select('id,store,mpn,product_id,category').eq('available',true).gt('expires_at',now).not('product_id','is',null).not('mpn','is',null).in('category',PRIORITY).limit(5000),
  db.from('wishlist').select('offers(product_id)').limit(2000),db.from('alerts').select('product_id').eq('enabled',true).not('product_id','is',null).limit(2000)]);
 for(const r of [live,wish,alerts])if(r.error)throw r.error;
 const watched=new Set<string>([...(wish.data??[]).map(w=>(w.offers as unknown as {product_id:string|null}|null)?.product_id).filter((x):x is string=>!!x),...(alerts.data??[]).map(a=>a.product_id as string)]);
 const products=new Map<string,{stores:Set<string>;codes:Set<string>;mpn:string;category:string}>();
 for(const o of live.data??[]){const code=searchableCode(o.mpn);if(!code)continue;const e=products.get(o.product_id!)??{stores:new Set<string>(),codes:new Set<string>(),mpn:o.mpn!,category:o.category};e.stores.add(o.store);e.codes.add(code);products.set(o.product_id!,e);}
 for(const store of stores){
  const source=sources.find(s=>s.id===store)!,lease='catalog:'+store,claim=await db.rpc('claim_collector_lease',{lease_name:lease,ttl_seconds:Math.ceil(budget/1000)+30});if(claim.error)throw claim.error;if(!claim.data){console.log(JSON.stringify({store,targeted:'lease ocupado'}));continue;}
  try{
   const until=Date.now()+budget,pool=await db.from('product_candidates').select('url',{count:'exact',head:true}).eq('store',store);if(pool.error)throw pool.error;let remaining=Math.max(0,2000-(pool.count??2000));
   const targets=[...products.entries()].filter(([,e])=>!e.stores.has(store)&&e.codes.size===1).map(([pid,e])=>({mpn:e.mpn,code:[...e.codes][0],category:e.category,watched:watched.has(pid),url:targetedSearchUrl(store,e.mpn)!})).sort((a,b)=>Number(b.watched)-Number(a.watched)||PRIORITY.indexOf(a.category)-PRIORITY.indexOf(b.category));
   const recent=await db.from('collection_pages').select('url').eq('store',store).gt('next_attempt_at',now).limit(5000);if(recent.error)throw recent.error;const skip=new Set((recent.data??[]).map(r=>r.url.replace(/#targeted$/,'')));
   let last=0;const get=async(url:string)=>{const wait=last+1500-Date.now();if(wait>0)await new Promise(r=>setTimeout(r,wait));if(Date.now()>=until)throw Error('Prazo da descoberta atingido');last=Date.now();return fetch(url,{headers:{'User-Agent':UA},redirect:'manual',signal:AbortSignal.timeout(Math.max(1,Math.min(8000,until-Date.now())))});};
   const rr=await get(source.origin+'/robots.txt');if(!rr.ok)throw Error('robots HTTP '+rr.status);const rules=robotsParser(source.origin+'/robots.txt',await body(rr));
   let searched=0,found=0,errors=0,added=0,replaced=0;
   for(const t of targets){if(searched>=max||Date.now()>=until-1000)break;if(skip.has(t.url)||rules.isAllowed(t.url,UA)!==true)continue;
    searched++;let status=0,links:string[]=[];
    try{const r=await get(t.url);status=r.status;if(r.ok)links=targetedProductLinks(store,await body(r));else{errors++;console.error(store,'busca HTTP',status);}}catch(e){errors++;console.error(store,'busca',e instanceof Error?e.message:'erro');}
    const exact=links.filter(u=>sameCodeUrl(u,t.code)&&rules.isAllowed(u,UA)===true);found+=exact.length;
    let newLinks=exact;
    if(exact.length&&!remaining){const present=await db.from('product_candidates').select('url').eq('store',store).in('url',exact);if(present.error)throw present.error;const known=new Set((present.data??[]).map(r=>r.url));newLinks=exact.filter(u=>!known.has(u));}
    if(newLinks.length&&!remaining&&replaced<3){
     // Só substituir candidatos antigos com falhas repetidas e SEM oferta. Histórico/favoritos/alertas
     // referenciam offers, nunca são removidos. Não liberar vagas sem resultado exato para ocupá-las.
     const cutoff=new Date(Date.now()-86400000).toISOString(),old=await db.from('product_candidates').select('url').eq('store',store).gte('failures',3).lt('last_attempt_at',cutoff).order('last_attempt_at').limit(30);if(old.error)throw old.error;
     if(old.data?.length){const urls=old.data.map(r=>r.url),protectedRows=await db.from('offers').select('url').eq('store',store).in('url',urls);if(protectedRows.error)throw protectedRows.error;
      const protectedUrls=new Set((protectedRows.data??[]).map(r=>r.url)),remove=replacementUrls(urls,protectedUrls,exact,Math.min(3-replaced,newLinks.length));
      if(remove.length){const del=await db.from('product_candidates').delete().eq('store',store).in('url',remove).gte('failures',3).lt('last_attempt_at',cutoff).select('url');if(del.error)throw del.error;const n=del.data?.length??0;remaining+=n;replaced+=n;}
     }
    }
    const hits=newLinks.slice(0,remaining);
    if(hits.length){const ins=await db.from('product_candidates').upsert(hits.map(url=>({store,url,category:candidateCategory(url)})),{onConflict:'store,url',ignoreDuplicates:true}).select('url');if(ins.error)throw ins.error;added+=ins.data?.length??0;remaining-=ins.data?.length??0;}
    const retry=status===200?7*86400000:86400000;
    // Fragmento só no registro de cooldown; nunca enviado à loja. Não vira página de categoria na coleta comum.
    const mark=await db.from('collection_pages').upsert({store,url:t.url+'#targeted',last_attempt_at:new Date().toISOString(),next_attempt_at:new Date(Date.now()+retry).toISOString()},{onConflict:'store,url'});if(mark.error)throw mark.error;
    if([301,302,303,307,308,401,403,429].includes(status))break;
   }
   console.log(JSON.stringify({store,targets:targets.length,watched:targets.filter(t=>t.watched).length,searched,found,newCandidates:added,replacedFailedCandidates:replaced,errors}));
   if(errors)process.exitCode=1;
  }finally{const r=await db.rpc('release_collector_lease',{lease_name:lease});if(r.error)throw r.error;}
 }
}
if(/scripts[/\\]targeted.ts$/.test(process.argv[1]??''))main().catch(e=>{console.error('Descoberta direcionada falhou:',e instanceof Error?e.message:'erro');process.exitCode=1;});
