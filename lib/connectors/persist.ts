import type {SupabaseClient} from '@supabase/supabase-js';
import {evidenceFromStats,type Offer} from '../types';
import {identityForOffer,variantForOffer} from '../identity';
import {verificationTTL} from '../collection-policy';
import {storeNames} from '../stores';
import type {ParsedProduct} from '../../scripts/store-adapters';
// Mesma sequência de gravação do coletor HTML (lib/collector.ts) para um produto já verificado:
// mediana agregada no Postgres -> evidência (anunciado x comprovado) -> TTL -> identidade -> offers -> histórico horário.
// TODO: unificar com lib/collector.ts quando os demais conectores oficiais forem implementados.
// announced: anúncio da própria loja ainda não conferido na página. checked_at = horário do anúncio, validade curta,
// sem histórico (que só guarda verificações), status 'announced' (fora dos alertas e da referência de mercado).
export async function persistVerifiedProduct(db:SupabaseClient,base:ParsedProduct,announced?:{at:string;ttlMinutes:number;post:string;insertOnly?:boolean}){
 const stats=await db.rpc('price_history_stats',{p_offer_id:base.id}).single<{median:number|null;samples:number;days:number;max:number|null;ref_median:number|null;ref_samples:number|null;ref_days:number|null;ref_min:number|null;ref_max:number|null}>();if(stats.error)throw stats.error;
 const evidence=evidenceFromStats(base.price,base.original_price,stats.data??{median:null,samples:0,days:0}),ttl=verificationTTL(evidence.evidence,evidence.discount);
 const identity=identityForOffer({...base,...evidence} as Offer);let productId:string|null=null;
 if(identity){const resolved=await db.rpc('resolve_catalog_product',{p_brand:identity.brand,p_mpn:identity.mpn,p_gtin:identity.gtin,p_variant:identity.variant});if(resolved.error)throw resolved.error;productId=resolved.data;}
 // Imagem de anúncio: preferir a do MESMO produto canônico (identidade exata) em outra loja, com origem indicada;
 // senão a foto que a própria loja publicou no post. Nunca por semelhança.
 if(announced){
  let source:string|null=base.image?'Foto publicada pela própria loja no anúncio do Telegram':null;
  if(productId){const same=await db.from('offers').select('store,image,images').eq('product_id',productId).neq('id',base.id).neq('store',base.store).not('image','is',null).order('checked_at',{ascending:false}).limit(5);if(same.error)throw same.error;
   const pick=(same.data??[]).find(r=>typeof r.image==='string'&&r.image.startsWith('https://')&&!/telesco\.pe/.test(r.image));
   if(pick){base.image=pick.image;base.images=((pick.images as string[]|null)??[pick.image]).filter(i=>typeof i==='string'&&i.startsWith('https://')).slice(0,6);source='Mesmo modelo exato (código '+(identity?.mpn??identity?.gtin)+') na loja '+(storeNames[pick.store]??pick.store);}}
  if(source)base.specs={...base.specs,'Fonte da imagem':source};
 }
 const now=announced?new Date(announced.at):new Date();
 const updated=await db.from('offers').upsert({...base,...evidence,product_id:productId,gtin:identity?.gtin??base.gtin??null,variant:identity?.variant??variantForOffer(base),discoveries:[],coupon_validated:false,last_attempt_at:now.toISOString(),checked_at:now.toISOString(),verification_status:announced?'announced':'verified',expires_at:new Date(now.getTime()+(announced?announced.ttlMinutes:ttl)*60000).toISOString()},announced?.insertOnly?{onConflict:'id',ignoreDuplicates:true}:undefined);
 if(updated.error)throw updated.error;
 // Histórico de preços ANUNCIADOS, separado do verificado (deduplicado por post).
 if(announced){const rec=await db.rpc('record_announcement',{p_offer:base.id,p_price:base.price,p_posted_at:announced.at,p_post:announced.post});if(rec.error)throw rec.error;}
 if(base.available&&!announced){const hist=await db.from('price_history').upsert({offer_id:base.id,price:base.price,bucket:now.toISOString().slice(0,13),observed_at:now.toISOString()},{onConflict:'offer_id,bucket',ignoreDuplicates:true});if(hist.error)throw hist.error;}
 return evidence;
}
