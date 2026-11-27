import type {SupabaseClient} from '@supabase/supabase-js';
import * as cheerio from 'cheerio/slim';
import {evidenceFromStats,type Offer} from './types';
import {verificationTTL,candidateCategory} from './collection-policy';
import {cardTerms,loadCardReference,type CardTerms} from './payment';
import {excludedCondition} from './product-policy';

// KaBuM: conferência pela LISTAGEM da própria loja (/categoria?page_number=N&page_size=100, __NEXT_DATA__.catalogServer).
// Cada item traz vendedor, disponibilidade, estoque, preço Pix (priceWithDiscount), total no cartão (price) e parcelamento
// (maxInstallment); a campanha vigente fica em `offer` (startsAt ≤ agora < endsAt). Conferido em 27/11/2026: 42/42 preços
// Pix e 13/13 cartões iguais aos da página de detalhe já verificada.
// Uso: renovar a verificação de produtos JÁ conhecidos (ficha técnica/código vieram da página de detalhe) e descobrir
// produtos novos de venda própria (vão para a fila; a página de detalhe confirma identidade antes de virar oferta).
// Nunca: marketplace, open box, pré-venda, condição excluída, item ausente da listagem tratado como esgotado.
export type ListingItem={id:string;code:number;url:string;title:string;pix:number;old:number|null;card:CardTerms;available:boolean;excluded:string|null};
const BRL=(s:string)=>Number(s.replace(/\./g,'').replace(',','.'));
export function parseKabumListing(html:string,nowSec=Date.now()/1000):{items:ListingItem[];totalPages:number;total:number}{
 const $=cheerio.load(html);const next=JSON.parse($('#__NEXT_DATA__').text()||'{}');let d=next.props?.pageProps?.data;if(typeof d==='string')d=JSON.parse(d);
 const cs=d?.catalogServer;if(!cs||!Array.isArray(cs.data))throw Error('Listagem sem catalogServer');
 const items:ListingItem[]=[];
 for(const p of cs.data){
  if(!p?.code||!p.friendlyName||!p.name)continue;
  const own=!(p.sellerId!=null&&Number(p.sellerId)!==0)&&p.flags?.isMarketplace!==true&&String(p.sellerName??'')==='KaBuM!';
  const offer=p.offer&&Number(p.offer.startsAt)<=nowSec&&nowSec<Number(p.offer.endsAt)?p.offer:null;
  const pix=Number(offer?offer.priceWithDiscount:p.priceWithDiscount),total=Number(offer?offer.price:p.price);
  if(!(pix>0))continue;
  const m=String(p.maxInstallment??'').match(/(\d{1,2})x\s*de\s*R\$\s*([\d.]+,\d{2})/i),n=m?Number(m[1]):0,v=m?BRL(m[2]):0;
  const card=cardTerms({pix,total:total>0?total:null,rows:n&&v?[{n,value:v,interestFree:null,total:null}]:[],interestFreeHint:n&&v&&total>0&&Math.abs(n*v-total)<=Math.max(.11,n*.011)?true:null});
  const old=Number(p.oldPrice)>pix?Number(p.oldPrice):null;
  const excluded=!own?'seller_untrusted':p.flags?.isOpenbox||p.flags?.isPreOrder?'condition_excluded':excludedCondition(String(p.name))?'condition_excluded':null;
  items.push({id:'kabum-'+p.code,code:Number(p.code),url:'https://www.kabum.com.br/produto/'+p.code+'/'+p.friendlyName,title:String(p.name).slice(0,500),pix,old,card,available:p.available===true,excluded});
 }
 return {items,totalPages:Number(cs.meta?.totalPagesCount)||1,total:Number(cs.meta?.totalItemsCount)||items.length};
}

type Row=Pick<Offer,'id'|'url'|'price'|'original_price'|'available'|'evidence'|'discount'|'card_price'|'card_installments'|'card_installment_value'|'card_interest_free'>&{specs?:Record<string,string>};
const sameCard=(r:Row,c:CardTerms)=>Number(r.card_price??0)===Number(c.card_price??0)&&Number(r.card_installments??0)===Number(c.card_installments??0)&&Number(r.card_installment_value??0)===Number(c.card_installment_value??0);

