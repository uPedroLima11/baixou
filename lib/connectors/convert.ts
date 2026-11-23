import {createHash} from 'node:crypto';
import {classify} from '../types';
import type {ParsedProduct} from '../../scripts/store-adapters';
import type {MarketplaceListing} from './types';
// Converte um anúncio JÁ aprovado por acceptListing no mesmo formato que os adaptadores HTML entregam ao coletor.
// Histórico, evidência (anunciado x comprovado), identidade entre lojas, favoritos e alertas seguem o fluxo existente.
// Preço original da API é desconto ANUNCIADO, nunca queda comprovada.
export function listingToProduct(l:MarketplaceListing,storeName:string,ttlMinutes=60):ParsedProduct{
 const now=new Date(l.fetchedAt);
 const specs:Record<string,string>={};if(l.couponHint)specs['Cupom informado pela API (não validado)']=l.couponHint.slice(0,120);
 return {seller_key:l.seller.id?l.source+':'+l.seller.id:null,payment_basis:l.paymentBasis??null,id:l.source+'-'+createHash('sha256').update(l.source+':'+l.externalId).digest('hex').slice(0,20),store:l.source,url:l.url,title:l.title.slice(0,300),category:classify(l.title),brand:l.brand,mpn:l.mpn,gtin:l.gtin,image:l.images[0]??null,images:l.images.filter(i=>i.startsWith('https://')).slice(0,8),price:l.price,original_price:l.originalPrice!=null&&l.originalPrice>l.price?l.originalPrice:null,available:l.available===true,seller:l.seller.name??storeName,sold:null,rating:null,review_count:null,specs,checked_at:now.toISOString(),expires_at:new Date(now.getTime()+ttlMinutes*60000).toISOString(),payment_note:l.paymentBasis==='cash'?'À vista no Pix, informado pela fonte; confirme frete na loja.':'Preço informado pela fonte '+storeName+'; confirme pagamento, frete e impostos na loja.'};
}
