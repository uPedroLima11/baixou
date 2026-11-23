import {NextResponse} from 'next/server';
import {publicDb} from '@/lib/supabase';
export const dynamic='force-dynamic';
export async function GET(){const db=publicDb();if(!db)return NextResponse.json({offers:[],sources:[],configured:false});
 const [offers,sources]=await Promise.all([db.from('offers').select('*').eq('available',true).gt('expires_at',new Date().toISOString()).order('discount',{ascending:false}).limit(500),db.from('source_status').select('*')]);
 if(offers.error||sources.error)return NextResponse.json({offers:[],sources:[],configured:true,error:'Não foi possível atualizar o catálogo.'},{status:503});
 return NextResponse.json({offers:offers.data,sources:sources.data,configured:true},{headers:{'Cache-Control':'public, s-maxage=20, stale-while-revalidate=10'}});
}
