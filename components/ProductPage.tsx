'use client';
import {useEffect,useState} from 'react';import {useRouter} from 'next/navigation';import {ArrowLeft,Sun,Moon} from 'lucide-react';import type {User} from '@supabase/supabase-js';
import ProductDetail from './ProductDetail';import {supabase} from '@/lib/supabase';import {sameProduct} from '@/lib/search';
import type {ProductData} from '@/lib/product-data';import type {Offer} from '@/lib/types';
// Página própria do produto (URL compartilhável). "Voltar": se veio do catálogo nesta aba, volta no histórico — o
// catálogo restaura busca, filtros, ordem, modalidade, itens carregados e rolagem (estado na URL + memória da sessão);
// se o link foi aberto diretamente, leva ao catálogo.
export default function ProductPage({data}:{data:ProductData}){
 const router=useRouter(),o=data.offer;
 const [user,setUser]=useState<User|null>(null),[savedId,setSavedId]=useState<string|null>(null),[toast,setToast]=useState(''),[theme,setTheme]=useState('light');
 useEffect(()=>{setTheme(document.documentElement.dataset.theme||'light');const db=supabase();if(!db)return;db.auth.getUser().then(({data})=>setUser(data.user));},[]);
 useEffect(()=>{if(!user){setSavedId(null);return;}supabase()!.from('wishlist').select('offer_id,offers(*)').eq('user_id',user.id).then(({data:rows})=>{const hit=(rows??[]).find(r=>r.offer_id===o.id||(r.offers&&sameProduct(r.offers as unknown as Offer,o)));setSavedId(hit?.offer_id??null);});},[user,o]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),4000);return()=>clearTimeout(t);},[toast]);
 const back=()=>{if(sessionStorage.getItem('baixou-from-catalog')===o.id&&history.length>1){sessionStorage.removeItem('baixou-from-catalog');router.back();}else router.push('/');};
 const save=async()=>{if(!user){router.push('/?conta=perfil');return;}const db=supabase()!;const {error}=savedId?await db.from('wishlist').delete().eq('user_id',user.id).eq('offer_id',savedId):await db.from('wishlist').insert({user_id:user.id,offer_id:o.id});if(error){setToast('Não foi possível salvar. Tente novamente.');return;}setSavedId(savedId?null:o.id);setToast(savedId?'Removido dos favoritos.':'Salvo na sua lista de desejos.');};
 return <>
  <header className="product-top"><div className="wrap product-top-inner"><button className="back-button" onClick={back}><ArrowLeft size={18}/>Voltar</button><a href="/" className="brand" aria-label="Baixou! início"><img src="/logo.png" alt="Baixou!" width="120" height="41"/></a><button className="icon" onClick={()=>{const next=theme==='dark'?'light':'dark';setTheme(next);document.documentElement.dataset.theme=next;localStorage.setItem('baixou-theme',next);}} aria-label={theme==='dark'?'Ativar modo claro':'Ativar modo escuro'}>{theme==='dark'?<Sun/>:<Moon/>}</button></div></header>
  <main className="wrap product-page"><ProductDetail offer={o} preloaded={data} saved={!!savedId} save={save} alert={()=>router.push('/?conta=notificacoes')}/></main>
  {toast&&<div className="toast" role="status">{toast}</div>}
 </>;
}
