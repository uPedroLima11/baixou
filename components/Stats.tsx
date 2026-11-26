'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,TrendingDown,TrendingUp,Minus,Info,RefreshCw,X} from 'lucide-react';
import {money} from '@/lib/types';
import {storeNames} from '@/lib/stores';
import {dayStart,DAY} from '@/lib/history';
import {Chart,type Series} from './PriceHistory';
import {StoreIcon} from './StoreBadge';
import type {StatsResult,StatGroup} from '@/lib/stats-data';
// Painel de preços: uma categoria por vez, filtros compactos, tabela por configuração REAL de compra (módulo, kit,
// placa) e gráfico das linhas escolhidas. Conteúdo principal vem no HTML; o gráfico carrega em seguida.
type SeriesData={key:string;label:string;members:number;live:number;points:{day:string;offers:number;lowest:number;store:string;offer:string;median:number;typical:number|null;segment:number;pairs:number;partial:boolean}[];
 summary:{days:number;today:number|null;periodLow:{price:number;day:string;store:string;offer:string;title:string;live:boolean}|null;medianLow:number|null;typical:{from:string;to:string;change:number}|null}};
const PREFERRED_GPU=['RTX 5060|8','RTX 5060 Ti|16','RTX 5070|12','RTX 5070 Ti|16','RX 9070 XT|16'];
const pct=(x:number)=>(x>0?'+':x<0?'−':'')+(Math.floor(Math.abs(x)*1000)/10).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const signedMoney=(x:number)=>(x>0?'+':x<0?'−':'')+money(Math.abs(x));
const dateBR=(day:string)=>new Date(dayStart(day)).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'America/Sao_Paulo'});
const sellerOf=(m:{store:string;seller:string})=>m.store==='mercadolivre'?m.seller.replace(/ \(loja oficial no Mercado Livre\)$/,''):storeNames[m.store]??m.store;
const cache=new Map<string,StatsResult>();
function queryOf(c:string,applied:Record<string,string>,days:number){const sp=new URLSearchParams({c});for(const [k,v] of Object.entries(applied))if(v)sp.set(k,v);if(days)sp.set('dias',String(days));return sp.toString();}
function Change({v,abs}:{v:number;abs?:number}){const cls=v<=-0.02?'down':v>=0.02?'up':'';return <span className={'stat-change '+cls}>{v<=-0.02?<TrendingDown size={13} aria-hidden/>:v>=0.02?<TrendingUp size={13} aria-hidden/>:<Minus size={13} aria-hidden/>}{abs!=null&&Math.abs(abs)>=0.01?signedMoney(abs)+' · ':''}{pct(v)}</span>;}

