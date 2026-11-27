'use client';
import {useEffect,useState} from 'react';import {useRouter} from 'next/navigation';import {ArrowLeft,Sun,Moon} from 'lucide-react';import type {User} from '@supabase/supabase-js';
import ProductDetail from './ProductDetail';import {getSupabase,localUser} from '@/lib/supabase-browser';import {sameProduct} from '@/lib/search';
import type {ProductData} from '@/lib/product-data';import type {Offer} from '@/lib/types';
// Página própria do produto (URL compartilhável). "Voltar": se veio do catálogo nesta aba, volta no histórico — o
// catálogo restaura busca, filtros, ordem, modalidade, itens carregados e rolagem (estado na URL + memória da sessão);
// se o link foi aberto diretamente, leva ao catálogo.
export default function ProductPage({data:initial}:{data:ProductData}){
 const router=useRouter(),[data,setData]=useState(initial),o=data.offer;
 // Forma de pagamento: ?pag=cartao ou preferência salva. Cartão busca a mesma página projetada no cartão.
 const choose=async(pay:'pix'|'card')=>{try{localStorage.setItem('baixou-payment',pay);}catch{}if(pay==='pix'){setData(initial);return;}const r=await fetch('/api/product?id='+encodeURIComponent(initial.offer.id)+'&pag=cartao').catch(()=>null);const d=r?.ok?await r.json():null;if(d?.offer)setData(d);if(d?.cardMissing)setToast('Esta loja não informou o total no cartão; mostrando o preço no Pix.');};
 useEffect(()=>{let pref:string|null=null;try{pref=new URLSearchParams(location.search).get('pag')==='cartao'?'card':localStorage.getItem('baixou-payment');}catch{}if(pref==='card')choose('card');// eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 const [user,setUser]=useState<User|null>(null),[savedId,setSavedId]=useState<string|null>(null),[toast,setToast]=useState(''),[theme,setTheme]=useState('light');
 useEffect(()=>{setTheme(document.documentElement.dataset.theme||'light');const cached=localUser();if(cached)setUser(cached);let live=true;void getSupabase().then(db=>db?.auth.getUser()).then(r=>{if(live&&r)setUser(r.data.user);}).catch(()=>{});return()=>{live=false};},[]);
 useEffect(()=>{if(!user){setSavedId(null);return;}getSupabase().then(db=>db!.from('wishlist').select('offer_id,offers(*)').eq('user_id',user.id)).then(({data:rows})=>{const hit=(rows??[]).find(r=>r.offer_id===o.id||(r.offers&&sameProduct(r.offers as unknown as Offer,o)));setSavedId(hit?.offer_id??null);});},[user,o]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),4000);return()=>clearTimeout(t);},[toast]);
 const back=()=>{if(sessionStorage.getItem('baixou-from-catalog')===o.id&&history.length>1){sessionStorage.removeItem('baixou-from-catalog');router.back();}else router.push('/');};
 const save=async()=>{if(!user){router.push('/?conta=perfil');return;}const db=(await getSupabase())!;const {error}=savedId?await db.from('wishlist').delete().eq('user_id',user.id).eq('offer_id',savedId):await db.from('wishlist').insert({user_id:user.id,offer_id:o.id});if(error){setToast('Não foi possível salvar. Tente novamente.');return;}setSavedId(savedId?null:o.id);setToast(savedId?'Removido dos favoritos.':'Salvo na sua lista de desejos.');};
 return <>
  <header className="product-top"><div className="wrap product-top-inner"><button className="back-button" onClick={back}><ArrowLeft size={18}/>Voltar</button><a href="/" className="brand" aria-label="Baixou! início"><img src="/logo.png" alt="Baixou!" width="120" height="41"/></a><button className="icon" onClick={()=>{const next=theme==='dark'?'light':'dark';setTheme(next);document.documentElement.dataset.theme=next;localStorage.setItem('baixou-theme',next);}} aria-label={theme==='dark'?'Ativar modo claro':'Ativar modo escuro'}>{theme==='dark'?<Sun/>:<Moon/>}</button></div></header>
  <main className="wrap product-page"><ProductDetail key={(data.payment??'pix')+(data.partial?'p':'')} onPayment={choose} offer={o} preloaded={data} saved={!!savedId} save={save} alert={()=>router.push('/?conta=notificacoes')}/></main>
  {toast&&<div className="toast" role="status">{toast}</div>}
 </>;
}
