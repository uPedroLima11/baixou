import {ShieldCheck,Megaphone} from 'lucide-react';
import {storeNames} from '@/lib/stores';
import type {Offer} from '@/lib/types';
// Identificação da loja com a identidade do Baixou!: monograma colorido (sem baixar logotipos de terceiros nem
// chamar serviços externos de favicon), nome, vendedor real em marketplace e distinção verificado × anunciado.
const MARKS:Record<string,[string,string]>={kabum:['K','#e8650a'],terabyte:['T','#1f5fbf'],pichau:['P','#d62a3a'],waz:['W','#7a3fd1'],guerradigital:['GD','#1e7a4c'],patoloco:['PL','#c2185b'],ibyte:['iB','#0b7fa3'],chipart:['CA','#5b6470'],shopinfo:['SI','#00897b'],mercadolivre:['ML','#c9a400']};
export function storeMark(store:string){return MARKS[store]??[(storeNames[store]??store).slice(0,1).toUpperCase(),'#6b7280'];}
// "NVIDIA (loja oficial no Mercado Livre)" → "Loja oficial NVIDIA".
export function sellerLabel(o:Pick<Offer,'store'|'seller'>){if(o.store!=='mercadolivre')return null;const m=o.seller?.match(/^(.*) \(loja oficial no Mercado Livre\)$/);return m?'Loja oficial '+m[1]:o.seller?'Vendido por '+o.seller:null;}
export default function StoreBadge({offer:o,detail=false}:{offer:Pick<Offer,'store'|'seller'|'verification_status'>;detail?:boolean}){
 const [abbr,color]=storeMark(o.store),name=storeNames[o.store]??o.store,seller=sellerLabel(o),announced=o.verification_status==='announced';
 return <span className={'store-badge'+(detail?' detail':'')}><span className="store-mark" style={{background:color}} aria-hidden="true">{abbr}</span><span className="store-name"><b>{name}</b>{seller&&<small>{seller}</small>}{detail&&!seller&&o.seller&&o.seller!==name&&<small>Vendido por {o.seller}</small>}</span>
  {announced?<span className="store-status announced" title="Preço publicado pela loja; página do produto não conferida"><Megaphone size={11}/>Anunciado</span>:<span className="store-status" title="Preço e estoque conferidos na página da loja"><ShieldCheck size={11}/>Verificado</span>}</span>;
}