export default function Stats({initial}:{initial:StatsResult|null}){
 const [data,setData]=useState<StatsResult|null>(initial),[busy,setBusy]=useState(false),[err,setErr]=useState(false);
 const [cat,setCat]=useState<'ram'|'gpu'>(initial?.category??'ram'),[applied,setApplied]=useState<Record<string,string>>(initial?.applied??{}),[days,setDays]=useState(initial?.days??7);
 const first=useRef(true);
 if(initial&&first.current)cache.set(queryOf(initial.category,initial.applied,initial.days),initial);
 // Estado inicial pela URL (compartilhável); sem parâmetros, usa o conteúdo que veio no HTML.
 useEffect(()=>{const sp=new URLSearchParams(location.search);const c=sp.get('c')==='gpu'?'gpu':'ram',a:Record<string,string>={};sp.forEach((v,k)=>{if(!['c','dias'].includes(k))a[k]=v;});if(c!==cat||Object.keys(a).length||sp.get('dias')){setCat(c);setApplied(a);if(sp.get('dias'))setDays(Number(sp.get('dias')));}},[]);// eslint-disable-line react-hooks/exhaustive-deps
 const q=queryOf(cat,applied,days);
 useEffect(()=>{if(first.current&&data&&queryOf(data.category,data.applied,data.days)===q){first.current=false;return;}first.current=false;
  try{history.replaceState(history.state,'','/estatisticas?'+q);}catch{}
  const hit=cache.get(q);if(hit){setData(hit);return;}
  let live=true;setBusy(true);setErr(false);fetch('/api/stats?'+q).then(r=>{if(!r.ok)throw Error();return r.json();}).then((j:StatsResult)=>{cache.set(q,j);if(live)setData(j);}).catch(()=>{if(live)setErr(true);}).finally(()=>{if(live)setBusy(false);});return()=>{live=false;};},[q]);// eslint-disable-line react-hooks/exhaustive-deps
 const view=data&&data.category===cat?data:null;
 const setFilter=(k:string,v:string)=>setApplied(a=>{const n={...a};if(v)n[k]=v;else delete n[k];return n;});
 const chooseCat=(c:'ram'|'gpu')=>{if(c===cat)return;setCat(c);setApplied({});};
 return <div className="stats-page">
  <header className="stats-header wrap"><a href="/" className="brand" aria-label="Baixou! início"><img src="/logo.png" alt="Baixou!" width="120" height="41"/></a><a href="/" className="back-link"><ArrowLeft size={16}/>Ofertas</a></header>
  <main className="wrap stats-main">
   <div className="stats-top">
    <h1>Estatísticas de preços</h1>
    <div className="segmented" role="tablist" aria-label="Categoria"><button role="tab" aria-selected={cat==='ram'} className={cat==='ram'?'active':''} onClick={()=>chooseCat('ram')}>Memória RAM</button><button role="tab" aria-selected={cat==='gpu'} className={cat==='gpu'?'active':''} onClick={()=>chooseCat('gpu')}>Placas de vídeo</button></div>
    {view&&view.windows.length>0&&<div className="segmented" role="group" aria-label="Período">{view.windows.map(d=><button key={d} aria-pressed={view.days===d} className={view.days===d?'active':''} onClick={()=>setDays(d)}>{d===view.historyDays&&d<7?'Desde '+dateBR(view.firstDay!):d<=90?d+' dias':d===180?'6 meses':'1 ano'}</button>)}</div>}
    {busy&&<span className="stats-busy" role="status"><RefreshCw size={14} className="spin"/>Atualizando</span>}
   </div>
   {view&&<div className="stats-filters" role="group" aria-label="Filtros">{view.filters.map(f=><label key={f.key} className={applied[f.key]?'on':''}><span>{f.label}</span><select value={applied[f.key]??''} onChange={e=>setFilter(f.key,e.target.value)}><option value="">Todos</option>{f.options.map(o=><option key={o.value} value={o.value}>{o.label} ({o.count})</option>)}</select></label>)}{Object.keys(applied).length>0&&<button className="link-button" onClick={()=>setApplied({})}><X size={13}/>Limpar filtros</button>}</div>}
   {err&&!view?<p className="muted">Não foi possível carregar as estatísticas agora. Tente novamente em instantes.</p>:!view?<StatsSkeleton/>:<StatsPanel key={view.category} data={view} applied={applied}/>}
  </main>
 </div>;
}
function StatsSkeleton(){return <div className="stats-panel"><div className="chart-skeleton" aria-busy="true" style={{height:360}}/><div className="chart-skeleton" aria-busy="true" style={{height:360}}/></div>;}

