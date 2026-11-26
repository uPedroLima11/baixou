// Descoberta direcionada entre lojas (26/11/2026): procura na KaBuM os MESMOS modelos (código do fabricante) que hoje
// só existem em outra loja monitorada, para formar comparações reais de mercado. Prioridade: produtos acompanhados
// (alerta de produto/favorito), depois RAM, GPU, CPU e SSD.
// Regras: busca permitida pelo robots (/busca/<termo>, sem query string), ritmo de 1,5 s, teto por rodada; só entra
// como candidato o resultado cujo endereço contém o MESMO código do fabricante (comparação exata de código, nunca
// semelhança de título). O candidato passa depois pela verificação completa do coletor (identidade, vendedor, Pix).
// Cada código buscado fica registrado em collection_pages (próxima busca em 7 dias) para não repetir.
import robotsParser from 'robots-parser';
import {adminDb} from '../lib/server';
import {kabumDiscovery} from './parser';
import {candidateCategory} from '../lib/collection-policy';
const UA='BaixouBot/1.0 (+https://github.com/uPedroLima11/baixou)',ORIGIN='https://www.kabum.com.br';
const MAX=Number(process.env.TARGETED_MAX)||15,PRIORITY=['ram','gpu','cpu','ssd'];
export const compact=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
// Código buscável: ≥6 caracteres alfanuméricos, com letra e dígito (evita termos genéricos).
export function searchableCode(mpn:string|null|undefined){const c=compact(mpn??'');return c.length>=6&&c.length<=30&&/[a-z]/.test(c)&&/\d/.test(c)?c:null;}
// Resultado só vale se o slug do produto contiver o código inteiro.
export function sameCodeUrl(url:string,code:string){try{return compact(new URL(url).pathname.split('/').pop()??'').includes(code);}catch{return false;}}
async function main(){
 if(!(process.env.COLLECT_STORES??'kabum').split(',').includes('kabum')){console.log('Descoberta direcionada: só KaBuM nesta etapa.');return;}
 const db=adminDb(),now=new Date().toISOString();
 const live=await db.from('catalog_offers').select('id,store,mpn,product_id,category').eq('available',true).gt('expires_at',now).not('product_id','is',null).not('mpn','is',null).in('category',PRIORITY).limit(5000);if(live.error)throw live.error;
 const byProduct=new Map<string,{stores:Set<string>;mpn:string;category:string;ids:string[]}>();
 for(const o of live.data){const e=byProduct.get(o.product_id!)??{stores:new Set<string>(),mpn:o.mpn!,category:o.category,ids:[] as string[]};e.stores.add(o.store);e.ids.push(o.id);byProduct.set(o.product_id!,e);}
 const [wish,alerts]=await Promise.all([db.from('wishlist').select('offers(product_id)').limit(2000),db.from('alerts').select('product_id').eq('enabled',true).not('product_id','is',null).limit(2000)]);
 const watched=new Set<string>([...(wish.data??[]).map(w=>(w.offers as unknown as {product_id:string|null}|null)?.product_id).filter((x):x is string=>!!x),...(alerts.data??[]).map(a=>a.product_id as string)]);
 const targets=[...byProduct.entries()].filter(([,e])=>!e.stores.has('kabum')&&searchableCode(e.mpn)).map(([pid,e])=>({pid,code:searchableCode(e.mpn)!,category:e.category,watched:watched.has(pid)}))
  .sort((a,b)=>Number(b.watched)-Number(a.watched)||PRIORITY.indexOf(a.category)-PRIORITY.indexOf(b.category));
 const pages=targets.map(t=>ORIGIN+'/busca/'+t.code);
 const recent:{data:{url:string}[]|null;error:unknown}=pages.length?await db.from('collection_pages').select('url').eq('store','kabum').in('url',pages.slice(0,1000)).gt('next_attempt_at',now):{data:[],error:null};if(recent.error)throw recent.error;
 const skip=new Set((recent.data??[]).map(r=>r.url));
 const rules=robotsParser(ORIGIN+'/robots.txt',await (await fetch(ORIGIN+'/robots.txt',{headers:{'User-Agent':UA},signal:AbortSignal.timeout(8000)})).text());
 let searched=0,found=0,last=0;const added:string[]=[];
 for(const t of targets){if(searched>=MAX)break;const url=ORIGIN+'/busca/'+t.code;if(skip.has(url)||rules.isAllowed(url,UA)!==true)continue;
  const wait=1500-(Date.now()-last);if(wait>0)await new Promise(r=>setTimeout(r,wait));last=Date.now();searched++;
  let links:string[]=[];try{const r=await fetch(url,{headers:{'User-Agent':UA},signal:AbortSignal.timeout(8000)});if(r.ok)links=kabumDiscovery(await r.text());}catch(e){console.error('busca',t.code,e instanceof Error?e.message:'erro');}
  const hits=links.filter(u=>sameCodeUrl(u,t.code)&&rules.isAllowed(u,UA)===true);found+=hits.length;
  if(hits.length){const ins=await db.from('product_candidates').upsert(hits.map(u=>({store:'kabum',url:u,category:candidateCategory(u)})),{onConflict:'store,url',ignoreDuplicates:true}).select('url');if(ins.error)throw ins.error;added.push(...(ins.data??[]).map(r=>r.url));}
  const mark=await db.from('collection_pages').upsert({store:'kabum',url,last_attempt_at:new Date().toISOString(),next_attempt_at:new Date(Date.now()+7*86400000).toISOString()},{onConflict:'store,url'});if(mark.error)throw mark.error;
 }
 console.log(JSON.stringify({targets:targets.length,watched:targets.filter(t=>t.watched).length,searched,found,newCandidates:added.length,sample:added.slice(0,5)}));
}
if(/scripts[/]targeted.ts$/.test(process.argv[1]??''))main().catch(e=>{console.error('Descoberta direcionada falhou:',e instanceof Error?e.message:'erro');process.exitCode=1;});
