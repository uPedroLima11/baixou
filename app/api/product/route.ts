import {NextResponse} from 'next/server';
import {productData} from '@/lib/product-data';
export const dynamic='force-dynamic';
// Detalhe completo da oferta (ver lib/product-data.ts).
export async function GET(req:Request){
 const id=new URL(req.url).searchParams.get('id');if(!id||id.length>100)return NextResponse.json({offer:null},{status:400});
 const d=await productData(id);
 if(d==='error')return NextResponse.json({offer:null},{status:503});
 if(!d)return NextResponse.json({offer:null},{status:404});
 return NextResponse.json(d,{headers:{'Cache-Control':'public, s-maxage=30, stale-while-revalidate=120'}});
}
