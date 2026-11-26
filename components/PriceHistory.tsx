'use client';import {fetchHistory,type HistorySeries} from '@/lib/history-client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {money,type Offer} from '@/lib/types';
import {storeNames} from '@/lib/stores';
import {availablePeriods,closeDaysAgo,dailyLowest,dailySeries,dayStart,describeTrend,median,segments,spDay,DAY,type DailyPoint,type RawPoint} from '@/lib/history';
// Ponto do gráfico: valor observado, rótulo de loja opcional, linhas extras para o tooltip e dia parcial (hoje).
export type ChartPoint=RawPoint&{label?:string;detail?:string[];partial?:boolean;hi?:number;seg?:number};
export type Series={id:string;label:string;color:number;points:ChartPoint[];maxGap:number};
type Announced={day:string;min:number;postedAt:string;post:string;last:number;posts:number};
type Data={raw:RawPoint[];daily:DailyPoint[];announced:Announced[]};
const RAW_GAP=6*3600000,DAILY_GAP=1.6*DAY;
const short=(v:number)=>'R$ '+Math.round(v).toLocaleString('pt-BR');
const pctText=(x:number)=>(x>0?'+':x<0?'−':'')+(Math.floor(Math.abs(x)*1000)/10).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const dateBR=(t:number,year=false)=>new Date(t).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',...(year?{year:'numeric'}:{}),timeZone:'America/Sao_Paulo'});
const timeBR=(t:number)=>new Date(t).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'});
const sellerLabel=(o:Offer)=>o.store==='mercadolivre'?(o.seller||'Mercado Livre')+' (ML)':storeNames[o.store]??o.store;
function niceTicks(lo:number,hi:number,count=4){const span=hi-lo||Math.max(1,hi*0.05),step0=span/count,mag=10**Math.floor(Math.log10(step0)),step=[1,2,2.5,5,10].map(m=>m*mag).find(s=>s>=step0)!;const out:number[]=[];for(let v=Math.floor(lo/step)*step;v<=hi+step-1e-9;v+=step)out.push(v);return out;}
const dayDetail=(d:{max:number;close:number;samples:number;partial:boolean;p:number})=>[...(d.max!==d.p?['Maior do dia: '+money(d.max)]:[]),...(d.close!==d.p||d.max!==d.p?[(d.partial?'Atual: ':'Último do dia: ')+money(d.close)]:[]),d.samples+(d.samples===1?' verificação':' verificações')+(d.partial?' · dia em andamento':'')];

