'use client';
import {useParams} from 'next/navigation';import {ArrowLeft,ImageIcon} from 'lucide-react';
import {pendingProduct} from '@/lib/pending-product';import {money} from '@/lib/types';import StoreBadge from '@/components/StoreBadge';
// Abertura instantânea: mostra o que o card já tinha (foto, título, loja, preço) enquanto a página completa carrega.
export default function Loading(){
 const {id}=useParams<{id:string}>(),p=pendingProduct(decodeURIComponent(String(id??'')));
 return <><header className="product-top"><div className="wrap product-top-inner"><span className="back-button"><ArrowLeft size={18}/>Voltar</span><span className="brand"><img src="/logo.png" alt="Baixou!" width="120" height="41"/></span><span className="icon"/></div></header>
  <main className="wrap product-page" aria-busy="true"><div className="product-detail"><div className="gallery"><div className="main-photo">{p?.image?<img src={p.image} alt=""/>:<ImageIcon size={80}/>}</div><div className="side-card"><div className="spark-skeleton"/></div></div>
   <div className="detail-info">{p&&<StoreBadge offer={p} detail/>}{p?<h1>{p.title}</h1>:<div className="line-skeleton wide"/>}<div className="detail-price">{p?<strong>{money(Number(p.price))}</strong>:<div className="line-skeleton"/>}</div><div className="verdict skeleton-block"/></div></div></main></>;
}
