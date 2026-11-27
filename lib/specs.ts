import {consoleFacts,controllerFacts} from './gaming';
import {canonicalBrand,joinThousands,variantForOffer} from './identity';
import {kitComponents,normalize,type Offer} from './types';
// Características técnicas extraídas de forma conservadora do TÍTULO da loja (e das variantes já calculadas).
// Mesma função para filtros do catálogo e alertas: normalização e correspondência compatíveis.
// Valor ausente = desconhecido: nunca casa por suposição e nunca é exibido como opção.
export type SpecValue=string|number;
export type FacetDef={key:string;label:string;numeric?:boolean;unit?:string};
const brand:FacetDef={key:'brand',label:'Marca'};
export const FACETS:Record<string,FacetDef[]>={
 ram:[{key:'ddr',label:'Geração'},{key:'total_gb',label:'Capacidade total',numeric:true,unit:'GB'},{key:'per_module_gb',label:'Capacidade por módulo',numeric:true,unit:'GB'},{key:'modules',label:'Módulos',numeric:true},{key:'frequency',label:'Frequência',numeric:true,unit:'MHz'},{key:'form_factor',label:'Uso'},brand],
 gpu:[{key:'chip_vendor',label:'Chip gráfico'},{key:'gpu_model',label:'GPU'},{key:'vram_gb',label:'Memória de vídeo',numeric:true,unit:'GB'},{...brand,label:'Fabricante da placa'}],
 cpu:[{key:'cpu_vendor',label:'Fabricante'},{key:'cpu_family',label:'Família'},{key:'cpu_series',label:'Geração/série'},{key:'socket',label:'Socket'},{key:'cores',label:'Núcleos',numeric:true},{key:'cpu_model',label:'Modelo'}],
 motherboard:[{key:'socket',label:'Socket'},{key:'ddr',label:'Memória'},{key:'chipset',label:'Chipset'},{key:'form_factor',label:'Formato'},brand],
 monitor:[{key:'size_in',label:'Tamanho',numeric:true,unit:'"'},{key:'resolution_label',label:'Resolução'},{key:'refresh_hz',label:'Taxa de atualização',numeric:true,unit:'Hz'},{key:'panel',label:'Painel'},brand],
 notebook:[{key:'cpu_vendor',label:'Processador'},{key:'ram_gb',label:'Memória RAM',numeric:true,unit:'GB'},{key:'storage_gb',label:'Armazenamento',numeric:true,unit:'GB'},{key:'gpu_type',label:'Vídeo'},{key:'gpu_model',label:'GPU dedicada'},{key:'use',label:'Perfil'},brand],
 pc:[{key:'cpu_vendor',label:'Processador'},{key:'ram_gb',label:'Memória RAM',numeric:true,unit:'GB'},{key:'storage_gb',label:'Armazenamento',numeric:true,unit:'GB'},{key:'gpu_type',label:'Vídeo'},{key:'gpu_model',label:'GPU dedicada'},{key:'use',label:'Perfil'},brand],
 kit:[{key:'cpu_vendor',label:'Plataforma'},{key:'cpu_model',label:'Processador incluído'},{key:'chipset',label:'Chipset da placa-mãe'},{key:'ram_included',label:'Memória incluída'},{key:'ram_gb',label:'Memória',numeric:true,unit:'GB'}],
 ssd:[{key:'kind',label:'Tipo'},{key:'capacity_gb',label:'Capacidade',numeric:true,unit:'GB'},{key:'interface',label:'Interface'},{key:'form',label:'Formato'},brand],
 chair:[{key:'chair_type',label:'Tipo'},brand],
 consoles:[{key:'console_model',label:'Modelo'},{key:'storage_gb',label:'Armazenamento',numeric:true,unit:'GB'},{key:'drive',label:'Edição'},{key:'bundle',label:'Pacote'},{...brand,label:'Fabricante'}],
 peripherals:[{key:'subtype',label:'Tipo'},{key:'connectivity',label:'Com ou sem fio'},{key:'controller_model',label:'Modelo do controle'},{key:'platform',label:'Compatibilidade'},{key:'controller_connection',label:'Conexão do controle'},brand],
 mouse:[{key:'connectivity',label:'Conexão'},brand],
 keyboard:[{key:'connectivity',label:'Conexão'},{key:'switch_type',label:'Tecnologia'},{key:'layout',label:'Layout'},brand],
 other:[brand],
};
const num=(s:string)=>Number(s.replace(',','.'));
function capacityGB(m:RegExpMatchArray|null){return m?num(m[1])*(m[2].toLowerCase()==='tb'?1000:1):undefined;}
export function offerFacets(o:Pick<Offer,'title'|'category'|'specs'|'brand'>&{variant?:Record<string,SpecValue>|null}):Record<string,SpecValue>{
 const raw=joinThousands(o.title),t=' '+normalize(raw)+' ',r:Record<string,SpecValue>={};
 const set=(k:string,v:SpecValue|undefined|null)=>{if(v!==undefined&&v!==null&&v!==''&&!(typeof v==='number'&&!Number.isFinite(v)))r[k]=v;};
 const cap=(k:string,re:RegExp)=>{const m=t.match(re);if(m)set(k,m[1]);};
 if(o.brand?.trim())set('brand',canonicalBrand(o.brand));
 const c=o.category;
 if(c==='consoles'){const f=consoleFacts(t);if(f){set('console_model',f.model);set('brand',f.brand);set('storage_gb',f.storage);set('drive',f.drive);set('bundle',f.bundle);}}
 if(c==='ram'){const v={...(o.variant??{}),...variantForOffer(o)};for(const k of ['ddr','total_gb','per_module_gb','modules','frequency'])set(k,v[k]);if(v.form_factor)set('form_factor',v.form_factor==='sodimm'?'notebook':'desktop');}
 if(c==='gpu'||c==='notebook'||c==='pc'){
  const vendor=/\b(rtx|gtx|geforce|nvidia|quadro)\b/.test(t)?'nvidia':/\b(radeon|rx\s*\d{3,4})\b/.test(t)?'amd':/\barc\s*[ab]\d{3}\b/.test(t)?'intel':undefined;
  const model=t.match(/\b(rtx|gtx)\s*(\d{3,4})\s*(ti super|ti|super)?\b/)??t.match(/\b(rx)\s*(\d{3,4})\s*(xtx|xt|gre)?\b/)??t.match(/\b(arc)\s*([ab]\d{3})\b()/);
  const gpuModel=model?[model[1].toUpperCase()==='ARC'?'Arc':model[1].toUpperCase(),model[2].toUpperCase(),model[3]?model[3].toUpperCase().replace('TI','Ti').replace('SUPER','Super'):''].filter(Boolean).join(' '):undefined;
  if(c==='gpu'){set('chip_vendor',vendor);set('gpu_model',gpuModel);const vr=t.match(/\b(\d{1,2})\s*g(?:b)?\b/);if(vr)set('vram_gb',Number(vr[1]));}
  else{set('gpu_type',gpuModel?'dedicada':/\b(integrad[ao]|iris|uhd graphics|radeon graphics|radeon vega|vega \d+)\b/.test(t)?'integrada':undefined);set('gpu_model',gpuModel);}
 }
 if(c==='cpu'||c==='notebook'||c==='pc'||c==='kit'){
  const amd=/\b(ryzen|athlon|amd)\b/.test(t),intel=/\b(intel|core\s*(?:ultra\s*)?i?[3579]|pentium|celeron|xeon)\b/.test(t);
  set('cpu_vendor',amd&&!intel?'amd':intel&&!amd?'intel':undefined);
 }
 if(c==='cpu'||c==='kit'){
  const ry=t.match(/\bryzen\s*([3579])\s*(?:pro\s*)?(\d{4})([a-z0-9]*)/),ci=t.match(/\bcore\s*(?:i([3579])\s*(\d{4,5})([a-z]*)|ultra\s*([3579])\s*(\d{3})([a-z]*))/);
  if(ry){set('cpu_family','Ryzen '+ry[1]);set('cpu_model','Ryzen '+ry[1]+' '+ry[2]+ry[3].toUpperCase());set('cpu_series','Ryzen '+ry[2][0]+'000');}
  else if(ci&&ci[1]){set('cpu_family','Core i'+ci[1]);set('cpu_model','Core i'+ci[1]+'-'+ci[2]+ci[3].toUpperCase());set('cpu_series',(ci[2].length===5?ci[2].slice(0,2):ci[2][0])+'ª geração');}
  else if(ci&&ci[4]){set('cpu_family','Core Ultra '+ci[4]);set('cpu_model','Core Ultra '+ci[4]+' '+ci[5]+ci[6].toUpperCase());set('cpu_series','Core Ultra série '+ci[5][0]);}
  else if(/\bathlon\b/.test(t))set('cpu_family','Athlon');
  cap('cores',/\b(\d{1,2})\s*(?:cores|core|nucleos)\b/);if(typeof r.cores==='string')r.cores=Number(r.cores);
 }
 if(c==='cpu'||c==='motherboard'||c==='kit'){const s=t.match(/\b(am[345]|lga\s*\d{4})\b/);if(s)set('socket',s[1].replace(/\s+/,' ').toUpperCase().replace('LGA ','LGA'));}
 if(c==='motherboard'||c==='kit'){
  const ch=t.match(/\b([abhxzq]\d{3}e?)m?\b/);if(ch)set('chipset',ch[1].toUpperCase());
 }
 if(c==='motherboard'){
  cap('ddr',/\bddr\s*([345])\b/);
  set('form_factor',/\be\s*atx\b/.test(t)?'E-ATX':/\b(mini\s*itx|itx)\b/.test(t)?'Mini-ITX':/\b(matx|m\s*atx|micro\s*atx)\b/.test(t)||/\b[abhxzq]\d{3}e?m\b/.test(t)?'Micro-ATX':/\batx\b/.test(t)?'ATX':undefined);
 }
 if(c==='kit'){const parts=kitComponents(raw);set('ram_included',parts['Memória']||/\bddr\s*[45]\b/.test(t)?'sim':'nao');const rg=t.match(/\b(\d{1,3})\s*gb\b/);if(rg&&r.ram_included==='sim')set('ram_gb',Number(rg[1]));}
 if(c==='monitor'){
  const size=raw.match(/(\d{2}(?:[.,]\d{1,2})?)\s*(?:"|''|”|pol\b|polegadas)/i);if(size)set('size_in',num(size[1]));
  set('resolution_label',/\b(4k|uhd|3840\s*x\s*2160)\b/.test(t)?'4K':/\b(qhd|wqhd|2k|2560\s*x\s*1440|1440p)\b/.test(t)?'QHD':/\b(full\s*hd|fhd|1920\s*x\s*1080|1080p)\b/.test(t)?'Full HD':/\b(hd|1366\s*x\s*768)\b/.test(t)?'HD':undefined);
  const hz=[...t.matchAll(/\b(\d{2,3})\s*hz\b/g)].map(m=>Number(m[1]));if(hz.length)set('refresh_hz',Math.max(...hz));
  const panel=t.match(/\b(oled|ips|va|tn)\b/);if(panel)set('panel',panel[1].toUpperCase());
 }
 if(c==='notebook'||c==='pc'){
  const ram=t.match(/\b(\d{1,3})\s*gb\s*(?:de\s*)?(?:ram|ddr\s*\d|memoria)\b/)??t.match(/\b(?:ram|memoria)\s*(?:de\s*)?(\d{1,3})\s*gb\b/);if(ram)set('ram_gb',Number(ram[1]));
  set('storage_gb',capacityGB(t.match(/\b(\d+(?:\s\d)?)\s*(gb|tb)\s*(?:de\s*)?(?:ssd|nvme|hd|m 2)\b/)??t.match(/\b(?:ssd|nvme)\s*(?:de\s*)?(\d+)\s*(gb|tb)\b/)));
  if(/\b(gamer|gaming)\b/.test(t))set('use','gamer');
 }
 if(c==='ssd'){set('kind',/^\s*(hd|hdd|disco)\b/.test(t)||/\b(hdd|hard drive|7200\s*rpm|5400\s*rpm|barracuda)\b/.test(t)?'HD':'SSD');set('capacity_gb',capacityGB(raw.match(/\b(\d+(?:[.,]\d+)?)\s*(gb|tb)\b/i)));cap('interface',/\b(nvme|sata)\b/);if(r.interface)r.interface=String(r.interface).toUpperCase();set('form',/\bm\s*2\b/.test(t)?'M.2':/\b2\s*5\b/.test(t)?'2,5"':undefined);}
 if(c==='chair')set('chair_type',/\bgamer\b/.test(t)?'gamer':/\b(escritorio|office|presidente|diretor|ergonomica)\b/.test(t)?'escritório':undefined);
 if(c==='peripherals'){const controller=controllerFacts(t);if(controller){set('subtype','Controles');set('controller_model',controller.model);set('platform',controller.platform);set('controller_connection',controller.connection);}else {const sub:[RegExp,string][]=[[/\b(headset|fones?)\b/,'Headset/fone'],[/\b(water\s*cooler|watercooler)\b/,'Water cooler'],[/\bcooler\b/,'Cooler'],[/\b(ventoinha|fan)\b/,'Ventoinha'],[/\bfonte\b/,'Fonte'],[/\bgabinete\b/,'Gabinete'],[/\b(webcam|camera web)\b/,'Webcam'],[/\bmicrofone\b/,'Microfone'],[/\b(mousepad|mouse pad)\b/,'Mousepad'],[/\b(caixa de som|soundbar)\b/,'Caixa de som'],[/\b(teclado e mouse|kit|combo)\b/,'Kit teclado/mouse']];for(const [re,v] of sub)if(re.test(t)){set('subtype',v);break;}}}
 if(['peripherals','mouse','keyboard'].includes(c))set('connectivity',/\b(sem fio|wireless|2 4 ?ghz|bluetooth)\b/.test(t)?'sem fio':/\b(com fio|cabo usb|usb)\b/.test(t)?'com fio':undefined);
 if(c==='keyboard'){set('switch_type',/\bmecanico\b/.test(t)?'mecânico':/\bmembrana\b/.test(t)?'membrana':undefined);if(/\babnt\s*2?\b/.test(t))set('layout','ABNT2');}
 // Chaves legadas dos alertas existentes (mantidas para compatibilidade).
 if(c==='ssd'&&r.capacity_gb!==undefined)r.capacity_gb=Number(r.capacity_gb);
 const legacy=t.match(/\b(bluetooth|usb|p2)\b/);if(legacy)r.connection=legacy[1];
 if(c==='monitor'){const res=t.match(/\b(\d{3,4}\s*x\s*\d{3,4})\b/);if(res)r.resolution=res[1].replace(/\s+/g,'');}
 return r;
}
const LABELS:Record<string,string>={nvidia:'NVIDIA',amd:'AMD',intel:'Intel',notebook:'Notebook (SODIMM)',desktop:'Desktop (DIMM)',dedicada:'Dedicada',integrada:'Integrada',gamer:'Gamer',sim:'Inclui memória',nao:'Sem memória'};
const BRAND_LABELS:Record<string,string>={adata:'ADATA',amd:'AMD',asus:'ASUS',msi:'MSI',aoc:'AOC',lg:'LG',hp:'HP',pny:'PNY',wd:'WD',xpg:'XPG',nvidia:'NVIDIA',gskill:'G.Skill',teamgroup:'TeamGroup',pcyes:'PCYes',lianli:'Lian Li',riseMode:'Rise Mode',risemode:'Rise Mode',deepcool:'DeepCool',coolermaster:'Cooler Master',hyperx:'HyperX',sandisk:'SanDisk',tgt:'TGT'};
export function facetLabel(key:string,value:SpecValue){
 if(key==='brand'){const v=String(value);return BRAND_LABELS[v]??v.charAt(0).toUpperCase()+v.slice(1);}
 if(key==='ddr')return 'DDR'+value;
 if(['total_gb','per_module_gb','vram_gb','ram_gb','storage_gb','capacity_gb'].includes(key)){const n=Number(value);return n>=1000&&n%1000===0?n/1000+' TB':n+' GB';}
 if(key==='frequency')return value+' MHz';if(key==='refresh_hz')return value+' Hz';if(key==='size_in')return String(value).replace('.',',')+'"';
 if(key==='modules')return Number(value)===1?'1 módulo':value+' módulos';if(key==='cores')return value+' núcleos';
 return LABELS[String(value)]??String(value).charAt(0).toUpperCase()+String(value).slice(1);
}
// Filtro: chave -> lista de valores aceitos (OU); "<chave>_min" -> mínimo numérico. Chaves combinadas com E.
export type SpecFilter=Record<string,SpecValue|SpecValue[]>;
const same=(a:SpecValue,b:SpecValue)=>normalize(String(a)).replace(/\s/g,'')===normalize(String(b)).replace(/\s/g,'');
export function matchesSpecFilter(specs:Record<string,SpecValue>,filter:SpecFilter){
 for(const [key,want] of Object.entries(filter??{})){
  if(key.endsWith('_min')){const v=specs[key.slice(0,-4)];if(v===undefined||!(Number(v)+1e-9>=Number(want)))return false;continue;}
  const v=specs[key],list=Array.isArray(want)?want:[want];if(!list.length)continue;
  if(v===undefined||!list.some(w=>same(v,w)))return false;
 }
 return true;
}
