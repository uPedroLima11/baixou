// Auditoria somente leitura (API pública): quantos modelos têm identidade forte em >=2 vendedores independentes.
// Uso: npx tsx scripts/identity-coverage.ts [--list]
import {identityForOffer,variantsCompatible} from '../lib/identity';
import type {Offer} from '../lib/types';
const site='https://baixouofertas.vercel.app',offers:Offer[]=[];
for(let page=0;page<20;page++){const r=await fetch(site+'/api/catalog?page='+page);if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();const rows=(j.offers??j.data??j) as Offer[];offers.push(...rows);if(rows.length<400)break;}
const seller=(o:Offer)=>o.store==='mercadolivre'?(o.seller_key??o.seller):o.store; // ML: vendedor; varejistas: a própria loja
const groups=new Map<string,{o:Offer;v:any}[]>();let identified=0,storeLinked=0;
for(const o of offers){if(o.product_id)storeLinked++;const id=identityForOffer(o);if(!id)continue;identified++;const key=id.brand+'|'+(id.mpn??'gtin:'+id.gtin);const g=groups.get(key)??[];g.push({o,v:id.variant});groups.set(key,g);}
const cross=[...groups.entries()].filter(([,g])=>{const sellers=new Set(g.map(x=>seller(x.o)));if(sellers.size<2)return false;return g.every(a=>g.every(b=>variantsCompatible(a.v,b.v)));});
console.log(JSON.stringify({offers:offers.length,with_product_id_now:storeLinked,identified_by_current_rules:identified,models:groups.size,models_in_2plus_sellers:cross.length,models_in_3plus_sellers:cross.filter(([,g])=>new Set(g.map(x=>seller(x.o))).size>=3).length}));
if(process.argv.includes('--list'))for(const [k,g] of cross)console.log(k,'|',g.map(x=>x.o.store+':'+x.o.price+(x.o.product_id?'':'*')).join(' '));
