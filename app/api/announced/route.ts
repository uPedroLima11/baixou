import {NextResponse} from 'next/server';
import {publicDb} from '@/lib/supabase';
// "Ofertas divulgadas recentemente": anúncios publicados pelas próprias lojas (canais no Telegram) nas últimas 48 h,
// inclusive os que já saíram do catálogo (validade de 6 h). Disponibilidade NÃO confirmada; preço é o anunciado.
export const dynamic='force-dynamic';
const FIELDS='id,store,url,title,category,brand,mpn,image,price,seller,checked_at,expires_at,payment_note,product_id,specs';
export async function GET(req:Request){
 const hours=Math.min(48,Math.max(1,Number(new URL(req.url).searchParams.get('hours'))||48));
 const db=publicDb();if(!db)return NextResponse.json({offers:[]});
 const since=new Date(Date.now()-hours*3600000).toISOString();
 const r=await db.from('catalog_offers').select(FIELDS).eq('verification_status','announced').gte('checked_at',since).order('checked_at',{ascending:false}).limit(600);
 if(r.error)return NextResponse.json({offers:[],error:'unavailable'},{status:503});
 const offers=(r.data??[]).map(o=>{const specs=(o.specs??{}) as Record<string,string>;return {id:o.id,store:o.store,url:o.url,title:o.title,category:o.category,brand:o.brand,mpn:o.mpn,image:o.image,price:Number(o.price),posted_at:o.checked_at,in_catalog:Date.parse(o.expires_at)>Date.now(),source:specs['Fonte do preço']??null,image_source:specs['Fonte da imagem']??null,product_id:o.product_id,note:o.payment_note};});
 return NextResponse.json({hours,generated_at:new Date().toISOString(),offers},{headers:{'Cache-Control':'public, s-maxage=120, stale-while-revalidate=600'}});
}
