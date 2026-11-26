import Catalog,{type CatalogResult} from '@/components/Catalog';
import {catalogIndex,catalogMeta} from '@/lib/catalog-server';
import {queryCatalog} from '@/lib/catalog-query';
// Primeiros produtos já no HTML (visão padrão), regenerado a cada 60 s. O cliente descarta itens vencidos e, se o
// HTML tiver mais de 60 s, busca a versão atual em segundo plano: nenhum preço vencido é apresentado como válido.
export const revalidate=60;
export default async function Home(){
 let initial:CatalogResult|null=null;
 try{const index=await catalogIndex(),meta=await catalogMeta();initial={...queryCatalog(index,{}),meta:meta?{...meta,departments:index.departments}:undefined,generatedAt:Date.now(),configured:true};}
 catch(e){console.error('catálogo inicial indisponível',e instanceof Error?e.message:e);}
 return <Catalog initial={initial}/>;
}
