import {NextResponse} from 'next/server';
import {publicDb} from '@/lib/supabase';
export const dynamic='force-dynamic';
export async function GET(){const db=publicDb();if(!db)return NextResponse.json({offers:[],sources:[],configured:false});
 const [offers,sources,stores,coverage]=await Promise.all([db.from('offers').select('*').eq('available',true).gt('expires_at',new Date().toISOString()).order('discount',{ascending:false}).limit(500),db.from('source_status').select('*'),db.from('store_registry').select('id,name,homepage,status,marketplace,test_product_url,verified_at').order('name'),db.rpc('catalog_coverage')]);
 if(offers.error||sources.error)return NextResponse.json({offers:[],sources:[],configured:true,error:'Não foi possível atualizar o catálogo.'},{status:503});
 return NextResponse.json({offers:offers.data,sources:sources.data,stores:stores.data??[],coverage:coverage.data??null,truncated:(coverage.data?.stores??[]).reduce((n:number,s:{available:number})=>n+Number(s.available),0)>(offers.data?.length??0),configured:true},{headers:{'Cache-Control':'public, s-maxage=20, stale-while-revalidate=10'}});
}
