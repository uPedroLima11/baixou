// Grupos EQUIVALENTES: produtos tecnicamente semelhantes de fabricantes/linhas diferentes. NÃO são o mesmo modelo
// (isso é sameProduct/comparisonIndex). Servem como alternativas e como freio do Baixou Score: um anúncio bem acima
// das alternativas equivalentes não vira "boa oportunidade" só porque a loja baixou o próprio preço.
// Regras: atributo desconhecido exclui o anúncio (nunca presumido); capacidade, geração, formato, kit × módulo,
// frequência (RAM), VRAM (GPU) e interface/geração PCIe (SSD) precisam coincidir. Só preço verificado à vista/Pix.
import {offerFacets} from './specs';
import {ramGroup,gpuGroup,cashComparable,isLive,type StatOffer} from './stats';
import {independentSeller} from './search';
import {median} from './history';
import {normalize,type Offer} from './types';

export type EquivalentKey={key:string;label:string};
export function equivalentGroup(o:StatOffer):EquivalentKey|null{
 if(o.category==='ram'){
  const g=ramGroup(o),f=offerFacets(o),mhz=Number(f.frequency);if(!g||!mhz)return null;
  return {key:'ram|'+g.key+'|'+mhz,label:g.label+' · '+mhz+' MHz · '+(g.tier?.endsWith('notebook')?'notebook':g.tier?.endsWith('servidor')?'servidor':'desktop')};
 }
 if(o.category==='gpu'){const g=gpuGroup(o);return g?{key:'gpu|'+g.key,label:g.label}:null;}
 if(o.category==='cpu'){
  const f=offerFacets(o),model=f.cpu_model?String(f.cpu_model):'';if(!model)return null;
  return {key:'cpu|'+model,label:model+' · qualquer embalagem'};
 }
 if(o.category==='ssd'){
  const f=offerFacets(o),gb=Number(f.capacity_gb),iface=String(f.interface??'');if(f.kind!=='SSD'||!gb||!iface)return null;
  const t=' '+normalize(o.title)+' ',form=String(f.form??'');
  if(/\b(externo|portatil|portable|usb)\b/.test(t))return null;// SSD externo não equivale a interno
  if(iface==='NVME'){
   const gen=t.match(/\b(?:gen\s*([345])|pcie\s*(?:gen\s*)?([345])(?:\s*0)?|([345])\s*0\s*x\s*4)\b/);const g=gen?(gen[1]??gen[2]??gen[3]):'';if(!g)return null;
   return {key:'ssd|nvme|'+g+'|'+gb,label:'SSD NVMe PCIe '+g+'.0 · '+(gb>=1000?gb/1000+' TB':gb+' GB')};
  }
  if(iface==='SATA'&&form)return {key:'ssd|sata|'+form+'|'+gb,label:'SSD SATA '+form+' · '+(gb>=1000?gb/1000+' TB':gb+' GB')};
  return null;
 }
 return null;
}
export type GroupReference={key:string;label:string;median:number;lowest:number;offers:number;sellers:number};
export const GROUP_MIN_OFFERS=4,GROUP_MIN_SELLERS=2;
// Referência do grupo para cada anúncio: mediana das OUTRAS ofertas vivas do grupo (o próprio anúncio fica fora).
// Exige >=4 outras ofertas de >=2 vendedores independentes.
export function groupReferences(offers:Offer[],now=Date.now()){
 const groups=new Map<string,{g:EquivalentKey;list:Offer[]}>();
 for(const o of offers){if(!isLive(o,now)||!cashComparable(o))continue;const g=equivalentGroup(o);if(!g)continue;const e=groups.get(g.key)??{g,list:[]};e.list.push(o);groups.set(g.key,e);}
 const out=new Map<string,GroupReference>();
 for(const {g,list} of groups.values()){
  if(list.length<GROUP_MIN_OFFERS+1)continue;
  for(const o of list){
   const others=list.filter(x=>x.id!==o.id);if(others.length<GROUP_MIN_OFFERS)continue;
   const sellers=new Set(others.map(independentSeller)).size;if(sellers<GROUP_MIN_SELLERS)continue;
   const p=others.map(x=>Number(x.price));out.set(o.id,{key:g.key,label:g.label,median:median(p)!,lowest:Math.min(...p),offers:others.length,sellers});
  }
 }
 return out;
}
