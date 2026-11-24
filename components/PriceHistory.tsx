'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {money,type Offer} from '@/lib/types';
import {storeNames} from '@/lib/stores';
import {availablePeriods,closeDaysAgo,dailyLowest,dayStart,describeTrend,periodStats,segments,DAY,type DailyPoint,type RawPoint} from '@/lib/history';
export type Series={id:string;label:string;color:number;points:(RawPoint&{label?:string})[];maxGap:number};
type Data={raw:RawPoint[];daily:DailyPoint[]};
const RAW_GAP=6*3600000,DAILY_GAP=1.6*DAY;
const short=(v:number)=>'R$ '+Math.round(v).toLocaleString('pt-BR');
const pctText=(x:number)=>(x>0?'+':x<0?'−':'')+(Math.floor(Math.abs(x)*1000)/10).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const when=(t:number,withTime:boolean)=>new Date(t).toLocaleString('pt-BR',withTime?{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}:{day:'2-digit',month:'2-digit',year:'2-digit',timeZone:'America/Sao_Paulo'});
const sellerLabel=(o:Offer)=>o.store==='mercadolivre'?(o.seller||'Mercado Livre')+' (ML)':storeNames[o.store]??o.store;
function niceTicks(lo:number,hi:number,count=4){const span=hi-lo||Math.max(1,hi*0.05),step0=span/count,mag=10**Math.floor(Math.log10(step0)),step=[1,2,2.5,5,10].map(m=>m*mag).find(s=>s>=step0)!;const out:number[]=[];for(let v=Math.ceil(lo/step)*step;v<=hi+1e-9;v+=step)out.push(v);return out;}

