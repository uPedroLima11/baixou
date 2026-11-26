// Card clicado no catálogo: a tela de carregamento do produto mostra foto, título e preço na hora (mesmo dado do card),
// enquanto a página completa chega. Memória do módulo, só nesta aba.
import type {Offer} from './types';
let pending:Pick<Offer,'id'|'title'|'image'|'price'|'store'|'seller'|'verification_status'|'payment_basis'>|null=null;
export function setPendingProduct(o:Offer){pending={id:o.id,title:o.title,image:o.image,price:o.price,store:o.store,seller:o.seller,verification_status:o.verification_status,payment_basis:o.payment_basis};}
export function pendingProduct(id:string){return pending&&pending.id===id?pending:null;}
