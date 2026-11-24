'use client';
import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,TrendingDown,TrendingUp,Minus,ExternalLink,Info} from 'lucide-react';
import {money} from '@/lib/types';
import {storeNames} from '@/lib/stores';
import {dayStart} from '@/lib/history';
import {Chart,type Series} from './PriceHistory';
import StatsEvolution from './StatsEvolution';
type Panel={offers:number;median:number|null;down:number;up:number;stable:number};
type Group={key:string;label:string;tier?:string;offers:number;sellers:number;brands:number;low:number;median:number;high:number;perGbLow?:number;perGbMedian?:number;best:{id:string;title:string;store:string;seller:string;url:string;price:number};ids:string[]};
type Move={id:string;title:string;store:string;seller:string;url:string;base:number;last:number;change:number};
type Period={days:number;label:string;all:Panel;groups:Record<string,Panel>;tiers:Record<string,Panel>;top:Move[];rises:Move[]};
type StatsData={category:'ram'|'gpu';generated_at:string;coverage:{offers:number;live:number;grouped:number;stores:number;firstDay:string|null;historyDays:number};groups:Group[];periods:Period[];index:{name:string;offers:number;points:{day:string;value:number|null;offers:number}[]}[];proven:{id:string;title:string;store:string;seller:string;url:string;price:number;median:number;discount:number}[]};
const pct=(x:number|null|undefined)=>x==null?'—':(x>0?'+':x<0?'−':'')+(Math.floor(Math.abs(x)*1000)/10).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const dateBR=(day:string)=>new Date(dayStart(day)).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'});
const seller=(m:{store:string;seller:string})=>m.store==='mercadolivre'?m.seller:storeNames[m.store]??m.store;
function Change({v}:{v:number|null|undefined}){if(v==null)return <span className="muted">—</span>;const cls=v<=-0.02?'down':v>=0.02?'up':'';return <span className={'stat-change '+cls}>{v<=-0.02?<TrendingDown size={14} aria-hidden/>:v>=0.02?<TrendingUp size={14} aria-hidden/>:<Minus size={14} aria-hidden/>}{pct(v)}</span>;}