export default function PriceHistory({offer:o,comparison}:{offer:Offer;comparison?:Offer[]}){
 const peers=useMemo(()=>{const list=[o,...(comparison??[]).filter(x=>x.id!==o.id)];return list.slice(0,8);},[o,comparison]);
 const [days,setDays]=useState(7),[view,setView]=useState<'offer'|'stores'|'lowest'>('offer'),[data,setData]=useState<Record<string,Data>|null>(null),[failed,setFailed]=useState(false),[table,setTable]=useState(false);
 const ids=peers.map(p=>p.id).join(',');
 useEffect(()=>{let live=true;setFailed(false);fetch('/api/history?ids='+encodeURIComponent(ids)+'&days='+days).then(r=>{if(!r.ok)throw Error();return r.json();}).then((j:{series:{id:string;raw:[number,number][];daily:[string,number,number,number,number][]}[]})=>{if(!live)return;const out:Record<string,Data>={};for(const s of j.series)out[s.id]={raw:s.raw.map(([t,p])=>({t,p})),daily:s.daily.map(([day,min,max,close,samples])=>({day,min,max,close,samples}))};setData(out);}).catch(()=>{if(live)setFailed(true);});return ()=>{live=false;};},[ids,days]);
 const now=Date.now(),useRaw=days<=30,mine=data?.[o.id];
 const valid=(x:Offer)=>x.available&&Date.parse(x.expires_at)>now;
 const firstObserved=useMemo(()=>{if(!data)return null;const all=Object.values(data).flatMap(d=>d.daily.map(x=>dayStart(x.day)).concat(d.raw.map(x=>x.t)));return all.length?Math.min(...all):null;},[data]);
 const periods=availablePeriods(firstObserved,now);
 const pointsFor=(x:Offer):RawPoint[]=>{const d=data?.[x.id];if(!d)return [];const cutoff=now-days*DAY;let pts=useRaw?d.raw.filter(p=>p.t>=cutoff):d.daily.filter(p=>dayStart(p.day)+DAY>=cutoff).map(p=>({t:dayStart(p.day)+12*3600000,p:p.close}));
  // Preço atual verificado (dentro do TTL) entra como a observação mais recente, se for mais nova que o último ponto.
  if(useRaw&&valid(x)){const t=Date.parse(x.checked_at),last=pts[pts.length-1];if(!last||t>last.t+60000)pts=[...pts,{t,p:Number(x.price)}];}return pts;};
 const series:Series[]=useMemo(()=>{if(!data)return [];
  if(view==='stores')return peers.map((x,i)=>({id:x.id,label:sellerLabel(x),color:i,points:pointsFor(x),maxGap:useRaw?RAW_GAP:DAILY_GAP})).filter(s=>s.points.length);
  if(view==='lowest'){const cutoff=spDayCut(now-days*DAY);const low=dailyLowest(peers.map(x=>({label:sellerLabel(x),daily:(data[x.id]?.daily??[]).filter(d=>d.day>=cutoff)})));return [{id:'lowest',label:'Menor preço entre lojas',color:0,points:low.map(d=>({t:dayStart(d.day)+12*3600000,p:d.price,label:d.label})),maxGap:DAILY_GAP}];}
  return [{id:o.id,label:sellerLabel(o),color:0,points:pointsFor(o),maxGap:useRaw?RAW_GAP:DAILY_GAP}];
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[data,view,days,peers]);
 const primary=series[0]?.points??[],stats=view!=='stores'?periodStats(primary):null;
 const trend=mine?describeTrend(mine.daily,valid(o)?Number(o.price):null,now):null;
 const ago=(n:number)=>mine?closeDaysAgo(mine.daily,n,now):null;
 const totalObs=mine?mine.daily.reduce((s,d)=>s+(d.samples??1),0):0;
 const multi=peers.length>=2;
 return <div className="history-panel">
  <div className="history-toolbar">
   <div className="segmented" role="group" aria-label="Período">{periods.map(p=><button key={p.days} type="button" disabled={!p.enabled} aria-pressed={days===p.days} className={days===p.days?'active':''} title={p.enabled?undefined:'Em construção: o histórico ainda não cobre este período'} onClick={()=>setDays(p.days)}>{p.label}</button>)}</div>
   {multi&&<div className="segmented" role="group" aria-label="Visualização"><button type="button" aria-pressed={view==='offer'} className={view==='offer'?'active':''} onClick={()=>setView('offer')}>Este anúncio</button><button type="button" aria-pressed={view==='stores'} className={view==='stores'?'active':''} onClick={()=>setView('stores')}>Por loja</button><button type="button" aria-pressed={view==='lowest'} className={view==='lowest'?'active':''} onClick={()=>setView('lowest')}>Menor entre lojas</button></div>}
  </div>
  {failed?<p className="muted">Não foi possível carregar o histórico agora.</p>:!data?<div className="chart-skeleton" aria-busy="true"/>:series.every(s=>s.points.length<2)?<p className="muted">{view==='lowest'?'O menor preço entre lojas aparece por dia; ainda não há dias suficientes observados.':'Ainda há poucas observações neste período. O histórico está sendo construído a cada verificação.'}</p>:<Chart series={series} showExtremes={view!=='stores'} withTime={useRaw&&(Math.max(...primary.map(p=>p.t))-Math.min(...primary.map(p=>p.t)))<3*DAY}/>}
  {series.length>1&&<ul className="chart-legend">{series.map(s=><li key={s.id}><i style={{background:`var(--s${s.color+1})`}}/>{s.label}</li>)}</ul>}
  {stats&&view==='offer'&&<dl className="history-stats">
   <div><dt>Atual</dt><dd>{valid(o)?money(Number(o.price)):'—'}</dd></div>
   {[2,7,30].map(n=>{const v=ago(n);return <div key={n}><dt>Há {n} dias</dt><dd>{v?money(v):<small>sem dados</small>}</dd></div>;})}
   <div><dt>Menor no período</dt><dd>{money(stats.low)}</dd></div>
   <div><dt>Maior no período</dt><dd>{money(stats.high)}</dd></div>
   <div><dt>Mediana</dt><dd>{money(stats.median)}</dd></div>
   <div><dt>Variação</dt><dd className={stats.change<0?'down':stats.change>0?'up':''}>{pctText(stats.change)}</dd></div>
  </dl>}
  {stats&&view==='lowest'&&<p className="muted">Menor preço observado no período: <strong>{money(stats.low)}</strong> ({primary.find(p=>p.p===stats.low)?.label}). Mediana diária {money(stats.median)}.</p>}
  {trend&&view==='offer'&&<div className="trend-box">{trend.kind==='forming'?<p><strong>Tendência em formação.</strong> Os indicadores aparecem com pelo menos 3 dias e 5 observações (previsto a partir de {new Date(dayStart(trend.availableFrom)).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})}).</p>:<ul>{trend.signals.map(s=><li key={s.text} className={s.tone}>{s.text}</li>)}</ul>}<small>Indicadores descritivos do histórico observado. Não são previsão de preço.</small></div>}
  <p className="muted history-note">{firstObserved?<>Histórico desde {new Date(firstObserved).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})}{mine?' · '+totalObs+' observações deste anúncio':''}. </>:null}Cada ponto é uma verificação real do preço à vista. Linhas interrompidas indicam períodos sem verificação; nada é interpolado. O preço riscado da loja não entra no histórico.{view!=='offer'&&' Mesmo modelo exato (código do fabricante e variantes) em vendedores independentes; cobertura parcial das lojas monitoradas.'}</p>
  {data&&<details className="history-table" open={table} onToggle={e=>setTable((e.target as HTMLDetailsElement).open)}><summary>Ver dados em tabela</summary><table><thead><tr><th>Dia</th>{peers.filter(x=>view!=='offer'||x.id===o.id).map(x=><th key={x.id}>{sellerLabel(x)}</th>)}</tr></thead><tbody>{[...new Set(peers.flatMap(x=>data[x.id]?.daily.map(d=>d.day)??[]))].sort().reverse().slice(0,60).map(day=><tr key={day}><td>{new Date(dayStart(day)).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})}</td>{peers.filter(x=>view!=='offer'||x.id===o.id).map(x=>{const d=data[x.id]?.daily.find(y=>y.day===day);return <td key={x.id}>{d?(d.min===d.max?money(d.close):money(d.min)+' – '+money(d.max)):'—'}</td>;})}</tr>)}</tbody></table><small className="muted">Por dia: menor e maior preço observados (um valor quando não variou).</small></details>}
 </div>;
}
const spDayCut=(t:number)=>new Date(t-3*3600000).toISOString().slice(0,10);

