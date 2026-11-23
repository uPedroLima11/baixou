import {canonicalBrand,matchesProductAlert,variantForOffer} from './identity';
import {normalize,type Alert,type Offer} from './types';

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
export function offerSpecs(o:Offer):Record<string,string|number>{
 const result:Record<string,string|number>={...variantForOffer(o),...o.variant};
 const text=normalize(o.title+' '+Object.values(o.specs??{}).join(' '));
 const capture=(key:string,re:RegExp)=>{const m=text.match(re);if(m)result[key]=m[1];};
 if(o.category==='gpu')capture('vram_gb',/\b(\d+)\s*gb\b/);
 if(o.category==='monitor'){capture('refresh_hz',/\b(\d+)\s*hz\b/);capture('panel',/\b(ips|va|oled|tn)\b/);capture('resolution',/\b(\d{3,4}\s*x\s*\d{3,4})\b/);}
 if(o.category==='ssd'){const m=text.match(/\b(\d+(?:\s+\d+)?)\s*(gb|tb)\b/);if(m)result.capacity_gb=Number(m[1].replace(/\s+/g,'.'))*(m[2]==='tb'?1000:1);capture('interface',/\b(nvme|sata)\b/);}
 if(['cpu','motherboard'].includes(o.category)){capture('socket',/\b(am[345]|lga\s*\d{4})\b/);capture('ddr',/\bddr\s*([345])\b/);if(o.category==='cpu')capture('cores',/\b(\d+)\s*(?:cores|nucleos)\b/);}
 capture('connection',/\b(bluetooth|usb|p2)\b/);
 return result;
}
export function matchesAlert(a:Alert,o:Offer,now=Date.now()){
 if(!a.enabled||!o.available||Date.parse(o.expires_at)<=now)return false;
 if(a.category!=='all'&&a.category!==o.category)return false;
 if((a.offer_id||a.product_id)&&!matchesProductAlert(a,o))return false;
 if(a.brands?.length&&!a.brands.some(b=>canonicalBrand(b)===canonicalBrand(o.brand??'')))return false;
 const specs=offerSpecs(o);
 for(const [key,value] of Object.entries(a.spec_filters??{})){
  if(!specFields[o.category]?.some(f=>f.key===key)||specs[key]===undefined||normalize(String(specs[key])).replace(/\s/g,'')!==normalize(String(value)).replace(/\s/g,''))return false;
 }
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
