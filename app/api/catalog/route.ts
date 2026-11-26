import {NextResponse} from 'next/server';
import {publicDb} from '@/lib/supabase';
import {catalogIndex,catalogMeta,catalogStats,LIST_FIELDS} from '@/lib/catalog-server';
import {queryCatalog,currentForSaved} from '@/lib/catalog-query';
import {parseCatalogParams} from '@/lib/catalog-params';
import type {Offer} from '@/lib/types';
export const dynamic='force-dynamic';
// Consulta paginada no servidor (padrão): só a página pedida + contagens/filtros. Cache de borda curto (60 s) e
// stale-while-revalidate: a CDN responde na hora e atualiza em segundo plano; a validade é conferida no servidor.
// `?page=N` mantém o formato antigo (lista bruta em páginas de 400) para abas abertas antes do deploy.
const CACHE={'Cache-Control':'public, s-maxage=60, stale-while-revalidate=240'};
export async function GET(req:Request){
 const url=new URL(req.url),sp=url.searchParams;
 if(sp.has('page'))return legacy(sp);
 const t=performance.now();
 try{
  // Favoritos usam o índice Pix (o card mostra também o cartão); a lista usa o índice da modalidade escolhida.
  const params=parseCatalogParams(sp),index=await catalogIndex(sp.has('saved')?'pix':params.payment),loadMs=Math.round(performance.now()-t);
  if(sp.has('saved')){const ids=(sp.get('saved')??'').split(',').filter(Boolean).slice(0,100);
   const db=publicDb();const {data}=ids.length&&db?await db.from('catalog_offers').select(LIST_FIELDS).in('id',ids):{data:[]};
   return NextResponse.json({items:currentForSaved(index,(data??[]) as unknown as Offer[]).filter(Boolean)},{headers:{'Cache-Control':'private, no-store'}});}
  const q=performance.now(),result={...queryCatalog(index,params),payment:params.payment??'pix',withoutCard:index.withoutCard??0},queryMs=Math.round(performance.now()-q);
  const meta=sp.get('meta')==='1'?{...(await catalogMeta()),departments:index.departments}:undefined;
  return NextResponse.json({...result,meta,configured:true,timing:{loadMs,queryMs,buildMs:index.buildMs,cache:catalogStats()}},{headers:{...CACHE,'Server-Timing':`load;dur=${loadMs}, query;dur=${queryMs}`}});
 }catch(e){console.error('catalog',e instanceof Error?e.message:e);return NextResponse.json({items:[],total:0,error:'Não foi possível atualizar o catálogo.',configured:!!publicDb()},{status:503});}
}
const LEGACY_PAGE=400;
async function legacy(sp:URLSearchParams){
 const db=publicDb();if(!db)return NextResponse.json({offers:[],sources:[],configured:false});
 const raw=Number(sp.get('page')??0),page=Number.isInteger(raw)&&raw>=0&&raw<50?raw:-1;if(page<0)return NextResponse.json({error:'invalid_page'},{status:400});
 const now=new Date().toISOString(),from=page*LEGACY_PAGE;
 const r=await db.from('catalog_offers').select(LIST_FIELDS,{count:page===0?'exact':undefined}).eq('available',true).gt('expires_at',now).order('discount',{ascending:false}).order('id').range(from,from+LEGACY_PAGE-1);
 if(r.error)return NextResponse.json({offers:[],error:'Não foi possível atualizar o catálogo.'},{status:503});
 const meta=page===0?await catalogMeta():null,total=r.count??r.data.length;
 return NextResponse.json({offers:r.data,...(meta??{sources:[]}),total,page,next:r.data.length===LEGACY_PAGE?page+1:null,configured:true},{headers:{'Cache-Control':'public, s-maxage=300, stale-while-revalidate=900'}});
}