// Aplica uma página da listagem. Itens conhecidos e inalterados: renovação em lote (checked_at, validade pela mesma
// regra do TTL, histórico). Preço/cartão/estoque mudaram: mesma via completa do coletor (habitual, evidência, cartão).
// Desconhecidos de venda própria: fila de candidatos (até `room`).
export async function applyKabumListing(db:SupabaseClient,items:ListingItem[],room:number){
 const usable=items.filter(i=>!i.excluded),ids=usable.map(i=>i.id);let renewed=0,changed=0,unavailable=0,queued=0;
 if(!ids.length)return {renewed,changed,unavailable,queued,known:0};
 const {data,error}=await db.from('offers').select('id,url,price,original_price,available,evidence,discount,card_price,card_installments,card_installment_value,card_interest_free,verification_status,mpn,product_id').in('id',ids);if(error)throw error;
 // Só renova ofertas que já passaram pela página de detalhe (verificadas ou vencidas), nunca excluídas por política.
 const known=new Map(((data??[]) as (Row&{verification_status:string})[]).filter(r=>r.verification_status!=='excluded').map(r=>[r.id,r]));
 // Armazenamento (plano gratuito): renovação sem mudança grava no máximo 1 observação a cada 6 h (balde 00/06/12/18);
 // mudança de preço grava na hora. O resumo diário e o preço habitual continuam com observações reais todos os dias.
 const now=new Date(),iso=now.toISOString(),bucket=iso.slice(0,13),bucket6=iso.slice(0,11)+String(Math.floor(now.getUTCHours()/6)*6).padStart(2,'0');const renewBy:Record<number,string[]>={};const hist:{offer_id:string;price:number;card_price:number|null;bucket:string;observed_at:string}[]=[];const touched:string[]=[];
 for(const i of usable){const r=known.get(i.id);if(!r)continue;touched.push(r.url);
  if(!i.available){if(r.available){const u=await db.from('offers').update({available:false,checked_at:iso,last_attempt_at:iso,expires_at:iso,verification_status:'verified'}).eq('id',i.id);if(u.error)throw u.error;}unavailable++;continue;}
  if(r.available&&Number(r.price)===i.pix&&sameCard(r,i.card)){const ttl=verificationTTL(r.evidence,Number(r.discount));(renewBy[ttl]??=[]).push(i.id);hist.push({offer_id:i.id,price:i.pix,card_price:i.card.card_price,bucket:bucket6,observed_at:iso});renewed++;continue;}
  // Mudou: recalcula como o coletor (preço habitual por dia, preço "de" limitado ao máximo observado, cartão).
  const [stats,cardRef]=await Promise.all([db.rpc('price_history_stats',{p_offer_id:i.id}).single(),loadCardReference(db,i.id,i.card.card_price)]);if(stats.error)throw stats.error;
  const evidence=evidenceFromStats(i.pix,i.old,(stats.data??{median:null,samples:0,days:0}) as Parameters<typeof evidenceFromStats>[2]),ttl=verificationTTL(evidence.evidence,evidence.discount);
  const u=await db.from('offers').update({price:i.pix,original_price:i.old,available:true,...i.card,...evidence,...cardRef,checked_at:iso,last_attempt_at:iso,verification_status:'verified',expires_at:new Date(now.getTime()+ttl*60000).toISOString()}).eq('id',i.id);if(u.error)throw u.error;
  hist.push({offer_id:i.id,price:i.pix,card_price:i.card.card_price,bucket,observed_at:iso});changed++;
 }
 for(const [ttl,list] of Object.entries(renewBy)){const u=await db.from('offers').update({checked_at:iso,last_attempt_at:iso,verification_status:'verified',expires_at:new Date(now.getTime()+Number(ttl)*60000).toISOString()}).in('id',list);if(u.error)throw u.error;}
 if(hist.length){const h=await db.from('price_history').upsert(hist,{onConflict:'offer_id,bucket',ignoreDuplicates:true});if(h.error)throw h.error;}
 // Página de detalhe dispensada por ~20 h (ficha técnica/código), a listagem mantém preço e estoque.
 if(touched.length){const c=await db.from('product_candidates').update({last_attempt_at:iso,next_attempt_at:new Date(now.getTime()+20*3600000).toISOString(),failures:0}).eq('store','kabum').in('url',touched);if(c.error)throw c.error;}
 const fresh=usable.filter(i=>!known.has(i.id)&&i.available).slice(0,Math.max(0,room));
 if(fresh.length){const ins=await db.from('product_candidates').upsert(fresh.map(i=>({store:'kabum',url:i.url,category:candidateCategory(i.url)})),{onConflict:'store,url',ignoreDuplicates:true}).select('url');if(ins.error)throw ins.error;queued=ins.data?.length??0;}
 return {renewed,changed,unavailable,queued,known:known.size};
}
