import {NextResponse} from 'next/server';
import {buildStats,parseStatsQuery} from '@/lib/stats-data';
// Painel de estatísticas (lib/stats-data.ts): calculado sobre o índice do catálogo já em memória no servidor e o
// resumo diário (price_changes). Cache de borda 10 min por combinação de filtros.
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const {c,applied,days}=parseStatsQuery(new URL(req.url).searchParams);
 try{return NextResponse.json(await buildStats(c,applied,days),{headers:{'Cache-Control':'public, s-maxage=600, stale-while-revalidate=1800'}});}
 catch(e){console.error('stats',e instanceof Error?e.message.slice(0,200):'erro');return NextResponse.json({error:'unavailable'},{status:503});}
}