export function Chart({series,showExtremes,withTime,axis=short,value=money}:{series:Series[];showExtremes:boolean;withTime:boolean;axis?:(v:number)=>string;value?:(v:number)=>string}){
 const box=useRef<HTMLDivElement>(null),[width,setWidth]=useState(640),[hover,setHover]=useState<number|null>(null);
 useEffect(()=>{const el=box.current;if(!el)return;const ro=new ResizeObserver(([e])=>setWidth(Math.max(280,Math.round(e.contentRect.width))));ro.observe(el);return ()=>ro.disconnect();},[]);
 const H=width<520?220:260,pad={l:width<520?54:64,r:16,t:22,b:30};
 const all=series.flatMap(s=>s.points),t0=Math.min(...all.map(p=>p.t)),t1=Math.max(...all.map(p=>p.t)),span=Math.max(t1-t0,3600000);
 const lo=Math.min(...all.map(p=>p.p)),hi=Math.max(...all.map(p=>p.p)),yPad=Math.max((hi-lo)*0.12,hi*0.01);
 const ticks=niceTicks(lo-yPad,hi+yPad),y0=Math.min(ticks[0],lo-yPad),y1=Math.max(ticks[ticks.length-1],hi+yPad);
 const x=(t:number)=>pad.l+(t-t0)/span*(width-pad.l-pad.r),y=(p:number)=>pad.t+(1-(p-y0)/(y1-y0))*(H-pad.t-pad.b);
 const xTicks=Array.from({length:width<520?3:5},(_,i)=>t0+span*i/((width<520?3:5)-1));
 const primary=series[0].points,low=primary.reduce((a,b)=>b.p<a.p?b:a,primary[0]),high=primary.reduce((a,b)=>b.p>a.p?b:a,primary[0]),last=primary[primary.length-1];
 const hoverT=hover==null?null:t0+(hover-pad.l)/(width-pad.l-pad.r)*span;
 const near=hoverT==null?[]:series.map(s=>{const p=s.points.reduce((a,b)=>Math.abs(b.t-hoverT)<Math.abs(a.t-hoverT)?b:a,s.points[0]);return Math.abs(p.t-hoverT)<=s.maxGap/2||series.length===1?{s,p}:null;}).filter(Boolean) as {s:Series;p:RawPoint&{label?:string}}[];
 const focus=near[0]?.p;
 return <div className="price-chart" ref={box}>
  <svg width={width} height={H} role="img" aria-label={'Série: de '+value(primary[0].p)+' a '+value(last.p)+', mínimo '+value(low.p)+', máximo '+value(high.p)}
   onPointerMove={e=>{const r=(e.currentTarget as SVGSVGElement).getBoundingClientRect();const px=e.clientX-r.left;setHover(px>=pad.l&&px<=width-pad.r?px:null);}} onPointerLeave={()=>setHover(null)}>
   {ticks.map(v=><g key={v}><line x1={pad.l} x2={width-pad.r} y1={y(v)} y2={y(v)} className="grid"/><text x={pad.l-8} y={y(v)+4} textAnchor="end" className="axis">{axis(v)}</text></g>)}
   {xTicks.map((t,i)=><text key={i} x={x(t)} y={H-8} textAnchor={i===0?'start':i===xTicks.length-1?'end':'middle'} className="axis">{new Date(t).toLocaleString('pt-BR',withTime?{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}:{day:'2-digit',month:'2-digit',timeZone:'America/Sao_Paulo'})}</text>)}
   {series.map(s=>segments(s.points,s.maxGap).map((seg,i)=>seg.length>1?<path key={s.id+i} d={seg.map((p,j)=>(j?'L':'M')+x(p.t).toFixed(1)+','+y(p.p).toFixed(1)).join(' ')} className="line" style={{stroke:`var(--s${s.color+1})`}}/>:<circle key={s.id+i} cx={x(seg[0].t)} cy={y(seg[0].p)} r={3} style={{fill:`var(--s${s.color+1})`}}/>))}
   {showExtremes&&low.p!==high.p&&<><circle cx={x(low.t)} cy={y(low.p)} r={5} className="mark low"/><text x={Math.min(width-pad.r-4,Math.max(pad.l+4,x(low.t)))} y={Math.min(H-pad.b-6,y(low.p)+18)} textAnchor="middle" className="mark-label">mín {axis(low.p)}</text>
    <circle cx={x(high.t)} cy={y(high.p)} r={5} className="mark high"/><text x={Math.min(width-pad.r-4,Math.max(pad.l+4,x(high.t)))} y={Math.max(pad.t-6,y(high.p)-10)} textAnchor="middle" className="mark-label">máx {axis(high.p)}</text></>}
   {showExtremes&&<circle cx={x(last.t)} cy={y(last.p)} r={5.5} className="mark current" style={{fill:'var(--s1)'}}/>}
   {hover!=null&&focus&&<><line x1={x(focus.t)} x2={x(focus.t)} y1={pad.t} y2={H-pad.b} className="crosshair"/>{near.map(({s,p})=><circle key={s.id} cx={x(p.t)} cy={y(p.p)} r={4.5} className="mark" style={{fill:`var(--s${s.color+1})`}}/>)}</>}
  </svg>
  {hover!=null&&focus&&<div className="chart-tip" style={{left:Math.min(width-190,Math.max(0,x(focus.t)-95))}}><strong>{when(focus.t,withTime)}</strong>{near.map(({s,p})=><span key={s.id}><i style={{background:`var(--s${s.color+1})`}}/>{p.label??s.label}<b>{value(p.p)}</b></span>)}</div>}
 </div>;
}
