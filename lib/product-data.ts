// Dados completos de um produto para a página /produto/[id] e para /api/product (mesma regra nos dois).
// Ficha técnica de outra loja só para o MESMO produto canônico (identidade forte) e com a origem indicada.
// Avaliações nunca são transferidas entre lojas. Comparação, alternativas e Score vêm do índice do catálogo, que
// contém somente ofertas válidas agora.
import {publicDb} from './supabase';
import {catalogIndex} from './catalog-server';
import {sameProduct} from './search';
import {baixouScore,type BaixouScore} from './score';
import type {GroupReference} from './groups';
import type {Offer} from './types';
export type ProductData={partial?:boolean;offer:Offer;related_specs:{store:string;offer_id:string;specs:Record<string,string>}|null;comparison:Offer[]|null;alternatives:Offer[];group:GroupReference|null;score:BaixouScore};
export async function productData(id:string):Promise<ProductData|null|'error'>{
 const db=publicDb();if(!db)return 'error';
 const [{data,error},index]=await Promise.all([db.from('offers').select('*').eq('id',id).maybeSingle(),// O índice frio leva ~3 s: a página não espera por ele (comparação e Score completos chegam depois pelo cliente).
  Promise.race([catalogIndex().catch(()=>null),new Promise<null>(r=>setTimeout(()=>r(null),600))])]);
 if(error)return 'error';if(!data)return null;
 const offer=data as Offer;let related_specs:ProductData['related_specs']=null;
 if(offer.product_id&&Object.keys(offer.specs??{}).length<3){
  const others=await db.from('offers').select('*').eq('product_id',offer.product_id).neq('store',offer.store).limit(10);
  const best=((others.data??[]) as Offer[]).filter(o=>sameProduct(o,offer)).map(o=>({o,n:Object.keys(o.specs??{}).length})).sort((a,b)=>b.n-a.n)[0];
  if(best&&best.n>=3)related_specs={store:best.o.store,offer_id:best.o.id,specs:best.o.specs};
 }
 const now=Date.now(),entry=index?.byId.get(id),live=(o:Offer)=>o.available&&Date.parse(o.expires_at)>now;
 const comparison=entry?.compare?.filter(live)??null;
 const alternatives=index?index.entries.filter(e=>e.o.id!==id&&live(e.o)&&sameProduct(e.o,offer)).map(e=>e.o).slice(0,12):[];
 const group=entry?.group??null;
 // Mesma nota do card: usa a do índice quando preço e referências são os mesmos; só recalcula (com o mesmo grupo)
 // se a linha do banco já trouxer preço/referência mais novos — nunca uma conta diferente.
 const same=entry&&Number(entry.o.price)===Number(offer.price)&&Number(entry.o.reference_median??0)===Number(offer.reference_median??0)&&Number(entry.o.market_median??0)===Number(offer.market_median??0)&&entry.o.expires_at===offer.expires_at;
 return {partial:!index,offer,related_specs,comparison:comparison&&comparison.length>1?comparison:null,alternatives,group,score:same?entry.score:baixouScore({...offer,group},now)};
}
