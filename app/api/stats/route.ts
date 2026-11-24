import {NextResponse} from 'next/server';
import {publicDb} from '@/lib/supabase';
import {chainIndex,gpuGroup,groupPanel,panel,ramGroup,snapshot,type ChangeRow,type StatOffer} from '@/lib/stats';
import {spDay,DAY} from '@/lib/history';
// Estatísticas de RAM/GPU. Calculadas no servidor a partir da view do catálogo e do resumo diário (price_daily),
// com cache de 15 minutos na borda para não pesar no plano gratuito.
export const dynamic='force-dynamic';
const FIELDS='id,store,title,category,brand,specs,variant,price,url,seller,seller_key,payment_basis,available,expires_at,image,evidence,historical_median,discount';
export async function GET(req:Request){
 const c=new URL(req.url).searchParams.get('c');if(c!=='ram'&&c!=='gpu')return NextResponse.json({error:'invalid_category'},{status:400});
 const db=publicDb();if(!db)return NextResponse.json({error:'unconfigured'},{status:503});
 try{
  const offers:(StatOffer&{evidence:string;historical_median:number|null;discount:number})[]=[];
  for(let from=0;from<3000;from+=1000){const r=await db.from('catalog_offers').select(FIELDS).eq('category',c).order('id').range(from,from+999);if(r.error)throw r.error;offers.push(...(r.data as typeof offers));if(r.data.length<1000)break;}
  const now=Date.now(),group=c==='ram'?ramGroup:gpuGroup,groups=snapshot(offers,group,now);
  const first=await db.from('price_daily').select('day').order('day').limit(1);if(first.error)throw first.error;
  const firstDay:string|null=first.data[0]?.day??null,today=spDay(now),recent=spDay(now-DAY);
  const historyDays=firstDay?Math.round((Date.parse(today)-Date.parse(firstDay))/DAY):0;
  // Janelas com dia-base real: 7/30/90 dias e "desde o início" (quando menor que 7 dias).
  const windows=[...(historyDays>=1&&historyDays<7?[historyDays]:[]),...[7,30,90].filter(d=>d<=historyDays)];
  const ids=offers.map(o=>o.id).slice(0,600);
  const periods=await Promise.all(windows.map(async days=>{const r=await db.rpc('price_changes',{p_ids:ids,p_days:days});if(r.error)throw r.error;const {panel:all,changes}=panel(r.data as ChangeRow[],recent);
   const byTier=new Map<string,string[]>();for(const g of groups){const t=g.tier??'';byTier.set(t,[...(byTier.get(t)??[]),...g.ids]);}
   const top=[...changes.entries()].filter(([,v])=>v<=-0.02).sort((a,b)=>a[1]-b[1]).slice(0,8).map(([id,v])=>{const o=offers.find(x=>x.id===id)!,row=(r.data as ChangeRow[]).find(x=>x.offer_id===id)!;return {id,title:o.title,store:o.store,seller:o.seller,url:o.url,base:Number(row.base_price),last:Number(row.last_price),change:v};});
   const rises=[...changes.entries()].filter(([,v])=>v>=0.02).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,v])=>{const o=offers.find(x=>x.id===id)!,row=(r.data as ChangeRow[]).find(x=>x.offer_id===id)!;return {id,title:o.title,store:o.store,seller:o.seller,url:o.url,base:Number(row.base_price),last:Number(row.last_price),change:v};});
   return {days,label:days===historyDays&&days<7?'desde '+firstDay!.split('-').reverse().slice(0,2).join('/'):days+' dias',all,groups:Object.fromEntries(groups.map(g=>[g.key,groupPanel(g.ids,changes)])),tiers:Object.fromEntries([...byTier].map(([t,list])=>[t,groupPanel(list,changes)])),top,rises};}));
  // Índice encadeado por segmento (RAM: geração e uso; GPU: todas), só com anúncios em grupos válidos.
  const segs=new Map<string,string[]>();for(const o of offers){const g=group(o);if(!g)continue;const k=c==='ram'?g.tier!:'Placas de vídeo';segs.set(k,[...(segs.get(k)??[]),o.id]);}
  const index=historyDays>=1?await Promise.all([...segs].map(async([name,list])=>{const r=await db.rpc('price_index',{p_ids:list.slice(0,600),p_days:90});if(r.error)throw r.error;return {name,offers:list.length,points:chainIndex((r.data as {day:string;offers:number;ratio:number|null}[]).map(x=>({day:x.day,offers:x.offers,ratio:x.ratio==null?null:Number(x.ratio)})))};})):[];
  const proven=offers.filter(o=>o.evidence==='history'&&o.available&&Date.parse(o.expires_at)>now).sort((a,b)=>b.discount-a.discount).slice(0,8).map(o=>({id:o.id,title:o.title,store:o.store,seller:o.seller,url:o.url,price:Number(o.price),median:Number(o.historical_median),discount:o.discount}));
  const live=offers.filter(o=>o.available&&Date.parse(o.expires_at)>now);
  return NextResponse.json({category:c,generated_at:new Date(now).toISOString(),coverage:{offers:offers.length,live:live.length,grouped:groups.reduce((s,g)=>s+g.offers,0),stores:new Set(live.map(o=>o.store)).size,firstDay,historyDays},groups:groups.map(({order:_o,...g})=>g),periods,index,proven},{headers:{'Cache-Control':'public, s-maxage=900, stale-while-revalidate=1800'}});
 }catch(e){console.error('stats',e&&typeof e==='object'&&'message' in e?String(e.message).slice(0,200):'erro');return NextResponse.json({error:'unavailable'},{status:503});}
}
