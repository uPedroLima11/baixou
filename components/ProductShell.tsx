import {ArrowLeft,ImageIcon} from 'lucide-react';
import {money,type Offer} from '@/lib/types';import StoreBadge from './StoreBadge';
// Casca da página do produto com o que o card já tinha (foto, loja, título, preço). Usada no instante do clique
// (sobre o catálogo, antes da navegação terminar) e como tela de carregamento da rota.
export default function ProductShell({p,overlay=false}:{p:Pick<Offer,'title'|'image'|'price'|'store'|'seller'|'verification_status'>|null;overlay?:boolean}){
 return <div className={overlay?'opening-shell':undefined} aria-busy="true"><header className="product-top"><div className="wrap product-top-inner"><span className="back-button"><ArrowLeft size={18}/>Voltar</span><span className="brand"><img src="/logo.png" alt="Baixou!" width="120" height="41"/></span><span className="icon"/></div></header>
  <main className="wrap product-page"><div className="product-detail"><div className="gallery"><div className="main-photo">{p?.image?<img src={p.image} alt=""/>:<ImageIcon size={80}/>}</div><div className="side-card"><div className="spark-skeleton"/></div></div>
   <div className="detail-info">{p&&<StoreBadge offer={p} detail/>}{p?<h1>{p.title}</h1>:<div className="line-skeleton wide"/>}<div className="detail-price">{p?<strong>{money(Number(p.price))}</strong>:<div className="line-skeleton"/>}</div><div className="verdict skeleton-block"/></div></div></main></div>;
}
