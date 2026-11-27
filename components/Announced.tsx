'use client';
import ProductImage from './ProductImage';

import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ExternalLink,Megaphone,Info} from 'lucide-react';
import {money,categories} from '@/lib/types';
import {storeNames} from '@/lib/stores';
import type {AnnouncedItem as Item,AnnouncedResult} from '@/lib/announced';
const ago=(iso:string)=>{const m=Math.max(0,Math.floor((Date.now()-Date.parse(iso))/60000));return m<60?m+' min':m<1440?Math.floor(m/60)+' h'+(m%60?' '+m%60+' min':''):Math.floor(m/1440)+' d '+Math.floor(m%1440/60)+' h';};
const when=(iso:string)=>new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'});
const postLink=(source:string|null)=>source?.match(/t\.me\/[\w/]+/)?.[0]??null;
export default function Announced({initial}:{initial?:AnnouncedResult|null}){
 const [items,setItems]=useState<Item[]|null>(initial?.offers??null),[err,setErr]=useState(false),[store,setStore]=useState(''),[cat,setCat]=useState(''),[hours,setHours]=useState(48);
 // HTML recente (<2 min) não precisa de nova consulta; mais velho, a lista exibida continua e é trocada ao chegar a nova.
 useEffect(()=>{if(initial&&Date.now()-Date.parse(initial.generated_at)<120000)return;fetch('/api/announced?hours=48').then(r=>{if(!r.ok)throw Error();return r.json();}).then(j=>setItems(j.offers)).catch(()=>{if(!initial)setErr(true);});},[initial]);
 const list=useMemo(()=>(items??[]).filter(i=>(!store||i.store===store)&&(!cat||i.category===cat)&&Date.parse(i.posted_at)>=Date.now()-hours*3600000),[items,store,cat,hours]);
 const stores=[...new Set((items??[]).map(i=>i.store))],cats=categories.filter(([id])=>id!=='all'&&(items??[]).some(i=>i.category===id));
 return <div className="stats-page">
  <header className="stats-header wrap"><a href="/" className="brand" aria-label="Baixou! início"><img src="/logo.png" alt="Baixou!" width="140" height="48"/></a><a href="/" className="back-link"><ArrowLeft size={16}/>Voltar às ofertas</a></header>
  <main className="wrap stats-main">
   <div className="stats-intro"><h1>Ofertas divulgadas recentemente</h1><p>Produtos e preços publicados pelas próprias lojas nos canais do Telegram. São anúncios das lojas: o Baixou! não conseguiu conferir a página do produto, então preço e estoque podem ter mudado depois da publicação.</p></div>
   <p className="forming"><Info size={16} aria-hidden/>Disponibilidade não confirmada. Publicações com até 6 h também aparecem no catálogo como “preço anunciado pela loja”; as mais antigas ficam só aqui, por até 48 h. Confira na loja antes de comprar.</p>
   <div className="evolution-controls">
    <div className="segmented" role="group" aria-label="Loja"><button aria-pressed={!store} className={!store?'active':''} onClick={()=>setStore('')}>Todas as lojas</button>{stores.map(s=><button key={s} aria-pressed={store===s} className={store===s?'active':''} onClick={()=>setStore(s)}>{storeNames[s]??s}</button>)}</div>
    <div className="segmented" role="group" aria-label="Período">{[6,24,48].map(h=><button key={h} aria-pressed={hours===h} className={hours===h?'active':''} onClick={()=>setHours(h)}>Últimas {h} h</button>)}</div>
   </div>
   {cats.length>1&&<div className="chip-row" role="group" aria-label="Categoria"><button className={'pick-chip'+(!cat?' on':'')} aria-pressed={!cat} onClick={()=>setCat('')}>Todas</button>{cats.map(([id,label])=><button key={id} className={'pick-chip'+(cat===id?' on':'')} aria-pressed={cat===id} onClick={()=>setCat(id)}>{label}</button>)}</div>}
   {err?<p className="muted">Não foi possível carregar as publicações agora.</p>:!items?<div className="chart-skeleton" aria-busy="true"/>:<>
    <p className="muted small">{list.length} publicaç{list.length===1?'ão':'ões'} {store?'da '+(storeNames[store]??store):'das lojas'} nas últimas {hours} h.</p>
    <ul className="announced-list">{list.map(i=><li key={i.id} className="announced-item">
     <div className="announced-photo"><ProductImage src={i.image} width={110} height={110}/></div>
     <div className="announced-body">
      <span className="store-badge"><Megaphone size={14}/>{storeNames[i.store]??i.store} · publicado {when(i.posted_at)} (há {ago(i.posted_at)})</span>
      <a className="announced-title-link" href={'/produto/'+encodeURIComponent(i.id)}>{i.title}</a>
      <div className="announced-price"><strong>{money(i.price)}</strong><span>à vista, preço anunciado</span></div>
      <small className="muted">{Date.parse(i.expires_at)>Date.now()?'Também no catálogo (publicação com menos de 6 h).':'Fora do catálogo: publicação com mais de 6 h.'} Disponibilidade não confirmada.{i.brand&&i.mpn?' Modelo: '+i.brand+' '+i.mpn+'.':''}</small>
      <div className="announced-actions"><a className="primary" href={i.url} target="_blank" rel="noopener noreferrer">Consultar na loja<ExternalLink size={15}/></a>{postLink(i.source)&&<a className="link-button" href={'https://'+postLink(i.source)} target="_blank" rel="noopener noreferrer">Ver publicação</a>}</div>
     </div></li>)}</ul></>}
  </main>
 </div>;
}
