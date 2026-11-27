import {canonicalBrand,matchesProductAlert} from './identity';
import {offerFacets,matchesSpecFilter,type SpecFilter} from './specs';
import {type Alert,type Offer} from './types';
import {offerForPayment} from './payment';

export const specFields:Record<string,{key:string;label:string;unit?:string}[]>={
 ram:[{key:'ddr',label:'Geração DDR (4 ou 5)'},{key:'total_gb',label:'Capacidade total',unit:'GB'},{key:'modules',label:'Quantidade de módulos'},{key:'frequency',label:'Frequência',unit:'MHz'}],
 gpu:[{key:'vram_gb',label:'Memória de vídeo',unit:'GB'}],
 monitor:[{key:'refresh_hz',label:'Atualização',unit:'Hz'},{key:'panel',label:'Painel (IPS, VA, OLED)'},{key:'resolution',label:'Resolução (ex.: 1920x1080)'}],
 ssd:[{key:'capacity_gb',label:'Capacidade',unit:'GB'},{key:'interface',label:'Interface (NVMe ou SATA)'}],
 cpu:[{key:'socket',label:'Socket (ex.: AM5)'},{key:'cores',label:'Núcleos'}],
 motherboard:[{key:'socket',label:'Socket (ex.: AM5)'},{key:'ddr',label:'Geração DDR (4 ou 5)'}],
 peripherals:[{key:'connection',label:'Conexão (USB, Bluetooth, P2)'}],
 mouse:[{key:'connection',label:'Conexão (USB, Bluetooth)'}],
 keyboard:[{key:'connection',label:'Conexão (USB, Bluetooth)'}],
};
// Mesmo extrator e comparador dos filtros do catálogo (lib/specs.ts): normalização e correspondência compatíveis.
export function offerSpecs(o:Offer){return offerFacets(o);}
// Escopo do alerta = tudo menos as condições de preço: categoria, produto, marcas e filtros técnicos.
// Um alerta ATIVO cujo escopo cobre o produto define o limite de compra do usuário para ele (ver notificationReason).
export function alertCovers(a:Alert,o:Offer){
 if(!a.enabled)return false;
 if(a.category!=='all'&&a.category!==o.category)return false;
 if((a.offer_id||a.product_id)&&!matchesProductAlert(a,o))return false;
 if(a.brands?.length&&!a.brands.some(b=>canonicalBrand(b)===canonicalBrand(o.brand??'')))return false;
 // Listas = qualquer um dos valores; "<chave>_min" = mínimo numérico; especificação desconhecida nunca casa.
 return matchesSpecFilter(offerSpecs(o),(a.spec_filters??{}) as SpecFilter);
}
// Modalidades em que o alerta é avaliado: pix (padrão antigo), card, ou any = Pix OU cartão (cada uma com seu preço,
// habitual e queda; nunca misturando). Sem preço no cartão informado, a avaliação no cartão não casa.
export const alertPayments=(a:Pick<Alert,'payment'>):('pix'|'card')[]=>a.payment==='any'?['pix','card']:[a.payment==='card'?'card':'pix'];
export function matchesAlert(a:Alert,raw:Offer,now=Date.now()){return alertPayments(a).some(p=>matchesAlertIn(a,raw,p,now));}
export function matchesAlertIn(a:Alert,raw:Offer,pay:'pix'|'card',now=Date.now()){
 if(!alertPayments(a).includes(pay))return false;const o=offerForPayment(raw,pay);if(!o)return false;
 if(!a.enabled||!o.available||Date.parse(o.expires_at)<=now)return false;
 if(!alertCovers(a,o))return false;
 if(a.max_price!=null&&Number(o.price)>a.max_price)return false;
 const historical=(a.min_drop_amount??0)>0||(a.min_discount??0)>0;
 if(historical){
  if(!o.historical_median||o.historical_samples<5||o.historical_days<3)return false;
  const drop=Number(o.historical_median)-Number(o.price);
  if(a.min_drop_amount!=null&&drop+1e-8<a.min_drop_amount)return false;
  if(a.min_discount!=null&&drop/Number(o.historical_median)*100+1e-8<a.min_discount)return false;
 }
 return a.max_price!=null||historical;
}
