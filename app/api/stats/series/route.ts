import {NextResponse} from 'next/server';
import {publicDb} from '@/lib/supabase';
import {cashComparable,consistentSeries,gpuGroup,isLive,ramGroup,typicalChange,type GroupDay,type StatOffer} from '@/lib/stats';
import {independentSeller} from '@/lib/search';
import {describeTrend,median,spDay} from '@/lib/history';
import {storeNames} from '@/lib/stores';
// Evolução diária de até 6 grupos equivalentes (mesmas regras de agrupamento do retrato atual).
// Usa todos os anúncios do grupo com preço à vista/Pix comparável, inclusive os hoje indisponíveis (foram observados).
export const dynamic='force-dynamic';
const FIELDS='id,store,title,category,brand,specs,variant,price,url,seller,seller_key,payment_basis,available,expires_at,image';
export async function GET(req:Request){
 const q=new URL(req.url).searchParams,c=q.get('c');if(c!=='ram'&&c!=='gpu')return NextResponse.json({error:'invalid_category'},{status:400});
 const keys=[...new Set((q.get('keys')??'').split(',').map(s=>s.trim()).filter(Boolean))].slice(0,6),days=Math.min(400,Math.max(1,Number(q.get('days'))||30));
 if(!keys.length||keys.some(k=>k.length>80))return NextResponse.json({error:'invalid_keys'},{status:400});
 const db=publicDb();if(!db)return NextResponse.json({error:'unconfigured'},{status:503});
 try{
  const offers:StatOffer[]=[];
  for(let from=0;from<3000;from+=1000){const r=await db.from('catalog_offers').select(FIELDS).eq('category',c).order('id').range(from,from+999);if(r.error)throw r.error;offers.push(...(r.data as StatOffer[]));if(r.data.length<1000)break;}
  const group=c==='ram'?ramGroup:gpuGroup,members=new Map<string,{label:string;gb?:number;list:StatOffer[]}>();
  for(const o of offers){if(!cashComparable(o))continue;const g=group(o);if(!g||!keys.includes(g.key))continue;const e=members.get(g.key)??{label:g.label,gb:g.gb,list:[]};e.list.push(o);members.set(g.key,e);}
  const now=Date.now(),today=spDay(now),byId=new Map(offers.map(o=>[o.id,o]));
  const series=await Promise.all(keys.filter(k=>members.has(k)).map(async key=>{const m=members.get(key)!;
   const r=await db.rpc('group_daily',{p_ids:m.list.map(o=>o.id).slice(0,600),p_days:days});if(r.error)throw r.error;
   const points=consistentSeries(r.data as GroupDay[]);
   const label=(id:string)=>{const o=byId.get(id);return o?(o.store==='mercadolivre'?o.seller:storeNames[o.store]??o.store):'';};
   const lows=points.map(p=>p.lowest),periodLow=points.length?points.reduce((a,b)=>b.lowest<a.lowest?b:a):null,todayPoint=points.find(p=>p.day===today)??null;
   const trend=describeTrend(points.map(p=>({day:p.day,min:p.lowest,max:p.lowest,close:p.lowest,samples:p.offers})),todayPoint?todayPoint.lowest:null,now);
   const live=m.list.filter(o=>isLive(o,now));
   return {key,label:m.label,gb:m.gb??null,members:m.list.length,live:live.length,sellers:new Set(live.map(independentSeller)).size,
    points:points.map(p=>({day:p.day,offers:p.offers,lowest:p.lowest,store:label(p.lowest_offer),offer:p.lowest_offer,median:p.median_low,typical:p.typical,segment:p.segment,pairs:p.pairs,partial:p.day===today})),
    summary:{days:points.length,today:todayPoint?.lowest??null,periodLow:periodLow?{price:periodLow.lowest,day:periodLow.day,store:label(periodLow.lowest_offer),offer:periodLow.lowest_offer}:null,medianLow:median(lows),typical:typicalChange(points),trend}};}));
  return NextResponse.json({category:c,days,today,series},{headers:{'Cache-Control':'public, s-maxage=900, stale-while-revalidate=1800'}});
 }catch(e){console.error('stats/series',e&&typeof e==='object'&&'message' in e?String(e.message).slice(0,200):'erro');return NextResponse.json({error:'unavailable'},{status:503});}
}
