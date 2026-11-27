import {NextResponse} from 'next/server';
import {publicDb} from '@/lib/supabase';
import {withRetry} from '@/lib/db-retry';
import {cashComparable,consistentSeries,gpuGroup,isLive,ramGroup,typicalChange,type GroupDay,type StatOffer} from '@/lib/stats';
import {independentSeller} from '@/lib/search';
import {describeTrend,median,spDay} from '@/lib/history';
import {storeNames} from '@/lib/stores';
import {statFacts,STATS_FILTERS,type StatsFilters} from '@/lib/stats-data';
// Evolução diária de até 6 grupos equivalentes (mesmas regras de agrupamento do retrato atual).
// Usa todos os anúncios do grupo com preço à vista/Pix comparável, inclusive os hoje indisponíveis (foram observados).
export const dynamic='force-dynamic';
const FIELDS='id,store,title,category,brand,specs,variant,price,card_price,url,seller,seller_key,payment_basis,available,expires_at,image,verification_status';
// Anúncios da categoria (inclusive indisponíveis): memória da instância por 5 min; o resumo diário só muda ao longo do
// dia e o ponto de hoje continua marcado como parcial. Falha nunca fica memorizada.
const offersMemo=new Map<string,{at:number;p:Promise<StatOffer[]>}>();
function categoryOffers(c:'ram'|'gpu'):Promise<StatOffer[]>{const hit=offersMemo.get(c);if(hit&&Date.now()-hit.at<300000)return hit.p;
 const p=(async()=>{const db=publicDb()!,out:StatOffer[]=[];
  for(let from=0;from<3000;from+=1000){const r=await withRetry(()=>db.from('catalog_offers').select(FIELDS).eq('category',c).order('id').range(from,from+999));if(r.error)throw r.error;out.push(...(r.data as StatOffer[]));if(r.data.length<1000)break;}
  return out;})();
 offersMemo.set(c,{at:Date.now(),p});p.catch(()=>offersMemo.delete(c));return p;}
export async function GET(req:Request){
 const q=new URL(req.url).searchParams,c=q.get('c');if(c!=='ram'&&c!=='gpu')return NextResponse.json({error:'invalid_category'},{status:400});
 const keys=[...new Set((q.get('keys')??'').split(',').map(s=>s.trim()).filter(Boolean))].slice(0,6),days=Math.min(400,Math.max(1,Number(q.get('days'))||30));
 if(!keys.length||keys.some(k=>k.length>80))return NextResponse.json({error:'invalid_keys'},{status:400});
 const card=q.get('pag')==='cartao';
 const db=publicDb();if(!db)return NextResponse.json({error:'unconfigured'},{status:503});
 try{
  // Cópia por requisição: o cartão substitui o preço do anúncio pelo total no cartão.
  const offers=(await categoryOffers(c)).map(o=>({...o}));
  // Mesmos filtros do painel (frequência, marca, fabricante etc.), aplicados também a anúncios hoje indisponíveis.
  const applied:StatsFilters={};for(const {key} of STATS_FILTERS[c]){const v=(q.get(key)??'').slice(0,40);if(v)applied[key]=v;}
  const members=new Map<string,{label:string;gb?:number;list:StatOffer[]}>();void ramGroup;void gpuGroup;
  // Cartão: só anúncios verificados com total no cartão informado; preço do anúncio = total no cartão.
  if(card)for(const o of offers as (StatOffer&{card_price?:number|null})[])if(Number(o.card_price)>0)(o as {price:number}).price=Number(o.card_price);
  for(const o of offers as (StatOffer&{card_price?:number|null})[]){if(card?(!(Number(o.card_price)>0)||o.verification_status==='announced'):!cashComparable(o))continue;const x=statFacts(o,c);if(!x||!Object.entries(applied).every(([k,v])=>x.values[k]===v))continue;const g=x.group;if(!keys.includes(g.key))continue;const e=members.get(g.key)??{label:g.label,gb:g.gb,list:[]};e.list.push(o);members.set(g.key,e);}
  const now=Date.now(),today=spDay(now),byId=new Map(offers.map(o=>[o.id,o]));
  const series=await Promise.all(keys.filter(k=>members.has(k)).map(async key=>{const m=members.get(key)!;
   const r=await withRetry(()=>db.rpc(card?'group_daily_card':'group_daily',{p_ids:m.list.map(o=>o.id).slice(0,600),p_days:days}));if(r.error)throw r.error;
   const points=consistentSeries(r.data as GroupDay[]);
   const label=(id:string)=>{const o=byId.get(id);return o?(o.store==='mercadolivre'?o.seller:storeNames[o.store]??o.store):'';};
   const lows=points.map(p=>p.lowest),periodLow=points.length?points.reduce((a,b)=>b.lowest<a.lowest?b:a):null,todayPoint=points.find(p=>p.day===today)??null;
   const trend=describeTrend(points.map(p=>({day:p.day,min:p.lowest,max:p.lowest,close:p.lowest,samples:p.offers})),todayPoint?todayPoint.lowest:null,now);
   const live=m.list.filter(o=>isLive(o,now));
   return {key,label:m.label,gb:m.gb??null,members:m.list.length,live:live.length,sellers:new Set(live.map(independentSeller)).size,
    points:points.map(p=>({day:p.day,offers:p.offers,lowest:p.lowest,store:label(p.lowest_offer),offer:p.lowest_offer,median:p.median_low,typical:p.typical,segment:p.segment,pairs:p.pairs,partial:p.day===today})),
    summary:{days:points.length,today:todayPoint?.lowest??null,periodLow:periodLow?{price:periodLow.lowest,day:periodLow.day,store:label(periodLow.lowest_offer),offer:periodLow.lowest_offer,title:byId.get(periodLow.lowest_offer)?.title??'',live:(()=>{const o=byId.get(periodLow.lowest_offer);return !!o&&isLive(o,now)&&Number(o.price)<=periodLow.lowest+0.005;})()}:null,medianLow:median(lows),typical:typicalChange(points),trend}};}));
  return NextResponse.json({payment:card?'card':'pix',category:c,days,today,series},{headers:{'Cache-Control':'public, s-maxage=600, stale-while-revalidate=1800'}});
 }catch(e){console.error('stats/series',e&&typeof e==='object'&&'message' in e?String(e.message).slice(0,200):'erro');return NextResponse.json({error:'unavailable'},{status:503});}
}
