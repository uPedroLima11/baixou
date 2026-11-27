import {CreditCard,QrCode} from 'lucide-react';
import {money,type Offer} from '@/lib/types';

// Preços por modalidade, sempre valores informados pela loja. Linha principal = modalidade escolhida (o.price já vem
// projetado); linha secundária discreta = a outra modalidade. Cartão ausente: "não informado" (nunca estimado).
const short=(o:Pick<Offer,'card_installments'|'card_installment_value'|'card_interest_free'>)=>o.card_installments&&o.card_installment_value?o.card_installments+'× '+money(Number(o.card_installment_value))+(o.card_interest_free===true?' s/ juros':o.card_interest_free===false?' c/ juros':''):null;
export const isCardView=(o:Offer)=>o.payment_basis==='card';

export function paymentLabel(o:Offer){
 const announced=o.verification_status==='announced';
 if(isCardView(o)){const s=short(o);return (announced?'no cartão · anunciado':'total no cartão')+(s?' · '+s:'');}
 return announced?'à vista · anunciado pela loja':o.store!=='mercadolivre'||o.payment_basis==='cash'?'à vista no Pix':'Condições de pagamento na loja';
}

// Card do catálogo: Pix e cartão lado a lado, com o mesmo destaque, em qualquer modalidade escolhida.
// Pix: preço à vista (ou "Preço na loja" quando a fonte não informa Pix). Cartão: total informado + parcelas.
export function DualPrice({o,active}:{o:Offer;active:'all'|'pix'|'card'}){
 const card=isCardView(o)?Number(o.price):Number(o.card_price),cashBasis=isCardView(o)||o.store!=='mercadolivre'||o.payment_basis==='cash';
 const pix=isCardView(o)?Number(o.pix_price):Number(o.price),s=short(o),announced=o.verification_status==='announced';
 return <div className="dual-price">
  <div className={active==='pix'?'chosen':''}><small>{cashBasis?'Pix':'Preço na loja'}{announced?' · anunciado':''}</small><strong className="pix">{pix>0?money(pix):'—'}</strong></div>
  <div className={active==='card'?'chosen':''}><small>Cartão{announced&&card>0?' · anunciado':''}</small>{card>0?<><strong>{money(card)}</strong>{s?<span>{s}</span>:null}</>:<span className="none">não informado</span>}</div>
 </div>;
}
export function AltPrice({o}:{o:Offer}){
 if(isCardView(o))return o.pix_price?<small className="alt-price"><QrCode size={11} aria-hidden/>Pix {money(Number(o.pix_price))}</small>:null;
 if(Number(o.card_price)>0){const s=short(o);return <small className="alt-price"><CreditCard size={11} aria-hidden/>Cartão {money(Number(o.card_price))}{s?' · '+s:''}</small>;}
 return <small className="alt-price none"><CreditCard size={11} aria-hidden/>Cartão não informado</small>;
}

// Página do produto: as duas modalidades lado a lado, com parcelamento e juros quando a loja informa.
export function PaymentTable({o,onChoose}:{o:Offer;onChoose?:(p:'pix'|'card')=>void}){
 const pix=isCardView(o)?Number(o.pix_price):Number(o.price),card=Number(o.card_price),s=short(o),announced=o.verification_status==='announced';
 return <div className="payment-table" role="group" aria-label="Preço por forma de pagamento">
  <div className={isCardView(o)?'':'active'} onClick={()=>onChoose?.('pix')} role={onChoose?'button':undefined} tabIndex={onChoose?0:undefined} aria-pressed={onChoose?!isCardView(o):undefined}><span><QrCode size={14} aria-hidden/>Pix / à vista</span><strong>{pix>0?money(pix):'—'}</strong><small>{announced?'anunciado pela loja':'informado pela loja'}</small></div>
  <div className={isCardView(o)?'active':''} onClick={()=>card>0&&onChoose?.('card')} role={onChoose&&card>0?'button':undefined} tabIndex={onChoose&&card>0?0:undefined} aria-pressed={onChoose&&card>0?isCardView(o):undefined}><span><CreditCard size={14} aria-hidden/>Cartão de crédito</span>{card>0?<><strong>{money(card)}</strong><small>{s??'parcelamento não informado'}{card>0&&pix>0&&card>pix?' · '+money(card-pix)+' a mais que no Pix':''}</small></>:<><strong className="none">Não informado</strong><small>a loja não publicou o total no cartão</small></>}</div>
 </div>;
}
