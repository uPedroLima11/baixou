'use client';
import {useEffect,useMemo,useState} from 'react';
import {Info} from 'lucide-react';
import {money} from '@/lib/types';
import {availablePeriods,dayStart,DAY} from '@/lib/history';
import {Chart,type Series} from './PriceHistory';
type Group={key:string;label:string;tier?:string;offers:number};
type Trend={kind:'forming';availableFrom:string}|{kind:'ready';signals:{tone:string;text:string}[];days:number};
type SeriesData={key:string;label:string;gb:number|null;members:number;live:number;sellers:number;
 points:{day:string;offers:number;lowest:number;store:string;offer:string;median:number;typical:number|null;segment:number;pairs:number;partial:boolean}[];
 summary:{days:number;today:number|null;periodLow:{price:number;day:string;store:string;offer:string}|null;medianLow:number|null;typical:{from:string;to:string;change:number}|null;trend:Trend}};
type Metric='lowest'|'typical'|'gb_lowest'|'gb_typical';
const PREFERRED_GPU=['RTX 4060|8','RTX 5060|8','RTX 5060 Ti|16','RTX 5070|12','RTX 5070 Ti|16','RX 9070 XT|16'];
const pct=(x:number)=>(x>0?'+':x<0?'−':'')+(Math.floor(Math.abs(x)*1000)/10).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const dateBR=(day:string)=>new Date(dayStart(day)).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'America/Sao_Paulo'});
const perGb=(v:number)=>money(v)+'/GB';
const shortLabel=(g:{label:string},cat:string)=>cat==='ram'?g.label.replace(/^DDR\d · /,''):g.label;

