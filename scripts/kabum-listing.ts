// KaBuM: varredura das LISTAGENS (100 produtos por página) — renova preço/cartão/estoque de produtos já conhecidos e
// descobre produtos novos de venda própria (detalhe confirma identidade depois). Ver lib/kabum-listing.ts.
// Mesmo lease da loja (nunca em paralelo com o coletor), robots, 1,5 s entre requisições, timeout 8 s, 8 MB por resposta.
// Rodízio: páginas com a tentativa mais antiga primeiro (collection_pages, fragmento #listing nunca enviado à loja).
import robotsParser from 'robots-parser';
import {adminDb} from '../lib/server';
import {applyKabumListing,parseKabumListing} from '../lib/kabum-listing';
const UA='BaixouBot/1.0 (+https://github.com/uPedroLima11/baixou)',ORIGIN='https://www.kabum.com.br';
// Prioridade: hardware monitorado nas estatísticas/alertas primeiro. Periféricos/notebooks (>10 mil itens) por último.
export const LISTING_CATEGORIES=['/hardware/memoria-ram','/hardware/placa-de-video-vga','/hardware/processadores','/hardware/ssd-2-5','/hardware/placas-mae','/hardware/fontes','/hardware/kit-hardware/kit-upgrade','/hardware/coolers','/hardware/disco-rigido-hd','/espaco-gamer/cadeiras-gamer','/perifericos','/computadores/notebooks'];
const MAX_PAGES:Record<string,number>={'/perifericos':30,'/computadores/notebooks':10};
export const listingUrl=(path:string,page:number)=>ORIGIN+path+'?page_number='+page+'&page_size=100';
async function body(r:Response){let text='',size=0;const reader=r.body?.getReader(),d=new TextDecoder();if(!reader)throw Error('Resposta vazia');for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8000000){await reader.cancel();throw Error('Resposta maior que 8MB');}text+=d.decode(value,{stream:true});}return text+d.decode();}
async function main(){
 const db=adminDb(),deadline=Date.now()+Math.min(420000,Math.max(30000,Number(process.env.LISTING_DEADLINE_MS)||240000)),cap=Math.min(12000,Math.max(2000,Number(process.env.KABUM_CANDIDATE_CAP)||8000));
 const lease=await db.rpc('claim_collector_lease',{lease_name:'catalog:kabum',ttl_seconds:Math.ceil((deadline-Date.now())/1000)+60});if(lease.error)throw lease.error;
 if(!lease.data){console.log(JSON.stringify({listing:'lease ocupado'}));return;}
 const totals={pages:0,items:0,renewed:0,changed:0,unavailable:0,queued:0,known:0,errors:0};
 try{
  let last=0;const get=async(url:string)=>{const wait=last+1500-Date.now();if(wait>0)await new Promise(r=>setTimeout(r,wait));last=Date.now();return fetch(url,{headers:{'User-Agent':UA},redirect:'manual',signal:AbortSignal.timeout(8000)});};
  const rr=await get(ORIGIN+'/robots.txt');if(!rr.ok)throw Error('robots HTTP '+rr.status);const rules=robotsParser(ORIGIN+'/robots.txt',await body(rr));
  const pool=await db.from('product_candidates').select('url',{count:'exact',head:true}).eq('store','kabum');if(pool.error)throw pool.error;let room=Math.max(0,cap-(pool.count??cap));
  // Páginas conhecidas (com última tentativa) + página 1 de cada categoria; ordem = tentativa mais antiga, prioridade da categoria.
  const seen=await db.from('collection_pages').select('url,last_attempt_at').eq('store','kabum').like('url','%#listing').limit(2000);if(seen.error)throw seen.error;
  const lastAt=new Map((seen.data??[]).map(r=>[r.url.replace(/#listing$/,''),Date.parse(r.last_attempt_at??'')||0]));
  const queue:string[]=[];for(const c of LISTING_CATEGORIES)queue.push(listingUrl(c,1));for(const u of lastAt.keys())if(!queue.includes(u))queue.push(u);
  const rank=(u:string)=>LISTING_CATEGORIES.findIndex(c=>u.startsWith(ORIGIN+c+'?'));
  queue.sort((a,b)=>(lastAt.get(a)??0)-(lastAt.get(b)??0)||rank(a)-rank(b));
  const done=new Set<string>();
  while(queue.length&&Date.now()<deadline-15000){
   const url=queue.shift()!;if(done.has(url))continue;done.add(url);if(rules.isAllowed(url,UA)!==true)continue;
   let status=0;try{const r=await get(url);status=r.status;if(r.status!==200){totals.errors++;console.error('listagem HTTP',r.status);if([403,429].includes(r.status))break;continue;}
    const l=parseKabumListing(await body(r));totals.pages++;totals.items+=l.items.length;
    const res=await applyKabumListing(db,l.items,room);room-=res.queued;for(const k of ['renewed','changed','unavailable','queued','known'] as const)totals[k]+=res[k];
    // Próximas páginas da mesma categoria entram na fila (até o teto da categoria).
    const path=new URL(url).pathname,page=Number(new URL(url).searchParams.get('page_number'))||1,max=Math.min(l.totalPages,MAX_PAGES[path]??40);
    if(page<max){const nextUrl=listingUrl(path,page+1);if(!done.has(nextUrl)&&!queue.includes(nextUrl))queue.splice(Math.min(queue.length,3),0,nextUrl);}
   }catch(e){totals.errors++;console.error('listagem',e instanceof Error?e.message.slice(0,200):String((e as {message?:unknown})?.message??'erro').slice(0,200));}
   const m=await db.from('collection_pages').upsert({store:'kabum',url:url+'#listing',last_attempt_at:new Date().toISOString(),next_attempt_at:new Date(Date.now()+(status===200?10:60)*60000).toISOString()},{onConflict:'store,url'});if(m.error)throw m.error;
  }
  console.log(JSON.stringify({listing:'kabum',...totals,candidateRoomLeft:room}));
  if(totals.errors&&!totals.pages)process.exitCode=1;
 }finally{const r=await db.rpc('release_collector_lease',{lease_name:'catalog:kabum'});if(r.error)throw r.error;}
}
if(/scripts[/\\]kabum-listing.ts$/.test(process.argv[1]??''))main().catch(e=>{console.error('Listagem KaBuM falhou:',e instanceof Error?e.message:String((e as {message?:unknown})?.message??'erro').slice(0,300));process.exitCode=1;});
