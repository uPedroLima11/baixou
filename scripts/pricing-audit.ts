// Auditoria somente leitura do catálogo hospedado. Não usa service_role nem cria preços/produtos.
import {manufacturerConflict} from '../lib/identity';
import {marketStatus} from '../lib/market';
import {sameProduct,consolidateOffers} from '../lib/search';
import {departmentOptions} from '../lib/departments';
import {opportunityQuality} from '../lib/opportunities';
import {classify,type Offer} from '../lib/types';
const origin='https://baixouofertas.vercel.app';
let page:number|null=0,requests=0,bytes=0;const offers=new Map<string,Offer>();
while(page!==null){
 if(requests>=50)throw Error('Catálogo ultrapassou o limite de paginação da auditoria');
 const response=await fetch(origin+'/api/catalog?page='+page,{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Catálogo HTTP '+response.status);
 const body=await response.text();bytes+=Buffer.byteLength(body);requests++;
 const data=JSON.parse(body);for(const o of data.offers??[])offers.set(o.id,o);page=data.next??null;
}
const now=Date.now(),live=[...offers.values()].filter(o=>o.available&&Date.parse(o.expires_at)>now);
const groups=new Map<string,Offer[]>();for(const o of live){if(o.product_id){const rows=groups.get(o.product_id)??[];rows.push(o);groups.set(o.product_id,rows);}}
const vendor=(o:Offer)=>o.store!=='mercadolivre'?o.store:o.seller==='KaBuM! (loja oficial no Mercado Livre)'?'kabum':o.seller==='Pichau (loja oficial no Mercado Livre)'?'pichau':o.seller_key??null;
const cross=[...groups.values()].filter(g=>new Set(g.map(vendor).filter(Boolean)).size>1);
const conflicts=cross.filter(g=>g.some((o,i)=>g.slice(i+1).some(a=>!sameProduct(o,a))));
const exact=cross.filter(g=>!conflicts.includes(g));
const references=live.filter(o=>o.market_stores!>=2&&marketStatus(o)!=='none');
const below=live.filter(o=>marketStatus(o)==='below');
const categories=departmentOptions(live,now);
if(process.argv.includes('--benchmark')){
 const start=performance.now(),old:Offer[][]=[];for(const o of live){const g=old.find(g=>sameProduct(g[0],o));if(g)g.push(o);else old.push([o]);}
 const expected=old.map(g=>g.reduce((a,b)=>a.price<=b.price?a:b).id),oldMs=performance.now()-start;
 const next=performance.now(),actual=consolidateOffers(live).map(o=>o.id),newMs=performance.now()-next;
 if(JSON.stringify(expected)!==JSON.stringify(actual))throw Error('Agrupamento indexado divergiu da regra anterior');
 console.log(JSON.stringify({grouping_benchmark:{offers:live.length,old_ms:oldMs,indexed_ms:newMs,equivalent:true}}));
}

console.log(JSON.stringify({at:new Date(now).toISOString(),requests,payload_bytes:bytes,active_offers:live.length,
 manufacturer_conflicts:live.filter(o=>manufacturerConflict(o.mpn,o.title)).map(o=>({id:o.id,title:o.title,mpn:o.mpn,product_id:o.product_id})),
 active_by_store:Object.fromEntries([...new Set(live.map(o=>o.store))].map(s=>[s,live.filter(o=>o.store===s).length])),
 identified_offers:live.filter(o=>o.product_id).length,canonical_models:groups.size,
 exact_cross_store_models:exact.length,conflicting_legacy_groups:conflicts.length,
 models_with_valid_market_reference:new Set(references.map(o=>o.product_id)).size,
 below_market_offers:below.length,verified_opportunities:live.filter(o=>opportunityQuality(o).tier>0).length,
 classification_differences:live.filter(o=>classify(o.title)!==o.category).map(o=>({id:o.id,title:o.title,stored:o.category,current:classify(o.title)})),
 departments:categories.map(d=>({category:d.id,products:d.count,facets:d.facets.length})),
 comparisons:exact.slice(0,4).map(g=>g.map(o=>({store:o.store,seller:o.seller,title:o.title,mpn:o.mpn,price:o.price}))),
 below_market:below.map(o=>({id:o.id,title:o.title,store:o.store,price:o.price,median:o.market_median,lowest:o.market_lowest,stores:o.market_stores,expires:o.market_expires_at}))},null,2));
