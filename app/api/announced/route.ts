import {NextResponse} from 'next/server';
import {announcedOffers} from '@/lib/announced';
// Ver lib/announced.ts. Cache de borda curto; a página /divulgadas já vem com a lista no HTML.
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const hours=Math.min(48,Math.max(1,Number(new URL(req.url).searchParams.get('hours'))||48));
 try{return NextResponse.json(await announcedOffers(hours),{headers:{'Cache-Control':'public, s-maxage=120, stale-while-revalidate=600'}});}
 catch(e){console.error('announced',e instanceof Error?e.message.slice(0,200):'erro');return NextResponse.json({offers:[],error:'unavailable'},{status:503});}
}
