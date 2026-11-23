import type {SupabaseClient} from '@supabase/supabase-js';
import {evidenceFromStats,type Offer} from '../types';
import {identityForOffer,variantForOffer} from '../identity';
import {verificationTTL} from '../collection-policy';
import type {ParsedProduct} from '../../scripts/store-adapters';
// Mesma sequência de gravação do coletor HTML (lib/collector.ts) para um produto já verificado:
// mediana agregada no Postgres -> evidência (anunciado x comprovado) -> TTL -> identidade -> offers -> histórico horário.
// TODO: unificar com lib/collector.ts quando os demais conectores oficiais forem implementados.
export async function persistVerifiedProduct(db:SupabaseClient,base:ParsedProduct){
 const stats=await db.rpc('price_history_stats',{p_offer_id:base.id}).single<{median:number|null;samples:number;days:number}>();if(stats.error)throw stats.error;
 const evidence=evidenceFromStats(base.price,base.original_price,stats.data??{median:null,samples:0,days:0}),ttl=verificationTTL(evidence.evidence,evidence.discount);
 const identity=identityForOffer({...base,...evidence} as Offer);let productId:string|null=null;
 if(identity){const resolved=await db.rpc('resolve_catalog_product',{p_brand:identity.brand,p_mpn:identity.mpn,p_gtin:identity.gtin,p_variant:identity.variant});if(resolved.error)throw resolved.error;productId=resolved.data;}
 const now=new Date();
 const updated=await db.from('offers').upsert({...base,...evidence,product_id:productId,gtin:identity?.gtin??base.gtin??null,variant:identity?.variant??variantForOffer(base),discoveries:[],coupon_validated:false,last_attempt_at:now.toISOString(),checked_at:now.toISOString(),verification_status:'verified',expires_at:new Date(now.getTime()+ttl*60000).toISOString()});
 if(updated.error)throw updated.error;
 if(base.available){const hist=await db.from('price_history').upsert({offer_id:base.id,price:base.price,bucket:now.toISOString().slice(0,13),observed_at:now.toISOString()},{onConflict:'offer_id,bucket',ignoreDuplicates:true});if(hist.error)throw hist.error;}
 return evidence;
}
