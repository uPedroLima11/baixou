// Passos comuns para anúncios de canais das lojas (coleta regular e importação de publicações antigas).
import type {SupabaseClient} from '@supabase/supabase-js';
import {listingToProduct} from './convert';
import {storeNames} from '../stores';
import {knownCodeInTitle,knownCodeInSlug,manufacturerCode,brandInTitle} from '../identity';
import type {MarketplaceListing} from './types';
// Códigos de fabricante já registrados por marca e marcas conhecidas (forma canônica), só para igualdade exata.
export async function loadKnownCodes(db:SupabaseClient){
 const known=new Map<string,Set<string>>(),brands=new Set<string>();
 for(let from=0;from<20000;from+=1000){const r=await db.from('catalog_products').select('brand,mpn').not('mpn','is',null).range(from,from+999);if(r.error)throw r.error;for(const row of r.data??[]){brands.add(row.brand);const set=known.get(row.brand)??new Set<string>();set.add(String(row.mpn));known.set(row.brand,set);}if((r.data?.length??0)<1000)break;}
 return {known,brands};
}
export function enrichListing(listing:MarketplaceListing,known:Map<string,Set<string>>,brands:Set<string>){
 if(!listing.brand)listing.brand=brandInTitle(listing.title,brands);
 if(!listing.mpn&&!listing.gtin&&listing.brand){const code=manufacturerCode(null,listing.title)??knownCodeInTitle(listing.title,listing.brand,known)??knownCodeInSlug(listing.url,listing.brand,known);if(code)listing.mpn=code;}
}
export function announcedProduct(listing:MarketplaceListing,fallbackName:string){
 const product=listingToProduct(listing,storeNames[listing.source]??fallbackName),a=listing.announcement;
 if(a){product.payment_note='Preço à vista anunciado no '+a.label+' em '+new Date(a.postedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+(a.installmentTotal?'; parcelado R$ '+a.installmentTotal.toLocaleString('pt-BR',{minimumFractionDigits:2}):'')+'. Página do produto não conferida pelo Baixou!: confirme preço e estoque na loja.';
  product.specs={...product.specs,'Fonte do preço':'Anúncio da loja no Telegram (t.me/'+a.channel+'/'+a.postId+')'};}
 return product;
}
// Só o histórico de preços anunciados (anúncio já existe no banco). Retorna false se falhar (ex.: anúncio inexistente).
export async function recordAnnouncement(db:SupabaseClient,listing:MarketplaceListing,fallbackName:string){
 const a=listing.announcement;if(!a)return false;
 const r=await db.rpc('record_announcement',{p_offer:listingToProduct(listing,fallbackName).id,p_price:listing.price,p_posted_at:a.postedAt,p_post:a.channel+'/'+a.postId});
 return !r.error;
}
