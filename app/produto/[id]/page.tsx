import type {Metadata} from 'next';import {notFound} from 'next/navigation';
import ProductPage from '@/components/ProductPage';import {productData} from '@/lib/product-data';import {money} from '@/lib/types';
// Página individual do produto, renderizada no servidor e regenerada a cada 60 s. A validade do preço continua
// sendo conferida no cliente (oferta vencida aparece como "Verificação expirada", nunca como preço válido).
export const revalidate=60;
type Props={params:Promise<{id:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{const {id}=await params;const d=await productData(id);if(!d||d==='error')return {title:'Oferta — Baixou!'};return {title:d.offer.title.slice(0,70)+' — Baixou!',description:'Preço verificado '+money(Number(d.offer.price))+' · histórico, comparação entre lojas e Baixou Score.'};}
export default async function Product({params}:Props){
 const {id}=await params;if(!id||id.length>100)notFound();
 const d=await productData(id);if(d==='error')throw Error('Produto indisponível agora');if(!d)notFound();
 return <ProductPage data={d}/>;
}
