import {NextResponse} from 'next/server';
import {publicDb} from '@/lib/supabase';
export const dynamic='force-dynamic';
// Catálogo paginado: page=0 traz também fontes/lojas/cobertura; páginas seguintes só anúncios.
// Ordem estável (desconto, id) para páginas consistentes. Listagem vem da view catalog_offers (sem descrição longa).
const CATALOG_PAGE_SIZE=400;
const MAX_PAGES=50;
// Campos da listagem: sem a galeria completa (o detalhe busca /api/product) nem market_checked_at (não usado no cliente).
// Medição 24/11: images = 23% do JSON da listagem.
const LIST_FIELDS='id,store,url,title,category,brand,mpn,image,price,original_price,available,seller,sold,rating,review_count,specs,checked_at,expires_at,historical_median,historical_samples,historical_days,discount,evidence,discoveries,coupon_hint,coupon_validated,payment_note,product_id,gtin,variant,last_attempt_at,verification_status,market_median,market_lowest,market_stores,market_highest,market_expires_at,seller_key,payment_basis,historical_max,reference_median,reference_samples,reference_days,reference_min,reference_max';
export async function GET(req:Request){const db=publicDb();if(!db)return NextResponse.json({offers:[],sources:[],configured:false});
 const raw=Number(new URL(req.url).searchParams.get('page')??0),page=Number.isInteger(raw)&&raw>=0&&raw<MAX_PAGES?raw:-1;
 if(page<0)return NextResponse.json({error:'invalid_page'},{status:400});
 const from=page*CATALOG_PAGE_SIZE,now=new Date().toISOString();
 const offersQuery=db.from('catalog_offers').select(LIST_FIELDS,{count:page===0?'exact':undefined}).eq('available',true).gt('expires_at',now).order('discount',{ascending:false}).order('id').range(from,from+CATALOG_PAGE_SIZE-1);
 const headers={'Cache-Control':'public, s-maxage=300, stale-while-revalidate=900'};
 if(page>0){const offers=await offersQuery;if(offers.error)return NextResponse.json({offers:[],error:'Não foi possível atualizar o catálogo.'},{status:503});
  return NextResponse.json({offers:offers.data,page,next:offers.data.length===CATALOG_PAGE_SIZE?page+1:null},{headers});}
 const [offers,sources,stores,coverage]=await Promise.all([offersQuery,db.from('source_status').select('*'),db.from('store_registry').select('id,name,homepage,status,marketplace,test_product_url,verified_at').order('name'),db.rpc('catalog_coverage')]);
 if(offers.error||sources.error)return NextResponse.json({offers:[],sources:[],configured:true,error:'Não foi possível atualizar o catálogo.'},{status:503});
 const total=offers.count??offers.data.length;
 return NextResponse.json({offers:offers.data,sources:sources.data,stores:stores.data??[],coverage:coverage.data??null,total,page:0,next:offers.data.length===CATALOG_PAGE_SIZE&&total>CATALOG_PAGE_SIZE?1:null,truncated:false,configured:true},{headers});
}