export default function Stats(){
 const [cat,setCat]=useState<'ram'|'gpu'>('ram'),[data,setData]=useState<Record<string,StatsData>>({}),[err,setErr]=useState(false),[period,setPeriod]=useState(0),[tier,setTier]=useState('');
 useEffect(()=>{try{const q=new URLSearchParams(location.search).get('c');if(q==='gpu'||q==='ram')setCat(q);}catch{}},[]);
 useEffect(()=>{if(data[cat])return;setErr(false);fetch('/api/stats?c='+cat).then(r=>{if(!r.ok)throw Error();return r.json();}).then(j=>setData(d=>({...d,[cat]:j}))).catch(()=>setErr(true));},[cat,data]);
 const d=data[cat],p=d?.periods[Math.min(period,Math.max(0,(d?.periods.length??1)-1))];
 const tiers=useMemo(()=>{const list=[...new Set((d?.groups??[]).map(g=>g.tier??''))].filter(Boolean);return d?.category==='gpu'?list.sort((a,b)=>parseFloat(a)-parseFloat(b)):list;},[d]);
 const rows=(d?.groups??[]).filter(g=>!tier||g.tier===tier);
 const indexSeries:Series[]=(d?.index??[]).map((s,i)=>({id:s.name,label:s.name,color:i,maxGap:1.6*86400000,points:s.points.filter(x=>x.value!=null).map(x=>({t:dayStart(x.day)+12*3600000,p:x.value!}))})).filter(s=>s.points.length);
 const choose=(c:'ram'|'gpu')=>{setCat(c);setTier('');setPeriod(0);try{history.replaceState(null,'','/estatisticas?c='+c);}catch{}};
 const nextDay=d?.coverage.firstDay?dateBR(new Date(dayStart(d.coverage.firstDay)+86400000).toISOString().slice(0,10)):null;
 return <div className="stats-page">
  <header className="stats-header wrap"><a href="/" className="brand" aria-label="Baixou! início"><img src="/logo.png" alt="Baixou!" width="140" height="48"/></a><a href="/" className="back-link"><ArrowLeft size={16}/>Voltar às ofertas</a></header>
  <main className="wrap stats-main">
   <div className="stats-intro"><h1>Estatísticas de preços</h1><p>Como os preços de memórias e placas de vídeo estão se movendo nas lojas monitoradas pelo Baixou!, com produtos equivalentes comparados entre si.</p></div>
   <div className="segmented stats-tabs" role="tablist" aria-label="Categoria"><button role="tab" aria-selected={cat==='ram'} className={cat==='ram'?'active':''} onClick={()=>choose('ram')}>Memória RAM</button><button role="tab" aria-selected={cat==='gpu'} className={cat==='gpu'?'active':''} onClick={()=>choose('gpu')}>Placas de vídeo</button></div>
   {err?<p className="muted">Não foi possível carregar as estatísticas agora. Tente novamente em instantes.</p>:!d?<div className="chart-skeleton" aria-busy="true"/>:<>
    <section className="coverage-strip" aria-label="Cobertura">
     <div><strong>{d.coverage.live}</strong><span>anúncios ativos analisados</span></div>
     <div><strong>{d.coverage.grouped}</strong><span>em grupos equivalentes</span></div>
     <div><strong>{d.coverage.stores}</strong><span>lojas</span></div>
     <div><strong>{d.coverage.firstDay?dateBR(d.coverage.firstDay):'—'}</strong><span>início do histórico ({d.coverage.historyDays} {d.coverage.historyDays===1?'dia':'dias'})</span></div>
    </section>

    <section className="stats-card"><div className="stats-card-head"><h2>Movimento dos preços</h2>{d.periods.length>0&&<div className="segmented" role="group" aria-label="Período">{d.periods.map((x,i)=><button key={x.days} aria-pressed={i===period} className={i===period?'active':''} onClick={()=>setPeriod(i)}>{x.label}</button>)}</div>}</div>
     {p?<><div className="move-grid"><div className="move down"><TrendingDown size={18} aria-hidden/><strong>{p.all.down}</strong><span>caíram 2% ou mais</span></div><div className="move up"><TrendingUp size={18} aria-hidden/><strong>{p.all.up}</strong><span>subiram 2% ou mais</span></div><div className="move"><Minus size={18} aria-hidden/><strong>{p.all.stable}</strong><span>estáveis</span></div><div className="move"><span className="move-big">{pct(p.all.median)}</span><span>variação mediana</span></div></div>
      <p className="muted small">Amostra consistente: {p.all.offers} anúncios observados no início do período e no último dia. Produtos que entraram depois não alteram a comparação.</p></>
     :<p className="forming"><Info size={16} aria-hidden/>Variações em formação. A comparação entre dias começa quando houver pelo menos um dia completo anterior{nextDay?' (a partir de '+nextDay+')':''}; 7, 30 e 90 dias ficam disponíveis conforme o histórico cresce.</p>}
    </section>

    <StatsEvolution key={cat} category={cat} groups={d.groups} firstDay={d.coverage.firstDay}/>

    {indexSeries.some(s=>s.points.length>1)&&<section className="stats-card"><h2>Índice de preços (base 100)</h2><Chart series={indexSeries} showExtremes={false} daily axis={v=>v.toFixed(1)} value={v=>v.toFixed(1)}/>{indexSeries.length>1&&<ul className="chart-legend">{indexSeries.map(s=><li key={s.id}><i style={{background:`var(--s${s.color+1})`}}/>{s.label}</li>)}</ul>}<p className="muted small">Cada dia compara o preço de fechamento de cada anúncio com o do dia anterior (mesmo anúncio) e usa a mediana dessas variações. Novos produtos ou faixas de preço diferentes não deslocam o índice. Dias com menos de 5 anúncios pareados ficam em branco.</p></section>}

    <section className="stats-card"><div className="stats-card-head"><h2>{cat==='ram'?'Preço por configuração':'Preço por GPU'}</h2>{tiers.length>1&&<div className="segmented" role="group" aria-label="Filtro"><button aria-pressed={!tier} className={!tier?'active':''} onClick={()=>setTier('')}>Todas</button>{tiers.map(t=><button key={t} aria-pressed={tier===t} className={tier===t?'active':''} onClick={()=>setTier(t)}>{t}</button>)}</div>}</div>
     <div className="stats-table-wrap"><table className="stats-table"><thead><tr><th>{cat==='ram'?'Configuração':'GPU e VRAM'}</th><th>Anúncios</th><th>{cat==='ram'?'Lojas':'Fabricantes'}</th><th>Menor preço</th><th>Mediana</th>{cat==='ram'?<th>R$/GB (menor · mediana)</th>:<th>Maior</th>}{p&&<th>Variação {p.label}</th>}</tr></thead>
      <tbody>{rows.map(g=><tr key={g.key}><th scope="row">{g.label}{cat==='ram'&&<small>{g.tier}</small>}</th><td>{g.offers}</td><td>{cat==='ram'?g.sellers:g.brands}</td><td><a href={'/produto/'+encodeURIComponent(g.best.id)} title={g.best.title}>{money(g.low)}</a><small>{seller(g.best)}</small></td><td>{money(g.median)}</td>{cat==='ram'?<td>{money(g.perGbLow!)} · {money(g.perGbMedian!)}</td>:<td>{money(g.high)}</td>}{p&&<td>{p.groups[g.key]?.offers?<><Change v={p.groups[g.key].median}/><small>{p.groups[g.key].offers} pareados</small></>:<span className="muted">—</span>}</td>}</tr>)}</tbody></table></div>
     <p className="muted small">{cat==='ram'?'Grupos separam geração, uso (notebook só quando o anúncio indica SODIMM/notebook; memória de servidor ECC/registrada à parte; os demais ficam como desktop), capacidade total e divisão do kit: um módulo de 16 GB nunca é comparado com um kit 2×8 GB. Kits sem divisão informada ficam de fora.':'Grupos separam o modelo exato da GPU (RTX 5070 ≠ RTX 5070 Ti) e a quantidade de VRAM. Anúncios sem modelo ou VRAM identificados ficam de fora. "Fabricantes" é o número de marcas de placa no grupo.'} Retrato atual só com preço à vista/Pix e ofertas verificadas dentro do prazo de validade. Mediana é o preço do meio entre os anúncios do grupo.</p>
    </section>

    {p&&(p.top.length>0||p.rises.length>0)&&<section className="stats-card two-col"><div><h2>Maiores quedas observadas ({p.label})</h2>{p.top.length?<ol className="move-list">{p.top.map(m=><li key={m.id}><a href={'/produto/'+encodeURIComponent(m.id)}>{m.title}</a><span>{seller(m)} · {money(m.base)} → <strong>{money(m.last)}</strong> <Change v={m.change}/></span></li>)}</ol>:<p className="muted">Nenhuma queda de 2% ou mais no período.</p>}</div>
     <div><h2>Maiores altas ({p.label})</h2>{p.rises.length?<ol className="move-list">{p.rises.map(m=><li key={m.id}><a href={'/produto/'+encodeURIComponent(m.id)}>{m.title}</a><span>{seller(m)} · {money(m.base)} → <strong>{money(m.last)}</strong> <Change v={m.change}/></span></li>)}</ol>:<p className="muted">Nenhuma alta de 2% ou mais no período.</p>}</div></section>}

    <section className="stats-card"><h2>Quedas comprovadas pelo histórico</h2>{d.proven.length?<ol className="move-list">{d.proven.map(m=><li key={m.id}><a href={'/produto/'+encodeURIComponent(m.id)}>{m.title}</a><span>{seller(m)} · mediana {money(m.median)} → <strong>{money(m.price)}</strong> <span className="stat-change down">−{m.discount}%</span></span></li>)}</ol>:<p className="muted">Ainda nenhuma. A queda comprovada exige ao menos 5 observações em 3 dias diferentes e preço atual abaixo da mediana do próprio anúncio.</p>}</section>

    <section className="stats-card method"><h2>Como calculamos</h2><ul>
     <li>Os números usam apenas preços verificados pelo Baixou! nas lojas monitoradas. Preço riscado ("de") nunca entra no histórico nem nas estatísticas.</li>
     <li>A variação de um período compara o mesmo anúncio consigo mesmo, no início e no fim do período. Queda ou alta só conta a partir de 2%.</li>
     <li>O histórico começou em {d.coverage.firstDay?dateBR(d.coverage.firstDay):'—'}. Períodos mais longos e tendências aparecem à medida que os dias são observados; nada anterior à primeira coleta é estimado.</li>
     <li>Cobertura parcial: há outras lojas e vendedores fora do monitoramento. Não há previsão de preço: com poucos dias de histórico, qualquer probabilidade de queda seria inventada.</li>
    </ul><small className="muted">Atualizado em {new Date(d.generated_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}.</small></section>
   </>}
  </main>
 </div>;
}
