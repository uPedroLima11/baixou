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
import {excludedCondition} from './product-policy';

export type EquivalentKey={key:string;label:string};
export function equivalentGroup(o:StatOffer):EquivalentKey|null{
 if(excludedCondition(o.title))return null;
 if(o.category==='ram'){
  const g=ramGroup(o),f=offerFacets(o),mhz=Number(f.frequency);if(!g||!mhz||!f.form_factor)return null;
  // Linha/qualidade: latência (CL) separa módulos de entrada dos de desempenho (ex.: Fury Beast CL16 × entrada CL22).
  const latency=Object.entries(o.specs??{}).filter(([k])=>/lat[eê]ncia|\bcas\b|^cl$/i.test(k)).map(([,v])=>/^(?:\d{2})$/.test(v.trim())?'CL'+v:v).join(' ');
  const cl=ramLatencyClass(o.title+' '+latency,Number(f.ddr));
  return {key:'ram|'+g.key+'|'+mhz+'|'+cl.key,label:g.label+' · '+mhz+' MHz · '+cl.label+' · '+(g.tier?.endsWith('notebook')?'notebook':g.tier?.endsWith('servidor')?'servidor':'desktop')};
 }
 if(o.category==='gpu'){const g=gpuGroup(o),memory=(' '+normalize(o.title+' '+Object.values(o.specs??{}).join(' '))+' ').match(/\bgddr\s*([567]x?)\b/)?.[1]??'?';return g?{key:'gpu|'+g.key+'|gddr'+memory,label:g.label+' · '+(memory==='?'?'tipo de memória não informado':'GDDR'+memory.toUpperCase())}:null;}
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
   const quality=ssdQuality(o);return {key:'ssd|nvme|'+g+'|'+gb+'|'+quality.key,label:'SSD NVMe PCIe '+g+'.0 · '+(gb>=1000?gb/1000+' TB':gb+' GB')+' · '+quality.label};
  }
  if(iface==='SATA'&&form){const quality=ssdQuality(o);return {key:'ssd|sata|'+form+'|'+gb+'|'+quality.key,label:'SSD SATA '+form+' · '+(gb>=1000?gb/1000+' TB':gb+' GB')+' · '+quality.label};}
  return null;
 }
 return null;
}
// Só características explicitamente informadas. Não inferir NAND/controlador pela marca ou linha comercial.
export function ssdQuality(o:Pick<StatOffer,'title'|'specs'>){
 const text=normalize(o.title+' '+Object.entries(o.specs??{}).map(([k,v])=>k+' '+v).join(' ')),nand=text.match(/\b([tqms]lc)\b/)?.[1]??'?';
 const dram=/\b(dramless|dram less|sem dram)\b/.test(text)?'sem-dram':/\b(com dram|with dram)\b/.test(text)?'com-dram':'dram?';
 return {key:nand+'|'+dram,label:(nand==='?'?'NAND não informada':nand.toUpperCase())+(dram==='dram?'?'':dram==='sem-dram'?' · sem DRAM':' · com DRAM')};
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

// Classe de latência pela CL informada no título ("CL16", "C16"). DDR4: CL<=16 baixa latência; DDR5: CL<=36; DDR3: CL<=9.
// Sem CL no título, a oferta só é comparada com outras também sem essa informação.
export function ramLatencyClass(title:string,ddr:number){const m=(' '+normalize(title)+' ').match(/\bc(?:l)?\s?(\d{2})\b/);const cl=m?Number(m[1]):NaN;
 if(!Number.isFinite(cl)||cl<5||cl>60)return {key:'cl?',label:'CL não informada'};
 const low=ddr===5?cl<=36:ddr===4?cl<=16:cl<=9;return low?{key:'cl-low',label:'baixa latência (CL'+cl+')'}:{key:'cl-std',label:'CL padrão'};}