export default function PriceHistory({offer:o,comparison}:{offer:Offer;comparison?:Offer[]}){
 const peers=useMemo(()=>{const list=[o,...(comparison??[]).filter(x=>x.id!==o.id)];return list.slice(0,8);},[o,comparison]);
 const [days,setDays]=useState(7),[view,setView]=useState<'offer'|'stores'|'lowest'>('offer'),[intraday,setIntraday]=useState(false),[data,setData]=useState<Record<string,Data>|null>(null),[failed,setFailed]=useState(false);
 const ids=peers.map(p=>p.id).join(',');
 // Uma única consulta: resumo diário (até 400 dias) + verificações brutas das últimas 48 h para a visão de detalhe.
 useEffect(()=>{let live=true;setFailed(false);fetchHistory(ids.split(',')).then((j:{series:HistorySeries[]})=>{if(!live)return;const out:Record<string,Data>={};for(const s of j.series)out[s.id]={raw:s.raw.map(([t,p])=>({t,p})),daily:s.daily.map(([day,min,max,close,samples])=>({day,min,max,close,samples})),announced:(s.announced??[]).map(([day,min,postedAt,post,last,posts])=>({day,min,postedAt,post,last,posts}))};setData(out);}).catch(()=>{if(live)setFailed(true);});return ()=>{live=false;};},[ids]);
 const now=Date.now(),mine=data?.[o.id];
 const valid=(x:Offer)=>x.available&&Date.parse(x.expires_at)>now;
 const current=(x:Offer)=>valid(x)?Number(x.price):null;
 const firstObserved=useMemo(()=>{if(!data)return null;const all=Object.values(data).flatMap(d=>d.daily.map(x=>dayStart(x.day)));return all.length?Math.min(...all):null;},[data]);
 const periods=availablePeriods(firstObserved,now);
 const dailyFor=(x:Offer)=>dailySeries(data?.[x.id]?.daily??[],days,current(x),now);
 const series:Series[]=useMemo(()=>{if(!data)return [];
  if(intraday){const cutoff=now-2*DAY;return peers.filter(x=>view==='stores'||x.id===o.id).map((x,i)=>{let pts:ChartPoint[]=(data[x.id]?.raw??[]).filter(p=>p.t>=cutoff);const c=current(x);if(c!=null){const t=Date.parse(x.checked_at),last=pts[pts.length-1];if(!last||t>last.t+60000)pts=[...pts,{t,p:c}];}return {id:x.id,label:sellerLabel(x),color:i,points:pts,maxGap:RAW_GAP};}).filter(s=>s.points.length);}
  const toPoints=(x:Offer):ChartPoint[]=>dailyFor(x).map(d=>({t:d.t,p:d.p,hi:d.max,partial:d.partial,detail:dayDetail(d)}));
  if(view==='stores')return peers.map((x,i)=>({id:x.id,label:sellerLabel(x),color:i,points:toPoints(x),maxGap:DAILY_GAP})).filter(s=>s.points.length);
  if(view==='lowest'){const today=spDay(now),low=dailyLowest(peers.map(x=>({label:sellerLabel(x),daily:dailyFor(x).map(d=>({day:d.day,min:d.p,max:d.max,close:d.close}))})));return [{id:'lowest',label:'Menor preço entre lojas',color:0,points:low.map(d=>({t:dayStart(d.day)+12*3600000,p:d.price,label:d.label,partial:d.day===today,detail:d.day===today?['Dia em andamento']:undefined})),maxGap:DAILY_GAP}];}
  return [{id:o.id,label:sellerLabel(o),color:0,points:toPoints(o),maxGap:DAILY_GAP}];
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[data,view,days,peers,intraday]);
 const mineDays=mine?dailyFor(o):[];
 const stats=mineDays.length?{low:Math.min(...mineDays.map(d=>d.p)),high:Math.max(...mineDays.map(d=>d.max)),median:median(mineDays.map(d=>d.p))!,change:mineDays.length>1?mineDays[mineDays.length-1].p/mineDays[0].p-1:null,days:mineDays.length}:null;
 const trend=mine?describeTrend(mine.daily,current(o),now):null;
 const ago=(n:number)=>mine?closeDaysAgo(mine.daily,n,now,'min'):null;
 const totalObs=mine?mine.daily.reduce((s,d)=>s+(d.samples??1),0):0;
 const multi=peers.length>=2,primary=series[0]?.points??[];
 const empty=!series.some(s=>s.points.length>0);
 // Oferta anunciada pela loja (Telegram): só existe a série de preços ANUNCIADOS, mostrada à parte.
 if(o.verification_status==='announced')return failed?<p className="muted">Não foi possível carregar o histórico agora.</p>:!data?<div className="chart-skeleton" aria-busy="true"/>:<AnnouncedHistory rows={mine?.announced??[]}/>;
 return <div className="history-panel">
  <div className="history-toolbar">
   {!intraday&&<div className="segmented" role="group" aria-label="Período">{periods.map(p=><button key={p.days} type="button" disabled={!p.enabled} aria-pressed={days===p.days} className={days===p.days?'active':''} title={p.enabled?undefined:'Em construção: o histórico ainda não cobre este período'} onClick={()=>setDays(p.days)}>{p.label}</button>)}</div>}
   {multi&&<div className="segmented" role="group" aria-label="Visualização"><button type="button" aria-pressed={view==='offer'} className={view==='offer'?'active':''} onClick={()=>setView('offer')}>Este anúncio</button><button type="button" aria-pressed={view==='stores'} className={view==='stores'?'active':''} onClick={()=>setView('stores')}>Por loja</button>{!intraday&&<button type="button" aria-pressed={view==='lowest'} className={view==='lowest'?'active':''} onClick={()=>setView('lowest')}>Menor entre lojas</button>}</div>}
  </div>
  {failed?<p className="muted">Não foi possível carregar o histórico agora.</p>:!data?<div className="chart-skeleton" aria-busy="true"/>:empty?<p className="muted">Ainda não há observações neste período. O histórico está sendo construído a cada verificação.</p>:<Chart series={series} showExtremes={view!=='stores'} daily={!intraday} domain={intraday?undefined:[dayStart(spDay(now-(days-1)*DAY))+12*3600000,dayStart(spDay(now))+12*3600000]}/>}
  {series.length>1&&<ul className="chart-legend">{series.map(s=><li key={s.id}><i style={{background:`var(--s${s.color+1})`}}/>{s.label}</li>)}</ul>}
  <button type="button" className="link-button" onClick={()=>{setIntraday(!intraday);if(!intraday&&view==='lowest')setView('offer');}}>{intraday?'Voltar ao histórico diário':'Ver verificações das últimas 48 h'}</button>
  {!intraday&&stats&&view==='offer'&&<dl className="history-stats">
   <div><dt>Atual</dt><dd>{valid(o)?money(Number(o.price)):'—'}</dd></div>
   {[2,7,30].map(n=>{const v=ago(n);return <div key={n}><dt>Há {n} dias</dt><dd>{v?money(v):<small>sem dados</small>}</dd></div>;})}
   <div><dt>Menor no período</dt><dd>{money(stats.low)}</dd></div>
   <div><dt>Maior no período</dt><dd>{money(stats.high)}</dd></div>
   <div><dt>Mediana diária</dt><dd>{money(stats.median)}</dd></div>
   <div><dt>Variação</dt><dd className={stats.change==null?'':stats.change<0?'down':stats.change>0?'up':''}>{stats.change==null?<small>1 dia observado</small>:pctText(stats.change)}</dd></div>
   {(()=>{const ref=Number(o.reference_median),ok=ref>0&&Number(o.reference_days??0)>=3&&valid(o);return <><div><dt>Preço habitual</dt><dd>{ok?money(ref):<small>em formação</small>}</dd></div><div><dt>Atual × habitual</dt><dd className={ok?(o.price<ref?'down':o.price>ref?'up':''):''}>{ok?pctText(o.price/ref-1):<small>—</small>}</dd></div></>;})()}
   <div><dt>Maior observado − atual</dt><dd>{valid(o)&&stats.high>o.price?money(stats.high-Number(o.price)):<small>—</small>}</dd></div>
   <div><dt>Dias monitorados</dt><dd>{mine?.daily.length??0}</dd></div>
  </dl>}
  {!intraday&&stats&&view==='offer'&&<p className="muted history-note">Preço habitual = mediana dos menores preços diários dos dias completos anteriores a hoje (até 30 dias; cada dia conta uma vez). O maior preço observado é um registro histórico, não o preço normal: não é usado sozinho para classificar promoções.</p>}
  {!intraday&&view==='lowest'&&primary.length>0&&(()=>{const l=primary.reduce((a,b)=>b.p<a.p?b:a);return <p className="muted">Menor preço observado no período: <strong>{money(l.p)}</strong> ({l.label}, {dateBR(l.t)}). Mediana dos menores diários: {money(median(primary.map(p=>p.p))!)}.</p>;})()}
  {trend&&view==='offer'&&!intraday&&<div className="trend-box">{trend.kind==='forming'?<p><strong>Tendência em formação.</strong> Os indicadores aparecem com pelo menos 3 dias e 5 observações (previsto a partir de {dateBR(dayStart(trend.availableFrom),true)}).</p>:<ul>{trend.signals.map(s=><li key={s.text} className={s.tone}>{s.text}</li>)}</ul>}<small>Indicadores descritivos do histórico observado. Não são previsão de preço.</small></div>}
  <p className="muted history-note">{firstObserved?<>Monitoramento desde {dateBR(firstObserved,true)}{mine?' · '+totalObs+' verificações deste anúncio':''}{peers.length>1?' · '+peers.length+' lojas consideradas':''}. Dias anteriores ao início do monitoramento aparecem vazios. </>:null}{intraday?'Cada ponto é uma verificação real (até uma por hora). ':'Cada ponto é o menor preço à vista observado no dia (horário de Brasília); o dia de hoje é parcial e pode mudar. Dias sem coleta ficam sem ponto e interrompem a linha. '}O preço riscado da loja não entra no histórico.{view!=='offer'&&' Mesmo modelo exato (código do fabricante e variantes) em vendedores independentes; cobertura parcial das lojas monitoradas.'}</p>
  {data&&!intraday&&<details className="history-table"><summary>Ver dados em tabela</summary><table><thead><tr><th>Dia</th>{peers.filter(x=>view!=='offer'||x.id===o.id).map(x=><th key={x.id}>{sellerLabel(x)}</th>)}</tr></thead><tbody>{[...new Set(peers.flatMap(x=>dailyFor(x).map(d=>d.day)))].sort().reverse().map(day=><tr key={day}><td>{dateBR(dayStart(day))}{day===spDay(now)&&' (parcial)'}</td>{peers.filter(x=>view!=='offer'||x.id===o.id).map(x=>{const d=dailyFor(x).find(y=>y.day===day);return <td key={x.id}>{d?(d.p===d.max?money(d.p):money(d.p)+' – '+money(d.max)):'—'}</td>;})}</tr>)}</tbody></table><small className="muted">Por dia: menor e maior preço observados (um valor quando não variou).</small></details>}
 </div>;
}

export function Chart({series,showExtremes,daily,axis=short,value=money,domain}:{series:Series[];showExtremes:boolean;daily:boolean;axis?:(v:number)=>string;value?:(v:number)=>string;domain?:[number,number]}){
 const box=useRef<HTMLDivElement>(null),[width,setWidth]=useState(640),[hover,setHover]=useState<number|null>(null);
 useEffect(()=>{const el=box.current;if(!el)return;const ro=new ResizeObserver(([e])=>setWidth(Math.max(280,Math.round(e.contentRect.width))));ro.observe(el);return ()=>ro.disconnect();},[]);
 const narrow=width<520,H=narrow?220:260,pad={l:narrow?54:64,r:narrow?12:18,t:24,b:30};
 const all=series.flatMap(s=>s.points),tMin=Math.min(...all.map(p=>p.t)),tMax=Math.max(...all.map(p=>p.t));
 // Escala diária: meio dia de folga de cada lado (um ponto único fica centralizado); escala intradiária: no mínimo 1 h.
 // Com `domain` (período escolhido), o eixo cobre o período inteiro: dias antes do início do monitoramento ou sem coleta
 // ficam vazios (nada é interpolado).
 const t0=daily?Math.min(domain?domain[0]:tMin,tMin)-DAY/2:tMin,t1=daily?Math.max(domain?domain[1]:tMax,tMax)+DAY/2:Math.max(tMax,tMin+3600000),span=t1-t0;
 const lo=Math.min(...all.map(p=>p.p)),hi=Math.max(...all.map(p=>p.hi??p.p)),yPad=Math.max((hi-lo)*0.12,hi*0.01);
 const ticks=niceTicks(lo-yPad,hi+yPad),y0=ticks[0],y1=ticks[ticks.length-1];
 const x=(t:number)=>pad.l+(t-t0)/span*(width-pad.l-pad.r),y=(p:number)=>pad.t+(1-(p-y0)/(y1-y0))*(H-pad.t-pad.b);
 // Eixo X diário: uma marca por dia observado (sem datas repetidas); com muitos dias, marcas espaçadas em dias inteiros.
 const maxTicks=narrow?4:7,daysAll=[...new Set(all.map(p=>p.t))].sort((a,b)=>a-b);
 const xTicks=daily&&domain?Array.from({length:maxTicks},(_,i)=>{const a=t0+DAY/2,n=Math.round((t1-DAY/2-a)/DAY);return a+Math.round(n*i/(maxTicks-1))*DAY;}):daily?(daysAll.length<=maxTicks?daysAll:Array.from({length:maxTicks},(_,i)=>{const n=Math.round((tMax-tMin)/DAY);return tMin+Math.round(n*i/(maxTicks-1))*DAY;})):Array.from({length:narrow?3:5},(_,i)=>tMin+(t1-tMin)*i/((narrow?3:5)-1));
 const primary=series[0].points,low=primary.reduce((a,b)=>b.p<a.p?b:a,primary[0]),highPoint=primary.reduce((a,b)=>(b.hi??b.p)>(a.hi??a.p)?b:a,primary[0]),high={t:highPoint.t,p:highPoint.hi??highPoint.p},last=primary[primary.length-1];
 const hoverT=hover==null?null:t0+(hover-pad.l)/(width-pad.l-pad.r)*span;
 const near=hoverT==null?[]:series.map(s=>{if(!s.points.length)return null;const p=s.points.reduce((a,b)=>Math.abs(b.t-hoverT)<Math.abs(a.t-hoverT)?b:a,s.points[0]);return Math.abs(p.t-hoverT)<=(daily?DAY/2:s.maxGap/2)||series.length===1?{s,p}:null;}).filter(Boolean) as {s:Series;p:ChartPoint}[];
 const focus=near[0]?.p;
 const color=(s:Series)=>`var(--s${s.color+1})`;
 return <div className="price-chart" ref={box}>
  <svg width={width} height={H} role="img" aria-label={'Série: de '+value(primary[0].p)+' a '+value(last.p)+', mínimo '+value(low.p)+', máximo '+value(high.p)}
   onPointerMove={e=>{const r=(e.currentTarget as SVGSVGElement).getBoundingClientRect();const px=e.clientX-r.left;setHover(px>=pad.l&&px<=width-pad.r?px:null);}} onPointerLeave={()=>setHover(null)}>
   {ticks.map(v=><g key={v}><line x1={pad.l} x2={width-pad.r} y1={y(v)} y2={y(v)} className="grid"/><text x={pad.l-8} y={y(v)+4} textAnchor="end" className="axis">{axis(v)}</text></g>)}
   {xTicks.map((t,i)=><text key={i} x={x(t)} y={H-8} textAnchor={!daily&&i===0?'start':!daily&&i===xTicks.length-1?'end':'middle'} className="axis">{daily?dateBR(t):timeBR(t)}</text>)}
   {series.map(s=>segments(s.points,s.maxGap).map((seg,i)=>{const solid=seg.filter(p=>!p.partial),partial=seg.find(p=>p.partial);return <g key={s.id+i}>
    {solid.length>1&&<path d={solid.map((p,j)=>(j?'L':'M')+x(p.t).toFixed(1)+','+y(p.p).toFixed(1)).join(' ')} className="line" style={{stroke:color(s)}}/>}
    {partial&&solid.length>0&&<path d={'M'+x(solid[solid.length-1].t).toFixed(1)+','+y(solid[solid.length-1].p).toFixed(1)+'L'+x(partial.t).toFixed(1)+','+y(partial.p).toFixed(1)} className="line partial" style={{stroke:color(s)}}/>}
    {daily&&seg.filter(p=>p.hi!=null&&p.hi>p.p).map(p=><line key={'w'+p.t} x1={x(p.t)} x2={x(p.t)} y1={y(p.p)} y2={y(p.hi!)} className="whisker" style={{stroke:color(s)}}/>)}
    {daily?seg.map(p=><circle key={p.t} cx={x(p.t)} cy={y(p.p)} r={p.partial?4:3} className={p.partial?'dot partial':'dot'} style={p.partial?{stroke:color(s)}:{fill:color(s)}}/>):seg.length===1&&<circle cx={x(seg[0].t)} cy={y(seg[0].p)} r={3} style={{fill:color(s)}}/>}
   </g>;}))}
   {showExtremes&&low.p!==high.p&&<><circle cx={x(low.t)} cy={y(low.p)} r={5.5} className="mark low"/><text x={Math.min(width-pad.r-24,Math.max(pad.l+24,x(low.t)))} y={Math.min(H-pad.b-6,y(low.p)+18)} textAnchor="middle" className="mark-label">mín {axis(low.p)}</text>
    <circle cx={x(high.t)} cy={y(high.p)} r={5.5} className="mark high"/><text x={Math.min(width-pad.r-24,Math.max(pad.l+24,x(high.t)))} y={Math.max(pad.t-8,y(high.p)-10)} textAnchor="middle" className="mark-label">máx {axis(high.p)}</text></>}
   {hover!=null&&focus&&<><line x1={x(focus.t)} x2={x(focus.t)} y1={pad.t} y2={H-pad.b} className="crosshair"/>{near.map(({s,p})=><circle key={s.id} cx={x(p.t)} cy={y(p.p)} r={5} className="mark" style={{fill:color(s)}}/>)}</>}
  </svg>
  {hover!=null&&focus&&<div className="chart-tip" style={{left:Math.min(width-200,Math.max(0,x(focus.t)-100))}}><strong>{daily?dateBR(focus.t,true):timeBR(focus.t)}{focus.partial&&<em> · parcial</em>}</strong>{near.map(({s,p})=><div key={s.id} className="tip-row"><span><i style={{background:color(s)}}/>{p.label??s.label}<b>{value(p.p)}</b></span>{p.detail?.map(d=><small key={d}>{d}</small>)}</div>)}{daily&&series.length===1&&<small className="tip-note">Ponto = menor preço observado no dia{primary.some(p=>p.hi!=null&&p.hi>p.p)?'; traço vertical = variação do dia':''}</small>}</div>}
 </div>;
}

// "Histórico de preços anunciados": um ponto por dia = menor preço que a própria loja publicou no dia (Telegram).
// Separado das verificações; não entra em estatísticas, referência de mercado nem alertas.
function AnnouncedHistory({rows}:{rows:Announced[]}){
 const today=spDay(Date.now()),recent=rows.filter(r=>r.day>=spDay(Date.now()-89*DAY));
 const points:ChartPoint[]=recent.map(r=>({t:dayStart(r.day)+12*3600000,p:r.min,partial:r.day===today,detail:['Publicado às '+new Date(r.postedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'})+' (t.me/'+r.post+')',...(r.last!==r.min?['Último anunciado no dia: '+money(r.last)]:[]),r.posts+(r.posts===1?' publicação':' publicações')+(r.day===today?' · dia em andamento':'')]}));
 return <div className="history-panel">
  <h3 className="announced-title">Histórico de preços anunciados</h3>
  {points.length?<Chart series={[{id:'announced',label:'Preço anunciado pela loja',color:0,points,maxGap:DAILY_GAP}]} showExtremes daily/>:<p className="muted">Ainda não há anúncios registrados para este produto.</p>}
  <p className="muted history-note">Cada ponto é o menor preço que a própria loja publicou no dia no Telegram (horário de Brasília), com o horário e o link da publicação. Esses preços não foram conferidos na página do produto e ficam separados do histórico de preços verificados: não entram em estatísticas, comparações de mercado nem alertas. Publicações repetidas contam uma vez.</p>
 </div>;
}
