import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import * as cheerio from 'cheerio';
import {parseStoreProduct,structuredProductLinks,ConfirmedUnavailable} from '../scripts/store-adapters';import {classify,kitComponents,type Alert,type Offer} from '../lib/types';import {identityForOffer} from '../lib/identity';import {matchesAlert} from '../lib/alert-rules';import {diverseCandidates,categoryURL,productURL,retryMinutes,verificationTTL,planBatch,recheckMinutes,pickDiscoveryPages} from '../lib/collection-policy';import {sources} from '../scripts/sources';
function fixture(file:string){const html=readFileSync(new URL('./fixtures/expansion/'+file+'.html',import.meta.url),'utf8');return {html,url:cheerio.load(html)('link[rel=canonical]').attr('href')!};}
test('real WAZ ItemList exposes products even without visible anchor links',()=>{const html=readFileSync(new URL('./fixtures/expansion/waz-category.html',import.meta.url),'utf8'),source=sources.find(s=>s.id==='waz')!;const links=structuredProductLinks(cheerio.load(html)).map(u=>productURL(u,source)).filter(Boolean);assert.equal(new Set(links).size,12);});
test('Patoloco explicit unavailability without price cannot become a fake free offer or transient failure',()=>{const {html,url}=fixture('patoloco-unavailable');assert.throws(()=>parseStoreProduct('patoloco',html,url),ConfirmedUnavailable);});
test('WAZ selects explicit own seller, Pix and never treats aggregate highPrice/internal SKU as history/MPN',()=>{const {html,url}=fixture('waz');const p=parseStoreProduct('waz',html,url);assert.equal(p.price,24449.99);assert.equal(p.original_price,null);assert.notEqual(p.mpn,'131176');assert.equal(p.available,true);assert.throws(()=>parseStoreProduct('waz',html.replace('"name":"waz"','"name":"other seller"'),url));});
test('Bits confirms own Store and matching DOM Pix, does not invent generic brand or sales',()=>{const {html,url}=fixture('bits');const p=parseStoreProduct('oficinadosbits',html,url);assert.equal(p.price,499.99);assert.equal(p.brand,null);assert.equal(p.mpn,'SX8GB-D4-3200HZ');assert.equal(p.sold,null);assert.throws(()=>parseStoreProduct('oficinadosbits',html.replace('class="price-discount__pix"','class="missing"'),url));});
test('Guerra selects mainEntity rather than first recommended Product, and validates actual Pix',()=>{const {html,url}=fixture('guerra');const p=parseStoreProduct('guerradigital',html,url);assert.match(p.title,/Patriot/);assert.equal(p.price,1719.14);assert.equal(p.original_price,null);assert.equal(p.mpn,'PVE2432G360C0');assert.throws(()=>parseStoreProduct('guerradigital',html.replace('171914','0'),url));});
test('Patoloco scopes microdata to main offers and rejects unverified store identity',()=>{const {html,url}=fixture('patoloco');const p=parseStoreProduct('patoloco',html,url);assert.equal(p.price,3457.31);assert.equal(p.original_price,4729.56);assert.equal(p.mpn,'56ISN8MDEHER');assert.ok(p.images.length);assert.throws(()=>parseStoreProduct('patoloco',html.replaceAll('29.823.090/0001-00','unknown'),url));});
test('out of stock remains distinct from missing/invalid availability and mismatched canonical',()=>{const {html,url}=fixture('bits');assert.equal(parseStoreProduct('oficinadosbits',html.replaceAll('/InStock','/OutOfStock'),url).available,false);assert.throws(()=>parseStoreProduct('oficinadosbits',html.replaceAll('/InStock','/Unknown'),url));assert.throws(()=>parseStoreProduct('oficinadosbits',html,url+'wrong'));});
test('RAM kits and notebook modules classify as RAM; GPU GDDR5 remains GPU',()=>{assert.equal(classify('Kit Memória Corsair 2x16GB DDR5 6000MHz'),'ram');assert.equal(classify('Memória para Notebook Kingston 16GB DDR4'),'ram');assert.equal(classify('Placa de vídeo GTX 1050 4GB GDDR5'),'gpu');assert.equal(classify('Kit Upgrade Ryzen 5 e placa mãe'),'kit');assert.equal(classify('Notebook Gamer RTX 5060 16GB DDR5 SSD 1TB'),'notebook');});
test('category spec alert matches different brands/models/stores against EACH product own history',()=>{const now=Date.now(),a={enabled:true,category:'ram',offer_id:null,product_id:null,max_price:null,min_discount:null,min_drop_amount:100,spec_filters:{total_gb:16,ddr:5,modules:1}} as Alert;for(const [i,brand]of ['Kingston','Corsair','XPG','Husky'].entries()){const o={store:['kabum','waz','guerradigital','patoloco'][i],id:'store-'+i,product_id:'model-'+i,category:'ram',title:brand+' 1x16GB DDR5 6000MHz',brand,specs:{},price:400+i*100,historical_median:500+i*100,historical_samples:5,historical_days:3,available:true,expires_at:new Date(now+60000).toISOString()} as Offer;assert.ok(matchesAlert(a,o,now));assert.equal(matchesAlert(a,{...o,historical_median:o.price+99},now),false);assert.equal(matchesAlert(a,{...o,title:brand+' 2x8GB DDR5 6000MHz'},now),false);assert.equal(matchesAlert({...a,brands:['other']},o,now),false);assert.equal(matchesAlert({...a,product_id:'exact',offer_id:'exact'},o,now),false);}});
test('discovery URL guards and round-robin prevent category monopolies',()=>{const source=sources.find(s=>s.id==='waz')!;assert.equal(productURL('https://evil.example/item/p',source),null);assert.equal(categoryURL('/hardware?order=price',source),null);assert.ok(categoryURL('/hardware?page=2',source));assert.deepEqual(diverseCandidates([{category:'ram',id:1},{category:'ram',id:2},{category:'gpu',id:3}],2).map(x=>x.id),[1,3]);assert.ok(retryMinutes(4)>retryMinutes(0));assert.equal(verificationTTL('history',25),15);assert.equal(verificationTTL('retailer',80),60);});
test('capacity-first admission keeps due rechecks ahead of new candidates',()=>{
 const due=Array.from({length:80},(_,i)=>({url:'r'+i,category:'ram'})),fresh=Array.from({length:30},(_,i)=>({url:'n'+i,category:i%2?'gpu':'ram'}));
 const full=planBatch(due,fresh,60);assert.equal(full.rechecks.length,54);assert.equal(full.pending.length,6);assert.equal(full.rechecks[0].url,'r0');
 const light=planBatch(due.slice(0,10),fresh,60);assert.equal(light.rechecks.length,10);assert.equal(light.pending.length,30);
 const tiny=planBatch(due,fresh,2);assert.deepEqual(tiny.rechecks.map(r=>r.url),['r0','r1']);assert.equal(tiny.pending.length,0);
 const idle=planBatch([],fresh,2);assert.equal(idle.pending.length,2);
 assert.equal(recheckMinutes(true,60),40);assert.equal(recheckMinutes(true,15),5);assert.equal(recheckMinutes(false,60),180);
});
test('WAZ OutOfStock without Pix price is confirmed unavailable, not a failure or a priced offer',()=>{
 const html=readFileSync(new URL('./fixtures/expansion/waz-out-of-stock.html',import.meta.url),'utf8'),url='https://www.waz.com.br/workstation-lenovo-thinkstation-p3-30gu003cbo-i7-14700-32gb-ddr5-ssd-512gb-rtx-a1000-8gb-wifi-6-w11-sl-1yr-os-133179-html/p';
 assert.throws(()=>parseStoreProduct('waz',html,url),ConfirmedUnavailable);
 assert.throws(()=>parseStoreProduct('waz',html.replace('OutOfStock','InStock'),url),/Preço Pix diverge/);
});
test('upgrade kits are CPU + motherboard bundles, never PCs, RAM kits or peripheral combos',()=>{
 const kit=['Kit Upgrade AMD Ryzen 5 5600 + Placa Mãe Gigabyte B550M Aorus Elite + Memória 16GB DDR4 3200MHz','Processador AMD Ryzen 3 3200G + Placa Mãe MSI A520M-A PRO','Kit Processador Intel Core i5-12400F + Placa-Mãe ASUS Prime H610M-E D4'];
 for(const t of kit)assert.equal(classify(t),'kit',t);
 assert.equal(classify('PC Gamer Ryzen 5 5600 Placa Mãe B550 16GB RTX 4060'),'pc');
 assert.equal(classify('Memória Kingston Fury Kit 2x16GB DDR4 3200MHz'),'ram');
 assert.equal(classify('Kit Teclado e Mouse Logitech MK270'),'peripherals');
 assert.equal(classify('Processador AMD Ryzen 5 5600, AM4, compatível com placa mãe B550'),'cpu');
 assert.equal(classify('Placa Mãe ASUS TUF B550M-Plus, AMD AM4, Ryzen 5000'),'motherboard');
 assert.deepEqual(kitComponents(kit[0]),{'Processador':'AMD Ryzen 5 5600','Placa-mãe':'Gigabyte B550M Aorus Elite','Memória':'16GB DDR4 3200MHz'});
 const offer={category:'kit',brand:'AMD',mpn:'100-100000927BOX',title:kit[1],specs:{}} as unknown as Offer;assert.equal(identityForOffer(offer),null);
 const kabum=sources.find(s=>s.id==='kabum')!;assert.ok(categoryURL('/hardware/kit-hardware/kit-upgrade?page_number=2',kabum));assert.ok(categoryURL('/espaco-gamer/cadeiras-gamer',kabum));assert.equal(categoryURL('/hardware/placas-mae?page_number=99',kabum),null);
});
test('KaBuM combo with abbreviated CPU after + is an upgrade kit, plain motherboard stays motherboard',()=>{
 assert.equal(classify('Placa Mãe MSI A520M-A PRO + 5 5500F + Air Cooler MACH1 ARTIC 120mm + Memória XPG 8GB'),'kit');assert.equal(kitComponents('Placa Mãe MSI A520M-A PRO + 5 5500F + Air Cooler')['Processador'],'5 5500F');
 assert.equal(classify('Placa Mãe MSI A520M-A PRO, AMD AM4, DDR4, Micro ATX'),'motherboard');
 assert.equal(classify('Placa Mãe ASUS B550M + Memória 16GB DDR4'),'motherboard');
});
test('discovery prefers registered category routes and keeps one lane for discovered subcategories',()=>{
 const o='https://x.test',seeds=new Set([o+'/kit',o+'/gpu']),due=[{url:o+'/a-sub'},{url:o+'/b-sub'},{url:o+'/kit'},{url:o+'/gpu'}];
 assert.deepEqual(pickDiscoveryPages(due,seeds,3).map(p=>p.url),[o+'/a-sub',o+'/kit',o+'/gpu']);
 assert.deepEqual(pickDiscoveryPages(due,seeds,1,0).map(p=>p.url),[o+'/kit']);
 assert.deepEqual(pickDiscoveryPages(due,seeds,1,1).map(p=>p.url),[o+'/a-sub']);
 assert.deepEqual(pickDiscoveryPages([{url:o+'/a-sub'}],seeds,3).map(p=>p.url),[o+'/a-sub']);
});
