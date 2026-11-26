'use client';
import {useParams} from 'next/navigation';
import {pendingProduct} from '@/lib/pending-product';import ProductShell from '@/components/ProductShell';
// Abertura instantânea: mostra o que o card já tinha (foto, título, loja, preço) enquanto a página completa carrega.
export default function Loading(){const {id}=useParams<{id:string}>();return <ProductShell p={pendingProduct(decodeURIComponent(String(id??'')))}/>;}
