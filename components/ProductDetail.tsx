'use client';
import ProductImage from './ProductImage';
import {PaymentTable,paymentLabel} from './PaymentPrices';import {useEffect,useMemo,useRef,useState} from 'react';import {Heart,Bell,Clock,ExternalLink,Info,ChevronDown,History,ListChecks,Store,Layers,TrendingDown} from 'lucide-react';import {discountReference} from '@/lib/market';import {storeNames} from '@/lib/stores';import {offerStateLabel} from '@/lib/wishlist';import {money,type Offer} from '@/lib/types';import {getSupabase} from '@/lib/supabase-browser';import PriceHistory from './PriceHistory';import StoreBadge from './StoreBadge';import type {ProductData} from '@/lib/product-data';import {fetchHistory,type HistorySeries} from '@/lib/history-client';
import type {BaixouScore} from '@/lib/score';
const age=(date:string)=>{const n=Math.max(0,Math.floor((Date.now()-Date.parse(date))/60000));return n<1?'agora':n<60?n+' min':Math.floor(n/60)+' h'+(n%60?' '+n%60+' min':'');};
const pct=(x:number)=>Math.abs(x*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const vs=(price:number,ref:number)=>Math.abs(price/ref-1)<0.03?'em linha':price<ref?pct(1-price/ref)+' abaixo':pct(price/ref-1)+' acima';
type Tab='specs'|'history'|'reviews'|'alert';
export default function ProductDetail({offer:o,saved,save,alert,alternatives:altProp=[],comparison:cmpProp,preloaded,onPayment}:{onPayment?:(p:'pix'|'card')=>void;alternatives?:Offer[];comparison?:Offer[];offer:Offer;saved:boolean;save:()=>void;alert:()=>void;preloaded?:ProductData}){
 const [extra,setExtra]=useState<{comparison?:Offer[]|null;alternatives?:Offer[];score?:BaixouScore}>(preloaded&&!preloaded.partial?{comparison:preloaded.comparison,alternatives:preloaded.alternatives,score:preloaded.score}:{});
 const comparison=extra.comparison===undefined?cmpProp:extra.comparison??undefined,alternatives=extra.alternatives??altProp;
 const [image,setImage]=useState(o.image),[tab,setTab]=useState<Tab>('specs'),[opened,setOpened]=useState<Set<Tab>>(()=>new Set(['specs'])),[target,setTarget]=useState(''),[message,setMessage]=useState('');
 const [specs,setSpecs]=useState(preloaded?.offer.specs??o.specs),[gallery,setGallery]=useState<string[]>(preloaded?.offer.images??o.images??(o.image?[o.image]:[])),[related,setRelated]=useState<{store:string;specs:Record<string,string>}|null>(preloaded?.related_specs??null);
 const tabsRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(preloaded?.offer.id===o.id&&!preloaded.partial)return;
  // Dados completos (galeria, ficha, comparação e Score com alternativas) quando não vieram prontos do servidor.
  let live=true;fetch('/api/product?id='+encodeURIComponent(o.id)).then(r=>r.json()).then(d=>{if(!live||!d?.offer)return;if(d.offer.specs)setSpecs(d.offer.specs);if(Array.isArray(d.offer.images))setGallery(d.offer.images);setRelated(d.related_specs??null);setExtra({comparison:d.comparison??null,alternatives:Array.isArray(d.alternatives)?d.alternatives:undefined,score:d.score??undefined});}).catch(()=>{});return()=>{live=false;};},[o.id,preloaded]);
 // Histórico pré-carregado (mesma consulta da aba): resumo imediato e aba sem espera.
 const peers=useMemo(()=>[o,...(comparison??[]).filter(x=>x.id!==o.id)].slice(0,8),[o,comparison]);
 const [hist,setHist]=useState<HistorySeries|null>(null);
 useEffect(()=>{let live=true;fetchHistory(peers.map(p=>p.id),o.payment_basis==='card'?'card':'pix').then(j=>{if(live)setHist(j.series.find(s=>s.id===o.id)??null);}).catch(()=>{});return()=>{live=false;};},[peers,o.id]);
 const choose=(t:Tab,scroll=false)=>{setTab(t);setOpened(s=>s.has(t)?s:new Set([...s,t]));if(scroll)tabsRef.current?.scrollIntoView({behavior:'smooth',block:'start'});};
 const valid=o.available&&Date.parse(o.expires_at)>Date.now(),reference=discountReference(o),b=extra.score??null;
 const {main:specRows,long:longSpecs}=useMemo(()=>splitSpecs(specs),[specs]);
 return <><div className="product-detail">
  <div className="gallery"><div className="main-photo"><ProductImage src={image} alt={o.title} width={600} height={340} priority/></div>{gallery.length>1&&<div className="thumbnails">{gallery.map((src,i)=><button key={src} className={image===src?'active':''} aria-label={'Imagem '+(i+1)} onClick={()=>setImage(src)}><ProductImage src={src} width={56} height={56}/></button>)}</div>}
   <HistorySummary o={o} s={hist} valid={valid} onOpen={()=>choose('history',true)}/>
   {specRows.length>0&&<section className="side-card"><h3><ListChecks size={15}/>Principais especificações</h3><dl className="key-specs">{specRows.slice(0,6).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>{specRows.length>6&&<button type="button" className="link-button" onClick={()=>choose('specs',true)}>Ver todas ({specRows.length})</button>}</section>}
  </div>
  <div className="detail-info"><StoreBadge offer={o} detail/><h1>{o.title}</h1><span className="detail-model">{o.brand} {o.mpn&&'· '+o.mpn}</span><div className="rating">{o.rating!=null?<><span>★</span>{o.rating}<small>{o.review_count??0} avaliações na loja</small></>:<small>Sem avaliações informadas</small>}{o.sold!==null&&<small> · {o.sold} vendidos</small>}</div>
   <div className="detail-price">{reference&&<small>{reference.label}: {money(reference.amount)}</small>}<strong>{valid?money(o.price):offerStateLabel(o)}</strong>{valid&&<span>{paymentLabel(o)}</span>}</div>{valid&&<PaymentTable o={o} onChoose={onPayment}/>}
   {o.coupon_hint&&<p className="coupon-hint">Cupom sugerido: <strong>{o.coupon_hint}</strong>. Ainda não validado; o preço exibido não inclui esse cupom.</p>}
   {/* Sem a nota do servidor (com alternativas equivalentes) ainda: esqueleto, nunca uma nota calculada de outro jeito. */}
   {b?<Verdict o={o} b={b} comparison={comparison} valid={valid}/>:<div className="verdict skeleton-block" aria-busy="true"/>}
   {valid?<a className="primary store-cta" href={o.url} target="_blank" rel="noopener noreferrer">Ir para loja<ExternalLink size={17}/></a>:<div className="stock-ended">{offerStateLabel(o)}. O produto e seus alertas continuam salvos.</div>}
   <div className="detail-actions"><button className="secondary" onClick={save}><Heart size={17} fill={saved?'currentColor':'none'}/>{saved?'Salvo':'Lista de desejos'}</button><button className="secondary" onClick={()=>choose('alert',true)}><Bell size={17}/>Criar alerta</button></div>
   {o.verification_status==='announced'?<small className="checked announced"><Clock size={13}/>Anunciado pela loja no Telegram há <span suppressHydrationWarning>{age(o.checked_at)}</span>. {o.payment_note}</small>:<small className="checked"><Clock size={13}/>Verificado há <span suppressHydrationWarning>{age(o.checked_at)}</span>. Frete e condições de pagamento na loja.</small>}
   {o.original_price&&<details className="announced-reference"><summary>Referência anunciada pelo vendedor</summary><p>A loja informa {money(o.original_price)} como referência. Esse valor não comprova preço normal de mercado nem queda real.</p>{Number(o.historical_max)>0&&<p>Nos {o.historical_days} dias monitorados ({o.historical_samples} verificações), o maior preço observado nesta loja foi {money(Number(o.historical_max))}{Number(o.historical_max)<Number(o.original_price)?'; a referência anunciada não foi praticada nesse período':''}.</p>}</details>}
   <button className="quiet" onClick={()=>{navigator.clipboard?.writeText(location.origin+'/produto/'+o.id);setMessage('Link copiado.')}}>Copiar link da oferta</button><small role="status">{message}</small>
  </div></div>
  {comparison&&comparison.length>1?<section className="comparison"><h3><Store size={16}/>Mesmo modelo em {comparison.length} lojas monitoradas</h3><p className="muted">Mesmo código do fabricante e mesma variante. Cobertura parcial: só as lojas monitoradas.</p><table className="compare-table"><thead><tr><th scope="col">Loja</th><th scope="col">Preço</th><th scope="col">Pagamento</th><th scope="col"><span className="sr-only">Link</span></th></tr></thead><tbody>{comparison.map((a,i)=><tr key={a.id} className={a.id===o.id?'current':''}><td><StoreBadge offer={a}/>{a.id===o.id&&<small>Anúncio aberto</small>}</td><td><strong>{money(Number(a.price))}</strong>{i>0&&<small>+{money(Number(a.price)-Number(comparison[0].price))}</small>}</td><td>{a.verification_status==='announced'?<>À vista<small>anunciado pela loja, não conferido</small></>:a.store!=='mercadolivre'||a.payment_basis==='cash'?'Pix/à vista':'Condições na loja'}</td><td><a href={a.url} target="_blank" rel="noopener noreferrer">Ir para loja</a></td></tr>)}</tbody></table></section>
  :alternatives.length>0&&<section className="comparison"><h3><Store size={16}/>O mesmo modelo em outras lojas</h3>{alternatives.map(a=><a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"><span>{a.seller}</span><strong>{money(a.price)}</strong><span>Ir para loja</span></a>)}</section>}
  {!!o.discoveries?.length&&<p className="muted">Descoberto por {o.discoveries.map(d=><a key={d.source} href={d.url} target="_blank" rel="noopener noreferrer">{d.name} </a>)}</p>}
  <div className="tabs detail-tabs" ref={tabsRef} role="tablist">{([['specs','Especificações'],['history','Histórico de preços'],['reviews','Avaliações'],['alert','Alerta deste produto']] as [Tab,string][]).map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?'active':''} onClick={()=>choose(id)} onPointerEnter={()=>{if(id==='history')setOpened(s=>s.has('history')?s:new Set([...s,'history']));}}>{label}</button>)}</div>
  {/* Abas já abertas ficam montadas (só escondidas): voltar a uma aba é instantâneo e o gráfico não recarrega. */}
  <div className="tab-panel" hidden={tab!=='specs'}>{specRows.length||longSpecs.length?<><dl className="spec-grid">{specRows.map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>{longSpecs.map(([k,v])=><details key={k} className="spec-long"><summary>{k}<ChevronDown size={15}/></summary><p>{v}</p></details>)}</>:<p className="muted">Especificações completas disponíveis na página da loja.</p>}
   {related&&<><p className="muted related-source">Ficha técnica do mesmo modelo exato (mesmo código do fabricante) informada por {storeNames[related.store]??related.store}. Confira a página da loja antes de comprar.</p><dl className="spec-grid">{splitSpecs(related.specs).main.map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></>}</div>
  {opened.has('history')&&<div className="tab-panel history-content" hidden={tab!=='history'}><PriceHistory offer={o} comparison={comparison}/></div>}
  <div className="tab-panel" hidden={tab!=='reviews'}><div className="review-summary"><span className="review-score">{o.rating??'—'}<small>/5</small></span><p>{o.review_count?o.review_count+' avaliações informadas pela loja.':'A loja não informou avaliações.'}<br/><small>Os comentários completos podem ser consultados na origem.</small></p><a href={o.url} target="_blank" rel="noopener noreferrer">Ver avaliações na loja</a></div></div>
  <div className="tab-panel" hidden={tab!=='alert'}><form className="form-stack product-alert" onSubmit={async e=>{e.preventDefault();const db=await getSupabase();const session=await db?.auth.getUser();if(!session?.data.user){alert();return;}const {error}=await db!.from('alerts').insert({user_id:session.data.user.id,category:o.category,offer_id:o.id,max_price:Number(target),min_discount:null,enabled:true,payment:o.payment_basis==='card'?'card':'any'});setMessage(error?'Não foi possível salvar o alerta.':'Alerta salvo. Ative o recebimento de e-mails nas configurações.');}}><label>Avise quando este produto estiver abaixo de R$ {o.payment_basis==='card'?'(total no cartão)':'(no Pix ou no cartão)'}<input required min={1} type="number" value={target} onChange={e=>setTarget(e.target.value)} placeholder={String(Math.floor(o.price*0.9))}/></label><button className="primary"><Bell size={17}/>Salvar alerta</button><small className="muted">Este alerta vale para o mesmo produto em qualquer loja monitorada. Se você também tiver um alerta de categoria que cubra este produto, os limites dele valem para os avisos da lista de desejos.</small><small role="status">{message}</small></form></div>
 </>;}

// Veredito: em poucos segundos — é boa compra? por quê? comparado a quê? quão confiável? Detalhes ficam recolhidos.
function Verdict({o,b,comparison,valid}:{o:Offer;b:BaixouScore;comparison?:Offer[];valid:boolean}){
 if(!valid||o.verification_status==='announced')return <div className={'verdict '+b.klass}><div className="verdict-head"><span className="score-value empty">—</span><span><strong>{b.label}</strong><small>{b.reasons[0]}</small></span></div></div>;
 const ref=Number(o.reference_median),refOk=ref>0&&Number(o.reference_days??0)>=3,g=b.refs?.group,m=b.refs?.market,max=Number(o.reference_max);
 const rows:[typeof History,string,string,string][]=[
  [History,'Preço habitual deste anúncio',refOk?money(ref):'Em formação',refOk?vs(o.price,ref)+' · '+o.reference_days+' dias':'mín. 3 dias completos'],
  [Store,'Mesmo modelo, outras lojas',m?money(m.median):comparison&&comparison.length>1?comparison.length+' lojas':'Não encontrado',m?vs(o.price,m.median)+' · '+m.stores+' lojas':comparison&&comparison.length>1?'amostra insuficiente':'nas lojas monitoradas'],
  [Layers,'Alternativas equivalentes',g?money(g.median):'—',g?vs(o.price,g.median)+' · '+g.offers+' ofertas':'sem amostra suficiente'],
 ];
 return <div className={'verdict '+b.klass}>
  <div className="verdict-head">{b.score!==null?<span className="score-value" aria-label={'Baixou Score '+b.score+' de 100'}>{b.score}</span>:<span className="score-value empty">—</span>}<span><strong>{b.label}</strong><small>{b.score!==null?<>Baixou Score · <span className={'confidence '+(b.confidence==='alta'?'high':'mid')}>confiança {b.confidence}</span></>:'Ainda sem base para avaliar'}</small></span></div>
  <ul className="verdict-rows">{rows.map(([Icon,label,value,note])=><li key={label}><Icon size={15}/><span>{label}</span><b>{value}</b><small>{note}</small></li>)}</ul>
  {max>o.price*1.03&&<p className="verdict-note"><TrendingDown size={14}/>Já esteve {money(max)} nos dias monitorados — registro histórico, não o preço habitual.</p>}
  <details className="verdict-more"><summary><Info size={14}/>Como chegamos a isso</summary><ul>{b.reasons.map(r=><li key={r}>{r}</li>)}</ul><p className="muted">Nota de 0 a 100 do preço de agora (50 = preço habitual). Preço habitual = mediana dos menores preços de cada dia anterior a hoje; cada dia conta uma vez. O mesmo modelo em outras lojas define a oportunidade; alternativas equivalentes (não são o mesmo modelo) só freiam a nota. Preço riscado da loja não entra. Cobertura parcial das lojas.</p></details>
 </div>;
}
// Resumo do histórico ao lado da foto: menor/maior/atual em 30 dias e dias monitorados; sem histórico, diz isso.
function HistorySummary({o,s,valid,onOpen}:{o:Offer;s:HistorySeries|null;valid:boolean;onOpen:()=>void}){
 if(o.verification_status==='announced')return null;
 const days=(s?.daily??[]).filter(d=>Date.parse(d[0]+'T12:00:00Z')>Date.now()-30*86400000);
 if(!s)return <section className="side-card"><h3><History size={15}/>Histórico de preços</h3><div className="spark-skeleton" aria-busy="true"/></section>;
 if(!days.length)return <section className="side-card"><h3><History size={15}/>Histórico de preços</h3><p className="muted">Ainda sem dias completos observados para este anúncio.</p></section>;
 const mins=days.map(d=>d[1]),lo=Math.min(...mins,valid?o.price:Infinity),hi=Math.max(...days.map(d=>d[2])),W=260,H=56,t0=Date.now()-29*86400000,span=29*86400000;
 const x=(day:string)=>Math.max(0,Math.min(W,(Date.parse(day+'T12:00:00Z')-t0)/span*W)),y=(p:number)=>hi===lo?H/2:4+(1-(p-lo)/(hi-lo))*(H-8);
 const pts=days.map(d=>[x(d[0]),y(d[1])]);
 return <section className="side-card"><h3><History size={15}/>Histórico de preços · 30 dias</h3>
  <svg viewBox={`0 0 ${W} ${H}`} className="sparkline" role="img" aria-label={'Menor preço diário: de '+money(lo)+' a '+money(hi)}><polyline points={pts.map(p=>p.join(',')).join(' ')} fill="none"/>{pts.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r={2.2}/>)}</svg>
  <dl className="mini-stats"><div><dt>Atual</dt><dd>{valid?money(o.price):'—'}</dd></div><div><dt>Menor</dt><dd>{money(lo)}</dd></div><div><dt>Maior</dt><dd>{money(hi)}</dd></div></dl>
  <p className="muted small">{days.length} {days.length===1?'dia monitorado':'dias monitorados'} desde {new Date(days[0][0]+'T12:00:00Z').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}{days.length<7?' · histórico curto':''}. <button type="button" className="link-button" onClick={onOpen}>Ver gráfico completo</button></p>
 </section>;
}
// Ficha técnica escaneável: atributos curtos em grade (prioridade para os que mais pesam na compra); textos longos
// (descrição do fabricante etc.) ficam recolhidos, com o conteúdo completo disponível ao expandir.
const PRIORITY=[/^marca/i,/^modelo|part number|c[oó]digo/i,/soquete|socket/i,/n[uú]cleos|cores/i,/threads/i,/clock|frequ[eê]ncia|velocidade/i,/cache/i,/tdp|consumo|pot[eê]ncia/i,/mem[oó]ria/i,/capacidade/i,/lat[eê]ncia|cas/i,/interface|barramento/i,/chipset/i,/resolu[cç][aã]o|tela|tamanho/i,/garantia/i];
export function splitSpecs(specs:Record<string,string>|null|undefined){
 const rows=Object.entries(specs??{}).map(([k,v])=>[k.trim(),String(v).trim()] as [string,string]).filter(([k,v])=>k&&v);
 const long=rows.filter(([k,v])=>v.length>140||/descri[cç][aã]o|caracter[ií]sticas gerais|sobre o produto/i.test(k)&&v.length>60);
 const rank=(k:string)=>{const i=PRIORITY.findIndex(re=>re.test(k));return i<0?PRIORITY.length:i;};
 const main=rows.filter(r=>!long.includes(r)).sort((a,b)=>rank(a[0])-rank(b[0]));
 return {main,long};
}
