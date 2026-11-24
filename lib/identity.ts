import {normalize,type Offer,type Alert} from './types';
export type Variant=Record<string,string|number>;
export function validGTIN(value:string){if(!/^(?:\d{8}|\d{12,14})$/.test(value)||/^(\d)\1+$/.test(value))return false;let sum=0;const digits=value.split('').map(Number);for(let i=digits.length-2,weight=3;i>=0;i--,weight=weight===3?1:3)sum+=digits[i]*weight;return (10-sum%10)%10===digits.at(-1);}
// Submarcas e grafias de loja para o fabricante (marca da placa, não do chip gráfico).
const BRAND_ALIASES:Record<string,string>={kingstontechnology:'kingston',kingstonfury:'kingston',fury:'kingston',advancedmicrodevices:'amd',ryzen:'amd',hewlettpackard:'hp',palitmicrosystem:'palit',palitmicrosystems:'palit',xpg:'adata',adataxpg:'adata',aorus:'gigabyte',gigabytetechnology:'gigabyte',rog:'asus',tuf:'asus',asustek:'asus',asusrog:'asus',westerndigital:'wd',logitechg:'logitech',tforce:'teamgroup',teamgroupinc:'teamgroup'};
export function canonicalBrand(value:string){const b=normalize(value).replace(/\s+/g,'');return BRAND_ALIASES[b]??b;}
// Código do fabricante a partir de dados da própria loja, sem inferência por semelhança:
// 1) código entre parênteses no campo MPN; 2) MPN de um só termo; 3) código de peça impresso no fim do título
// ("… - 90MB1HD0-M0EAY0" ou "(911-7E27-006)"), preferido a um nome de modelo; 4) modelo com espaços ("B550M-A PRO").
const NOT_CODE=/^(?:\d+(?:GB|TB|MHZ|MTS|HZ|W|MM|MS)|DDR\d|GDDR\d\w*|PCIE\d*|USB\d*|RGB|ARGB|WIFI\d*|HDMI|BOX)$/;
function compactCode(raw:string){const code=raw.toUpperCase().replace(/[^A-Z0-9]/g,'');return code.length>=4&&code.length<=40&&/[A-Z]/.test(code)&&/\d/.test(code)&&!NOT_CODE.test(code)?code:null;}
// Atributos de variante que o Mercado Livre acrescenta ao fim do título ("… - Cp-9020279-br Cor Preto") não são parte do código.
const LISTING_VARIANT_SUFFIX=/\s+(?:cor|voltagem)\s+[\p{L}\d/ -]{1,25}$/iu;
// Código impresso no fim do título, separado por " - ", ", " ou entre parênteses.
function titlePart(title:string){const t=title.replace(LISTING_VARIANT_SUFFIX,'').trim();return t.match(/\(([A-Za-z0-9][A-Za-z0-9./-]{4,38})\)\s*$/)?.[1]??t.match(/(?:\s[-–]\s|,\s*)([A-Za-z0-9][A-Za-z0-9./-]{4,38})\s*$/)?.[1];}
// Código de peça forte: com separador ("90MB1HD0-M0EAY0") ou prefixo de 2-4 letras seguido de >=5 dígitos ("BX8071514700F").
function strongTail(tail:string){return /[-./]/.test(tail)||/^[A-Z]{2,4}\d{5,}[A-Z0-9]*$/.test(tail);}
export function manufacturerConflict(mpn:string|null|undefined,title=''){
 const raw=(mpn??'').trim(),explicit=raw.match(/\(([^()]{4,40})\)/)?.[1]??(!/\s/.test(raw)?raw:null),tail=titlePart(title);
 const a=explicit?compactCode(explicit):null,b=tail&&/[-./]/.test(tail)?compactCode(tail):null;
 // Modelo e part number podem ser códigos diferentes legítimos (ex.: Acer AG15 e NX.*).
 // Só declara conflito dentro da mesma família explícita de códigos, sem inferir equivalência.
 return !!a&&!!b&&a!==b&&!!explicit&&!!tail&&/[-/]/.test(explicit)&&explicit.toUpperCase().split(/[-/]/)[0]===tail.toUpperCase().split(/[-/]/)[0];
}
export function manufacturerCode(mpn:string|null|undefined,title=''){
 if(manufacturerConflict(mpn,title))return null;
 const raw=(mpn??'').trim();
 const inner=raw.match(/\(([^()]{4,40})\)/)?.[1];if(inner&&compactCode(inner))return compactCode(inner);
 if(raw&&!/\s/.test(raw)&&compactCode(raw))return compactCode(raw);
 const tail=titlePart(title);
 if(tail&&strongTail(tail)&&compactCode(tail))return compactCode(tail);
 return raw&&raw.split(/\s+/).length<=5?compactCode(raw):null;
}
export function variantsCompatible(a:Variant={},b:Variant={}){for(const key of Object.keys(a)){if(b[key]!==undefined&&String(a[key])!==String(b[key]))return false;}return true;}
// "3.200MHz" (milhar com ponto) não pode virar 200 MHz na normalização.
export const joinThousands=(s:string)=>s.replace(/(\d)\.(\d{3})(?!\d)/g,'$1$2');
export function variantForOffer(o:Pick<Offer,'title'|'category'|'specs'>):Variant{const text=normalize(joinThousands(o.title+' '+Object.values(o.specs??{}).join(' ')));const v:Variant={};if(o.category==='ram'||/kit.*memoria/.test(text)){const pack=text.match(/\b(\d{1,2})\s*x\s*(\d{1,3})\s*gb\b/);if(pack){v.modules=Number(pack[1]);v.per_module_gb=Number(pack[2]);v.total_gb=Number(pack[1])*Number(pack[2]);}else{const cap=text.match(/\b(\d{1,3})\s*gb\b/);if(cap)v.total_gb=Number(cap[1]);}const ddr=text.match(/\bddr\s*([345])\b/);if(ddr)v.ddr=ddr[1];const speed=text.match(/\b(\d{3,5})\s*(?:mhz|mts)\b/);if(speed)v.frequency=Number(speed[1]);if(/notebook|sodimm|so dimm|\bs dimm\b/.test(text))v.form_factor='sodimm';else if(/desktop|udimm|dimm/.test(text))v.form_factor='dimm';}return v;}
export function identityForOffer(o:Offer){if(o.category==='kit'||manufacturerConflict(o.mpn,o.title))return null;/* códigos conflitantes e kits não sustentam identidade */const brand=canonicalBrand(o.brand??'');if(!brand)return null;const mpn=manufacturerCode(o.mpn,o.title);
const rawGTIN=Object.entries(o.specs??{}).find(([k])=>/^(ean|gtin|ean13|ean 13|upc)$/i.test(k))?.[1]?.replace(/\D/g,'')??o.gtin??'';const gtin=validGTIN(rawGTIN)?rawGTIN.padStart(14,'0'):null;
return mpn||gtin?{brand,mpn,gtin,variant:variantForOffer(o)}:null;}
export function matchesProductAlert(a:Alert,o:Offer){if(manufacturerConflict(o.mpn,o.title))return !!a.offer_id&&a.offer_id===o.id;if(a.product_id)return !!o.product_id&&a.product_id===o.product_id&&variantsCompatible(a.product_variant??{},o.variant??{});return !!a.offer_id&&a.offer_id===o.id;}
export function notificationKey(o:Offer){return o.product_id&&!manufacturerConflict(o.mpn,o.title)?'product:'+o.product_id:'offer:'+o.id;}
export function cheapestPerProduct(offers:Offer[]){const map=new Map<string,Offer>();for(const o of offers){const key=notificationKey(o),prior=map.get(key);if(!prior||Number(o.price)<Number(prior.price))map.set(key,o);}return [...map.values()];}
// Mercado Livre: vitrines não informam MPN/GTIN. Um termo do título só vira código do fabricante quando é IDÊNTICO
// a um código já registrado para a MESMA marca a partir de dados estruturados de outra loja (catalog_products).
// Nada de semelhança: dois códigos conhecidos diferentes no mesmo título = ambíguo, nenhum é usado.
export function knownCodeInTitle(title:string,brand:string|null|undefined,known:Map<string,Set<string>>){
 const codes=known.get(canonicalBrand(brand??''));if(!codes?.size)return null;
 const found=new Map<string,string>();
 for(const m of title.matchAll(/[A-Za-z0-9][A-Za-z0-9./-]{4,38}[A-Za-z0-9]/g)){const raw=m[0],code=compactCode(raw);if(code&&code.length>=6&&(code.match(/\d/g)?.length??0)>=3&&codes.has(code))found.set(code,raw);}
 return found.size===1?[...found.values()][0]:null;
}
