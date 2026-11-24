import {NextResponse} from 'next/server';
import {publicDb} from '@/lib/supabase';
// Histórico de preços de até 8 anúncios (o produto e os mesmos modelos em outras lojas).
// raw: observações reais (até 1 por hora, retenção 35 dias) quando days<=31; daily: resumo diário (até 400 dias).
export const dynamic='force-dynamic';
type Row=Record<string,unknown>;
async function all(query:(from:number,to:number)=>PromiseLike<{data:Row[]|null;error:unknown}>,cap:number){const out:Row[]=[];for(let from=0;from<cap;from+=1000){const r=await query(from,Math.min(cap,from+1000)-1);if(r.error)throw r.error;out.push(...(r.data??[]));if((r.data?.length??0)<1000)break;}return out;}
export async function GET(req:Request){
 const params=new URL(req.url).searchParams;
 const ids=[...new Set((params.get('ids')??params.get('id')??'').split(',').map(s=>s.trim()).filter(Boolean))].slice(0,8);
 const days=Math.min(365,Math.max(1,Number(params.get('days'))||30));
 if(!ids.length||ids.some(id=>id.length>100))return NextResponse.json({error:'invalid_ids'},{status:400});
 const db=publicDb();if(!db)return NextResponse.json({series:[]});
 try{
  const since=new Date(Date.now()-days*86400000).toISOString();
  const [raw,daily]=await Promise.all([
   days<=31?all((a,b)=>db.from('price_history').select('offer_id,price,observed_at').in('offer_id',ids).gte('observed_at',since).order('observed_at').range(a,b),8000):Promise.resolve([] as Row[]),
   all((a,b)=>db.from('price_daily').select('offer_id,day,min_cents,max_cents,close_cents,samples').in('offer_id',ids).gte('day',new Date(Date.now()-400*86400000).toISOString().slice(0,10)).order('day').range(a,b),4000)]);
  const series=ids.map(id=>({id,
   raw:raw.filter(r=>r.offer_id===id).map(r=>[Date.parse(String(r.observed_at)),Number(r.price)]),
   daily:daily.filter(r=>r.offer_id===id).map(r=>[String(r.day),Number(r.min_cents)/100,Number(r.max_cents)/100,Number(r.close_cents)/100,Number(r.samples)])}));
  // Compatibilidade com o formato antigo (?id=): lista simples dos últimos 30 dias.
  if(params.get('id')&&!params.get('ids'))return NextResponse.json(series[0].raw.map(([t,p])=>({price:p,observed_at:new Date(Number(t)).toISOString()})),{headers:{'Cache-Control':'public, s-maxage=120'}});
  return NextResponse.json({series,days},{headers:{'Cache-Control':'public, s-maxage=120, stale-while-revalidate=600'}});
 }catch{return NextResponse.json({error:'unavailable'},{status:503});}
}