function StatsPanel({data,applied}:{data:StatsResult;applied:Record<string,string>}){
 const c=data.category,groups=data.groups;
 const defaults=useMemo(()=>{if(c==='gpu'){const pref=PREFERRED_GPU.filter(k=>groups.some(g=>g.key===k));return (pref.length>=3?pref:[...pref,...[...groups].sort((a,b)=>b.offers-a.offers).map(g=>g.key).filter(k=>!pref.includes(k))]).slice(0,4);}return [...groups].sort((a,b)=>b.offers-a.offers).slice(0,4).map(g=>g.key);},[c,groups]);
 const [picked,setPicked]=useState<string[]|null>(null),[metric,setMetric]=useState<'lowest'|'typical'>('lowest');
 const sel=(picked??defaults).filter(k=>groups.some(g=>g.key===k));
 const toggle=(k:string)=>{const cur=sel;setPicked(cur.includes(k)?cur.filter(x=>x!==k):cur.length>=6?cur:[...cur,k]);};
 const colorOf=(k:string)=>sel.indexOf(k);
 const tiers=[...new Set(groups.map(g=>g.tier))];
 return <>
  <div className="stats-panel">
   <section className="stats-card table-card">
    <div className="stats-table-wrap"><table className="stats-table compact">
     <thead><tr><th scope="col"><span className="sr-only">No gráfico</span></th><th scope="col">{c==='ram'?'Configuração':'GPU · VRAM'}</th><th scope="col">Menor agora</th><th scope="col">Típico</th><th scope="col">Maior</th><th scope="col">{data.days?'Variação':'Variação'}</th><th scope="col">Ofertas</th></tr></thead>
     <tbody>{groups.length?groups.map((g,i)=>{const on=sel.includes(g.key),showTier=c==='ram'&&tiers.length>1&&(i===0||groups[i-1].tier!==g.tier);return <GroupRow key={g.key} g={g} c={c} on={on} color={colorOf(g.key)} showTier={showTier} toggle={()=>toggle(g.key)}/>;}):<tr><td colSpan={7} className="muted">Nenhuma configuração com ofertas ativas para estes filtros.</td></tr>}</tbody>
    </table></div>
    <p className="muted small">Preço do {c==='ram'?'módulo ou kit inteiro':'produto'}; típico = mediana das ofertas ativas; variação = mediana do mesmo anúncio no início e no fim do período{data.days?' ('+data.days+' dias)':''}. Clique numa linha para incluí-la no gráfico.</p>
   </section>
   <Evolution data={data} applied={applied} keys={sel} colorOf={colorOf} metric={metric} setMetric={setMetric}/>
  </div>
  {(data.moves.down.length>0||data.moves.up.length>0)&&<section className="stats-card movers"><div><h2><TrendingDown size={15}/>Maiores quedas{data.days?' · '+data.days+' dias':''}</h2><MoveList list={data.moves.down} empty="Nenhuma queda de 2% ou mais."/></div><div><h2><TrendingUp size={15}/>Maiores altas</h2><MoveList list={data.moves.up} empty="Nenhuma alta de 2% ou mais."/></div></section>}
  <details className="stats-method"><summary><Info size={14}/>Metodologia e amostra</summary><ul>
   <li>Amostra: {data.sample.grouped} de {data.sample.live} ofertas ativas com preço verificado à vista/Pix, em {data.sample.stores} lojas; {data.sample.paired} anúncios com início e fim do período. Histórico desde {data.firstDay?dateBR(data.firstDay):'—'} ({data.historyDays} dias).</li>
   <li>{c==='ram'?'Cada configuração é comparada só com ela mesma: geração, uso (desktop, notebook, servidor ECC/registrada), módulo × kit com a mesma divisão e capacidade total. Atributo desconhecido exclui o anúncio.':'Cada linha é um modelo de GPU com a mesma VRAM; fabricantes de placa diferentes entram como alternativas.'}</li>
   <li>Preço riscado ("de") e preços apenas divulgados pelas lojas nunca entram. Gráfico: um ponto por dia (menor preço do dia), dias sem coleta ficam vazios, hoje é parcial; "preço típico" acompanha os mesmos anúncios de um dia para o outro, então produtos novos não distorcem a evolução.</li>
   <li>Cobertura parcial das lojas monitoradas; não há previsão de preço.</li></ul></details>
 </>;
}
function GroupRow({g,c,on,color,showTier,toggle}:{g:StatGroup;c:string;on:boolean;color:number;showTier:boolean;toggle:()=>void}){
 return <>{showTier&&<tr className="tier-row"><th colSpan={7}>{g.tier}</th></tr>}<tr className={on?'on':''} onClick={toggle}>
  <td><button type="button" className="pick" aria-pressed={on} aria-label={(on?'Remover do gráfico: ':'Mostrar no gráfico: ')+g.label} onClick={e=>{e.stopPropagation();toggle();}}><i style={on?{background:`var(--s${color+1})`}:undefined}/></button></td>
  <th scope="row">{c==='ram'?g.label.replace(/^DDR\d · /,''):g.label}</th>
  <td onClick={e=>e.stopPropagation()}><a href={'/produto/'+encodeURIComponent(g.low.id)} title={g.low.title} className="low-link"><StoreIcon store={g.low.store} size={14}/><b>{money(g.low.price)}</b></a><small>{sellerOf(g.low)}</small></td>
  <td>{money(g.median)}</td><td>{money(g.high)}</td>
  <td>{g.change?<><Change v={g.change.pct} abs={g.change.abs}/><small>{g.change.paired} anúncios</small></>:<span className="muted">—</span>}</td>
  <td>{g.offers}<small>{g.sellers} {g.sellers===1?'loja':'lojas'}</small></td></tr></>;
}
function MoveList({list,empty}:{list:StatsResult['moves']['down'];empty:string}){return list.length?<ol className="move-list">{list.map(m=><li key={m.id}><a href={'/produto/'+encodeURIComponent(m.id)}>{m.title}</a><span><StoreIcon store={m.store} size={12}/>{sellerOf(m)} · {money(m.base)} → <strong>{money(m.last)}</strong> <Change v={m.change}/></span></li>)}</ol>:<p className="muted small">{empty}</p>;}