export default function StatsEvolution({category,groups,firstDay}:{category:'ram'|'gpu';groups:Group[];firstDay:string|null}){
 const candidates=useMemo(()=>groups.filter(g=>g.offers>=2),[groups]);
 const tiers=useMemo(()=>[...new Set(candidates.map(g=>g.tier??''))].filter(Boolean),[candidates]);
 const defaultTier=useMemo(()=>{const count=(t:string)=>candidates.filter(g=>g.tier===t).reduce((s,g)=>s+g.offers,0);return [...tiers].sort((a,b)=>count(b)-count(a))[0]??'';},[tiers,candidates]);
 const [tier,setTier]=useState(''),[metric,setMetric]=useState<Metric>(category==='ram'?'gb_typical':'lowest'),[days,setDays]=useState(7),[picked,setPicked]=useState<string[]|null>(null),[data,setData]=useState<SeriesData[]|null>(null),[err,setErr]=useState(false);
 const activeTier=tier||defaultTier;
 const gpuDefault=useMemo(()=>{const pref=PREFERRED_GPU.filter(k=>candidates.some(g=>g.key===k));return (pref.length>=3?pref:[...pref,...[...candidates].sort((a,b)=>b.offers-a.offers).map(g=>g.key).filter(k=>!pref.includes(k))]).slice(0,5);},[candidates]);
 // Cor acompanha o grupo (ordem fixa da lista de candidatos), nunca a posição na seleção.
 const keys=category==='ram'?candidates.filter(g=>g.tier===activeTier).sort((a,b)=>b.offers-a.offers).slice(0,6).map(g=>g.key):(picked??gpuDefault);
 const ordered=candidates.filter(g=>keys.includes(g.key)).map(g=>g.key);
 const [slots,setSlots]=useState<Record<string,number>>({});
 const colorOf=(key:string)=>category==='ram'?ordered.indexOf(key):slots[key]??Math.max(0,(picked??gpuDefault).indexOf(key));
 const periods=availablePeriods(firstDay?dayStart(firstDay):null);
 const query=ordered.join(',');
 useEffect(()=>{if(!query)return;let live=true;setErr(false);setData(null);fetch('/api/stats/series?c='+category+'&days='+days+'&keys='+encodeURIComponent(query)).then(r=>{if(!r.ok)throw Error();return r.json();}).then(j=>{if(live)setData(j.series);}).catch(()=>{if(live)setErr(true);});return ()=>{live=false;};},[category,days,query]);
 const isGb=metric.startsWith('gb_'),isTypical=metric.endsWith('typical');
 const series:Series[]=(data??[]).map(s=>({id:s.key,label:shortLabel(s,category),color:colorOf(s.key),maxGap:1.6*DAY,points:s.points.filter(p=>!isTypical||p.typical!=null).map(p=>{const raw=isTypical?p.typical!:p.lowest,v=isGb&&s.gb?raw/s.gb:raw;return {t:dayStart(p.day)+12*3600000,p:v,partial:p.partial,seg:isTypical?p.segment:0,label:shortLabel(s,category),detail:isTypical?[p.pairs?p.pairs+' anúncios comparados com o dia anterior':'Início do trecho: mediana de '+p.offers+' anúncios']:['Menor: '+p.store+(isGb&&s.gb?' · '+money(p.lowest):''),p.offers+' anúncios observados']};})})).filter(s=>s.points.length);
 const toggle=(key:string)=>{const cur=picked??gpuDefault;const base:Record<string,number>={};cur.forEach((k,i)=>base[k]=slots[k]??i);if(cur.includes(key)){setPicked(cur.filter(k=>k!==key));setSlots(base);return;}if(cur.length>=6)return;const used=new Set(cur.map(k=>base[k]));let free=0;while(used.has(free))free++;setSlots({...base,[key]:free});setPicked([...cur,key]);};
 const metrics:[Metric,string][]=category==='ram'?[['gb_typical','Preço típico por GB'],['gb_lowest','Menor R$/GB'],['lowest','Menor preço']]:[['lowest','Menor preço'],['typical','Preço típico']];
 const fmt=isGb?perGb:money,axis=isGb?(v:number)=>'R$ '+v.toLocaleString('pt-BR',{maximumFractionDigits:v<100?1:0}):undefined;
 return <section className="stats-card evolution">
  <div className="stats-card-head"><h2>Evolução dos preços</h2><div className="segmented" role="group" aria-label="Período">{periods.map(p=><button key={p.days} type="button" disabled={!p.enabled} aria-pressed={days===p.days} className={days===p.days?'active':''} title={p.enabled?undefined:'Em construção'} onClick={()=>setDays(p.days)}>{p.label}</button>)}</div></div>
  <div className="evolution-controls">
   {category==='ram'?<div className="segmented" role="group" aria-label="Tipo de memória">{tiers.map(t=><button key={t} type="button" aria-pressed={activeTier===t} className={activeTier===t?'active':''} onClick={()=>setTier(t)}>{t}</button>)}</div>
   :<div className="chip-row" role="group" aria-label="Modelos de GPU">{candidates.map(g=>{const on=keys.includes(g.key);return <button key={g.key} type="button" aria-pressed={on} className={'pick-chip'+(on?' on':'')} onClick={()=>toggle(g.key)}>{on&&<i style={{background:`var(--s${colorOf(g.key)+1})`}}/>}{g.label}</button>;})}</div>}
   <div className="segmented" role="group" aria-label="Métrica">{metrics.map(([m,l])=><button key={m} type="button" aria-pressed={metric===m} className={metric===m?'active':''} onClick={()=>setMetric(m)}>{l}</button>)}</div>
  </div>
  {err?<p className="muted">Não foi possível carregar a evolução agora.</p>:!data?<div className="chart-skeleton" aria-busy="true"/>:!series.length?<p className="forming"><Info size={16} aria-hidden/>Ainda não há dias suficientes para esta seleção.</p>:<Chart series={series} showExtremes={false} daily axis={axis} value={fmt}/>}
  {series.length>0&&<ul className="chart-legend">{series.map(s=><li key={s.id}><i style={{background:`var(--s${s.color+1})`}}/>{s.label}</li>)}</ul>}
  {data&&data.length>0&&<div className="stats-table-wrap"><table className="stats-table"><thead><tr><th>{category==='ram'?'Configuração':'GPU'}</th><th>Hoje</th><th>Menor no período</th><th>Mediana dos menores</th><th>Preço típico</th><th>Dias · lojas</th><th>Leitura</th></tr></thead>
   <tbody>{data.map(s=>{const sm=s.summary,g=isGb&&s.gb?s.gb:1;return <tr key={s.key}><th scope="row"><span className="row-key"><i style={{background:`var(--s${colorOf(s.key)+1})`}}/>{shortLabel(s,category)}</span><small>{s.live} anúncios ativos de {s.members}</small></th>
    <td>{sm.today!=null?<>{fmt(sm.today/g)}<small>parcial</small></>:<span className="muted">—</span>}</td>
    <td>{sm.periodLow?<>{fmt(sm.periodLow.price/g)}<small>{dateBR(sm.periodLow.day)} · {sm.periodLow.store}</small></>:'—'}</td>
    <td>{sm.medianLow!=null?fmt(sm.medianLow/g):'—'}</td>
    <td>{sm.typical?<><span className={'stat-change '+(sm.typical.change<=-0.02?'down':sm.typical.change>=0.02?'up':'')}>{pct(sm.typical.change)}</span><small>{dateBR(sm.typical.from)} → {dateBR(sm.typical.to)}</small></>:<span className="muted">em formação</span>}</td>
    <td>{sm.days} · {s.sellers}</td>
    <td className="reading">{sm.trend.kind==='ready'?sm.trend.signals.slice(0,2).map(x=><span key={x.text} className={x.tone}>{x.text}</span>):<span className="muted">Dados insuficientes ({sm.days} {sm.days===1?'dia':'dias'}); leitura a partir de {dateBR(sm.trend.availableFrom)}</span>}</td></tr>;})}</tbody></table></div>}
  <p className="muted small"><strong>Menor preço</strong>: o menor preço à vista observado no dia entre os anúncios do grupo (pode cair porque entrou um anúncio mais barato — é o que estava à venda). <strong>Preço típico</strong>: começa na mediana dos menores preços diários e segue a variação mediana dos <em>mesmos anúncios</em> de um dia para o outro; produtos novos não o deslocam. Com menos de 3 anúncios comparáveis entre dois dias a linha é interrompida. O dia de hoje é parcial (ponto vazado). {category==='ram'?'Preço por GB divide pela capacidade total do grupo; módulos, kits, notebook e servidor nunca se misturam.':'Cada linha é um modelo exato com a mesma VRAM (Ti, Super e quantidades de memória são grupos diferentes).'}</p>
 </section>;
}
