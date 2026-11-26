import {NextResponse} from 'next/server';import {sameProduct} from '@/lib/search';import type {Offer} from '@/lib/types';import {publicDb} from '@/lib/supabase';
import {catalogIndex} from '@/lib/catalog-server';import {baixouScore} from '@/lib/score';
export const dynamic='force-dynamic';
// Detalhe completo da oferta. Quando a própria loja traz poucas especificações e o MESMO produto canônico
// (identidade forte: marca + código do fabricante/GTIN + variantes) existe em outra loja com ficha técnica,
// devolve essa ficha separada, com a loja de origem. Avaliações nunca são transferidas entre lojas.
// Também devolve, do índice do catálogo (somente ofertas válidas agora): comparação do mesmo modelo entre vendedores,
// outras ofertas do mesmo modelo, a referência de alternativas equivalentes e o Baixou Score calculado com ela.
export async function GET(req:Request){
 const id=new URL(req.url).searchParams.get('id');if(!id||id.length>100)return NextResponse.json({offer:null},{status:400});
 const db=publicDb();if(!db)return NextResponse.json({offer:null},{status:503});
 const [{data,error},index]=await Promise.all([db.from('offers').select('*').eq('id',id).maybeSingle(),catalogIndex().catch(()=>null)]);
 if(error||!data)return NextResponse.json({offer:data??null},{status:error?503:404});
 let related_specs:{store:string;offer_id:string;specs:Record<string,string>}|null=null;
 if(data.product_id&&Object.keys(data.specs??{}).length<3){
  const others=await db.from('offers').select('*').eq('product_id',data.product_id).neq('store',data.store).limit(10);
  const best=(others.data??[]).filter(o=>sameProduct(o as Offer,data as Offer)).map(o=>({o,n:Object.keys(o.specs??{}).length})).sort((a,b)=>b.n-a.n)[0];
  if(best&&best.n>=3)related_specs={store:best.o.store,offer_id:best.o.id,specs:best.o.specs};
 }
 const now=Date.now(),entry=index?.byId.get(id),live=(o:Offer)=>o.available&&Date.parse(o.expires_at)>now;
 const comparison=entry?.compare?.filter(live)??null;
 const alternatives=index?index.entries.filter(e=>e.o.id!==id&&live(e.o)&&sameProduct(e.o,data as Offer)).map(e=>e.o).slice(0,12):[];
 const group=entry?.group??null,score=baixouScore({...(data as Offer),group},now);
 return NextResponse.json({offer:data,related_specs,comparison,alternatives,group,score},{headers:{'Cache-Control':'public, s-maxage=30, stale-while-revalidate=120'}});
}
