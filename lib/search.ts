import {variantsCompatible,manufacturerCode,manufacturerConflict} from './identity';
import {normalize,type Offer} from './types';
function searchable(s:string){return normalize(s).replace(/(\d)\s+(gb|tb|mhz|hz|mb|w)\b/g,'$1$2').replace(/\bddr\s+(\d)\b/g,'ddr$1');}
export function matchesQuery(o:Pick<Offer,'title'|'brand'|'mpn'|'category'>,query:string){const text=searchable([o.title,o.brand,o.mpn,o.category].filter(Boolean).join(' '));const aliases:Record<string,string>={gpu:'placa video',vga:'placa video',mobo:'placa mae',memorias:'memoria'};const tokens=searchable(query).split(' ').filter(Boolean).flatMap(t=>(aliases[t]??t).split(' '));return tokens.every(t=>text.includes(t));}
export function sameProduct(a:Offer,b:Offer){
 if(a.category==='kit'||b.category==='kit')return false;
 if(manufacturerConflict(a.mpn,a.title)||manufacturerConflict(b.mpn,b.title))return false;
 if(a.category!==b.category||!variantsCompatible(a.variant,b.variant))return false;
 // Um vínculo legado não autoriza unir códigos de fabricante conflitantes.
 const am=manufacturerCode(a.mpn,a.title),bm=manufacturerCode(b.mpn,b.title);if(am&&bm&&am!==bm)return false;
 if(a.product_id&&b.product_id)return a.product_id===b.product_id;
 return !!a.mpn&&!!b.mpn&&!!a.brand&&!!b.brand&&searchable(a.mpn)===searchable(b.mpn)&&searchable(a.brand)===searchable(b.brand);
}
export function consolidateOffers(offers:Offer[]){return groupOffers(offers).map(g=>g.reduce((a,b)=>Number(a.price)<=Number(b.price)?a:b));}
// Mesma regra de vendedor independente da referência de mercado no banco (public.market_seller):
// KaBuM/Pichau dentro do Mercado Livre são as próprias lojas; demais vitrines do ML contam pelo vendedor.
export function independentSeller(o:Pick<Offer,'store'|'seller'|'seller_key'>){if(o.store!=='mercadolivre')return o.store;if(o.seller==='KaBuM! (loja oficial no Mercado Livre)')return 'kabum';if(o.seller==='Pichau (loja oficial no Mercado Livre)')return 'pichau';return o.seller_key??'mercadolivre:'+o.seller;}
// Comparação neutra entre lojas: para cada anúncio, as ofertas do MESMO modelo (sameProduct) em >=2 vendedores
// independentes, uma por vendedor (a mais barata), ordenadas por preço. Não é selo de promoção nem "menor preço do mercado".
export function comparisonIndex(offers:Offer[]){
 const index=new Map<string,Offer[]>();
 for(const g of groupOffers(offers)){
  const best=new Map<string,Offer>();for(const o of g){const k=independentSeller(o),prior=best.get(k);if(!prior||Number(o.price)<Number(prior.price))best.set(k,o);}
  if(best.size<2)continue;const rows=[...best.values()].sort((a,b)=>Number(a.price)-Number(b.price));for(const o of g)index.set(o.id,rows);
 }
 return index;
}
export function groupOffers(offers:Offer[]){
 const groups:Offer[][]=[],index=new Map<string,Offer[][]>(),order=new Map<Offer[],number>();
 for(const offer of offers){
  // Índice só reduz candidatos. sameProduct continua decidindo identidade/variantes/conflitos.
  const keys=[offer.product_id?'p:'+offer.product_id:null,offer.mpn&&offer.brand?'m:'+searchable(offer.brand)+':'+searchable(offer.mpn):null].filter((k):k is string=>!!k);
  const candidates=[...new Set(keys.flatMap(k=>index.get(k)??[]))].sort((a,b)=>order.get(a)!-order.get(b)!);
  let group=candidates.find(g=>sameProduct(g[0],offer));
  if(group)group.push(offer);else{group=[offer];order.set(group,groups.length);groups.push(group);}
  for(const key of keys){const rows=index.get(key)??[];if(!rows.includes(group))rows.push(group);index.set(key,rows);}
 }
 return groups;
}
