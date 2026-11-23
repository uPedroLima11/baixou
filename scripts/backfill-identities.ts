import {adminDb} from '../lib/server';import {identityForOffer,variantForOffer} from '../lib/identity';import type {Offer} from '../lib/types';
const db=adminDb();const {data,error}=await db.from('offers').select('*').limit(1000);if(error)throw error;let linked=0;
for(const o of (data??[]) as Offer[]){const identity=identityForOffer(o);if(!identity)continue;const {data:id,error}=await db.rpc('resolve_catalog_product',{p_brand:identity.brand,p_mpn:identity.mpn,p_gtin:identity.gtin,p_variant:identity.variant});if(error)throw error;if(!id)continue;const {error:ue}=await db.from('offers').update({product_id:id,gtin:identity.gtin,variant:variantForOffer(o)}).eq('id',o.id);if(ue)throw ue;linked++;}
console.log(linked+' ofertas reais vinculadas a identidade canônica.');
