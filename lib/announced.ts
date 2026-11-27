import {publicDb} from './supabase';
import {withRetry} from './db-retry';
// "Ofertas divulgadas recentemente": anúncios publicados pelas próprias lojas (canais no Telegram) nas últimas 48 h,
// inclusive os que já saíram do catálogo (validade de 6 h). Disponibilidade NÃO confirmada; preço é o anunciado.
// Mesma consulta para a página (HTML já com a lista) e para /api/announced.
const FIELDS='id,store,url,title,category,brand,mpn,image,price,seller,checked_at,expires_at,payment_note,product_id,specs';
export type AnnouncedItem={id:string;store:string;url:string;title:string;category:string;brand:string|null;mpn:string|null;image:string|null;price:number;posted_at:string;expires_at:string;in_catalog:boolean;source:string|null;image_source:string|null;product_id:string|null;note:string|null};
export type AnnouncedResult={hours:number;generated_at:string;offers:AnnouncedItem[]};
export async function announcedOffers(hours=48):Promise<AnnouncedResult>{
 const db=publicDb();if(!db)return {hours,generated_at:new Date().toISOString(),offers:[]};
 const since=new Date(Date.now()-hours*3600000).toISOString();
 const r=await withRetry(()=>db.from('catalog_offers').select(FIELDS).eq('verification_status','announced').gte('checked_at',since).order('checked_at',{ascending:false}).limit(600));
 if(r.error)throw r.error;
 const offers=(r.data??[]).map(o=>{const specs=(o.specs??{}) as Record<string,string>;return {id:o.id,store:o.store,url:o.url,title:o.title,category:o.category,brand:o.brand,mpn:o.mpn,image:o.image,price:Number(o.price),posted_at:o.checked_at,expires_at:o.expires_at,in_catalog:Date.parse(o.expires_at)>Date.now(),source:specs['Fonte do preço']??null,image_source:specs['Fonte da imagem']??null,product_id:o.product_id,note:o.payment_note};});
 return {hours,generated_at:new Date().toISOString(),offers};
}
