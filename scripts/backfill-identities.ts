// Recalcula a identidade canônica de TODOS os anúncios com as regras atuais (lib/identity.ts): vincula novos,
// corrige vínculos antigos e desfaz vínculos que as regras atuais recusam. Código conhecido no título só por igualdade
// exata com código já registrado da mesma marca. Uso: workflow manual identity-backfill.yml.
import {adminDb} from '../lib/server';import {identityForOffer,variantForOffer,knownCodeInTitle} from '../lib/identity';import {loadKnownCodes} from '../lib/connectors/announce';import type {Offer} from '../lib/types';
const db=adminDb(),dry=process.env.DRY_RUN==='1';const {known}=await loadKnownCodes(db);
let scanned=0,linked=0,relinked=0,unlinked=0,titleCodes=0,unchanged=0;
for(let from=0;from<100000;from+=500){
 const {data,error}=await db.from('offers').select('*').order('id').range(from,from+499);if(error)throw error;
 for(const o of (data??[]) as Offer[]){scanned++;
  let identity=identityForOffer(o),mpn=o.mpn;
  if(!identity&&o.brand&&o.category!=='kit'){const code=knownCodeInTitle(o.title,o.brand,known);if(code){mpn=code;identity=identityForOffer({...o,mpn:code});if(identity)titleCodes++;}}
  let productId:string|null=null;
  if(identity){const r=await db.rpc('resolve_catalog_product',{p_brand:identity.brand,p_mpn:identity.mpn,p_gtin:identity.gtin,p_variant:identity.variant});if(r.error)throw r.error;productId=r.data;}
  if(productId===(o.product_id??null)&&mpn===o.mpn){unchanged++;continue;}
  if(productId&&!o.product_id)linked++;else if(productId)relinked++;else unlinked++;
  if(!dry){const u=await db.from('offers').update({product_id:productId,mpn,gtin:identity?.gtin??o.gtin??null,variant:identity?.variant??variantForOffer(o)}).eq('id',o.id);if(u.error)throw u.error;}
 }
 if((data?.length??0)<500)break;
}
console.log(JSON.stringify({dry,scanned,linked,relinked,unlinked,title_codes:titleCodes,unchanged}));