// Evolução: carregada só depois do conteúdo principal e só para as linhas escolhidas (cache por combinação).
const seriesCache=new Map<string,Promise<SeriesData[]>>();
function Evolution({data,applied,keys,colorOf,metric,setMetric}:{data:StatsResult;applied:Record<string,string>;keys:string[];colorOf:(k:string)=>number;metric:'lowest'|'typical';setMetric:(m:'lowest'|'typical')=>void}){
 const [rows,setRows]=useState<SeriesData[]|null>(null),[err,setErr]=useState(false);
 const days=Math.max(30,data.days||30),k=keys.join(',');
 useEffect(()=>{if(!k){setRows([]);return;}const sp=new URLSearchParams({c:data.category,days:String(days),keys:k});for(const [a,v] of Object.entries(applied))if(v)sp.set(a,v);const url='/api/stats/series?'+sp;
  let p=seriesCache.get(url);if(!p){p=fetch(url).then(r=>{if(!r.ok)throw Error();return r.json();}).then(j=>j.series as SeriesData[]);p.catch(()=>seriesCache.delete(url));seriesCache.set(url,p);}
  let live=true;setErr(false);p.then(s=>{if(live)setRows(s);}).catch(()=>{if(live)setErr(true);});return()=>{live=false;};},[data.category,days,k,JSON.stringify(applied)]);// eslint-disable-line react-hooks/exhaustive-deps
 const typical=metric==='typical';
 const series:Series[]=(rows??[]).map(s=>({id:s.key,label:s.label,color:Math.max(0,colorOf(s.key)),maxGap:1.6*DAY,points:s.points.filter(p=>!typical||p.typical!=null).map(p=>({t:dayStart(p.day)+12*3600000,p:typical?p.typical!:p.lowest,partial:p.partial,seg:typical?p.segment:0,label:s.label,detail:typical?[p.pairs+' anúncios pareados']:[p.store,p.offers+' anúncios no dia']}))})).filter(s=>s.points.length);
 return <section className="stats-card chart-card">
  <div className="stats-card-head"><h2>Evolução · {days} dias</h2><div className="segmented" role="group" aria-label="Métrica"><button aria-pressed={!typical} className={!typical?'active':''} onClick={()=>setMetric('lowest')}>Menor preço</button><button aria-pressed={typical} className={typical?'active':''} onClick={()=>setMetric('typical')}>Preço típico</button></div></div>
  {err?<p className="muted">Não foi possível carregar o gráfico agora.</p>:!rows?<div className="chart-skeleton" aria-busy="true"/>:!series.length?<p className="forming"><Info size={16} aria-hidden/>Escolha linhas na tabela para ver a evolução.</p>:<Chart series={series} showExtremes={false} daily domain={[dayStart(new Date(Date.now()-(days-1)*DAY-3*3600000).toISOString().slice(0,10))+12*3600000,Date.now()]}/>}
  {series.length>0&&<ul className="chart-legend">{series.map(s=><li key={s.id}><i style={{background:`var(--s${s.color+1})`}}/>{s.label}</li>)}</ul>}
  {rows&&rows.length>0&&<ul className="period-lows">{rows.map(s=>{const l=s.summary.periodLow;return <li key={s.key}><i style={{background:`var(--s${Math.max(0,colorOf(s.key))+1})`}}/><span className="pl-label">{s.label}</span>{l?<a href={'/produto/'+encodeURIComponent(l.offer)} title={l.title}>Menor: <b>{money(l.price)}</b> em {dateBR(l.day)} · {l.store}{!l.live&&<em> (histórico, não disponível agora)</em>}</a>:<span className="muted">sem dias observados</span>}{s.summary.typical&&<Change v={s.summary.typical.change}/>}</li>;})}</ul>}
  <p className="muted small">{typical?'Preço típico: segue os mesmos anúncios de um dia para o outro.':'Menor preço do dia entre as ofertas do grupo; pode cair só porque entrou um anúncio mais barato.'} Dias sem coleta ficam vazios; hoje é parcial.</p>
 </section>;
}
