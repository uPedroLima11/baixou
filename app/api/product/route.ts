import {NextResponse} from 'next/server';import {publicDb} from '@/lib/supabase';
export const dynamic='force-dynamic';
// Detalhe completo da oferta. Quando a própria loja traz poucas especificações e o MESMO produto canônico
// (identidade forte: marca + código do fabricante/GTIN + variantes) existe em outra loja com ficha técnica,
// devolve essa ficha separada, com a loja de origem. Avaliações nunca são transferidas entre lojas.
export async function GET(req:Request){
 const id=new URL(req.url).searchParams.get('id');if(!id||id.length>100)return NextResponse.json({offer:null},{status:400});
 const db=publicDb();if(!db)return NextResponse.json({offer:null},{status:503});
 const {data,error}=await db.from('offers').select('*').eq('id',id).maybeSingle();
 if(error||!data)return NextResponse.json({offer:data??null},{status:error?503:404});
 let related_specs:{store:string;offer_id:string;specs:Record<string,string>}|null=null;
 if(data.product_id&&Object.keys(data.specs??{}).length<3){
  const others=await db.from('offers').select('id,store,specs').eq('product_id',data.product_id).neq('store',data.store).limit(10);
  const best=(others.data??[]).map(o=>({o,n:Object.keys(o.specs??{}).length})).sort((a,b)=>b.n-a.n)[0];
  if(best&&best.n>=3)related_specs={store:best.o.store,offer_id:best.o.id,specs:best.o.specs};
 }
 return NextResponse.json({offer:data,related_specs});
}
