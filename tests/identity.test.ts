import {test} from 'node:test';import assert from 'node:assert/strict';import {identityForOffer,validGTIN,variantForOffer,variantsCompatible,matchesProductAlert,cheapestPerProduct,notificationKey} from '../lib/identity';import {matchesQuery,sameProduct} from '../lib/search';import type {Offer,Alert} from '../lib/types';
const base={id:'a',title:'Kingston Fury Beast 1x32GB DDR5 6000MHz',brand:'Kingston',mpn:'KF560C36BBE-32',category:'ram',specs:{},price:499,product_id:'p1',variant:{modules:1,per_module_gb:32,total_gb:32,ddr:'5'}} as unknown as Offer;
test('same manufacturer part and brand tolerate listing format differences',()=>{const a=identityForOffer(base),b=identityForOffer({...base,title:'Memória Kingston 32 GB 6000 MHz',mpn:'KF560C36BBE/32',brand:'Kingston Technology'});assert.equal(a?.brand,b?.brand);assert.equal(a?.mpn,b?.mpn);});
test('GTIN checksum rejects invalid/store codes and accepts standard code',()=>{assert.ok(validGTIN('4006381333931'));assert.equal(validGTIN('4006381333932'),false);assert.equal(validGTIN('131176'),false);});
test('1x32 and 2x16 variants remain distinct despite total32',()=>{const kit=variantForOffer({...base,title:'Kit Memória Kingston 2x16GB DDR5 6000MHz'});assert.equal(kit.modules,2);assert.equal(kit.total_gb,32);assert.equal(variantsCompatible(base.variant,kit),false);});
test('product alert follows a future offer in another store',()=>{const alert={offer_id:'a',product_id:'p1',product_variant:base.variant,max_price:500} as Alert;assert.ok(matchesProductAlert(alert,{...base,id:'future-other-store',store:'pichau'}));assert.equal(matchesProductAlert(alert,{...base,product_id:'p2'}),false);assert.equal(matchesProductAlert(alert,{...base,variant:{modules:2,total_gb:32}}),false);});
test('lowest store retained and dedup key does not use listing id',()=>{const cheaper={...base,id:'b',store:'amazon',price:450};assert.equal(cheapestPerProduct([base,cheaper]).length,1);assert.equal(cheapestPerProduct([base,cheaper])[0].id,'b');assert.equal(notificationKey(base),notificationKey(cheaper));});
test('legacy unidentified alerts stay scoped rather than guessing',()=>{assert.equal(matchesProductAlert({offer_id:'a'} as Alert,{...base,id:'b'}),false);assert.equal(identityForOffer({...base,mpn:'32GB',brand:null}),null);});
test('search handles unordered words, accents and capacity spacing',()=>{assert.ok(matchesQuery({...base,title:'Memória RAM Kingston Fury 32 GB DDR 5 6000 MHz'},'6000 kingston memoria 32gb'));});

test('manufacturer code comes from store data only: parentheses, single-token MPN, part code in title, model name',async()=>{
 const {manufacturerCode,canonicalBrand}=await import('../lib/identity');
 assert.equal(manufacturerCode('RTX 5070 INFINITY 3 (NE75070019K9-GB2050S)','Placa de Video Palit RTX 5070'),'NE75070019K9GB2050S');
 assert.equal(manufacturerCode('KF432C16BB/8','Memória Kingston'),'KF432C16BB8');
 assert.equal(manufacturerCode('TUF GAMING B760M-PLUS II','Placa Mãe ASUS TUF GAMING B760M-PLUS II, Intel LGA 1700, mATX, DDR5, Preto - 90MB1HD0-M0EAY0'),'90MB1HD0M0EAY0');
 assert.equal(manufacturerCode('B550M-A PRO','Placa-Mãe MSI B550M-A PRO, AMD, AM4, Micro-ATX, DDR4'),'B550MAPRO');
 assert.equal(manufacturerCode(null,'MSI PRO B650M-P, Chipset B650, AMD AM5, M-ATX, DDR5 (911-7E27-006)'),'9117E27006');
 assert.equal(manufacturerCode(null,'Notebook Asus Vivobook Go 15, Tela 15,6" FHD, Black - E1504FA-NJ825W'),'E1504FANJ825W');
 assert.equal(manufacturerCode(null,'Placa De Vídeo Gigabyte Rtx 5060 Eagle Oc 8gb Gddr7'),null);
 assert.equal(manufacturerCode('16GB','Memória 16GB'),null);assert.equal(manufacturerCode(null,'Mouse Gamer - 16000DPI'),null);
 assert.equal(canonicalBrand('RYZEN'),'amd');assert.equal(canonicalBrand('Palit Microsystem'),'palit');assert.equal(canonicalBrand('XPG'),'adata');assert.equal(canonicalBrand('Kingston Fury'),'kingston');
});

test('real store title and technical sheet with different AMD codes cannot identify the product',async()=>{
 const {manufacturerConflict,manufacturerCode}=await import('../lib/identity');
 const title='Processador AMD Ryzen 5 5500 - 100-100000457BOX';
 assert.equal(manufacturerConflict('100-100000651WOF',title),true);
 assert.equal(manufacturerCode('100-100000651WOF',title),null);
 assert.equal(identityForOffer({...base,mpn:'100-100000651WOF',title}),null);
 assert.equal(manufacturerConflict('9600X','Ryzen 5 9600X - 100-100001405WOF'),false);
 assert.equal(manufacturerConflict('AG15-71P-53D9','Notebook Acer AG15-71P-53D9 - NX.JH6AL.001'),false);
});
test('trailing part numbers after a comma or a Mercado Livre variant suffix are store data, not guesses',async()=>{
 const {manufacturerCode}=await import('../lib/identity');
 // Títulos reais (23/11/2026).
 assert.equal(manufacturerCode(null,'Cooler Para Gabinete T-Dagger 120mm Led Vermelho, T-TGF200-R'),'TTGF200R');
 assert.equal(manufacturerCode(null,'Processador Intel Core i7 14700F, 3.4 GHz (5.4GHz Turbo), 14ª Geração, 20-Cores 28-Threads, LGA 1700, BX8071514700F'),'BX8071514700F');
 assert.equal(manufacturerCode(null,'Fonte Corsair Cx750 750w 80 Plus Bronze - Cp-9020279-br Cor Preto'),'CP9020279BR');
 // Especificações no fim nunca viram código.
 for(const t of ['Mouse Gamer, 16000DPI','Memória Kingston, 3200MHz','Placa-mãe, LGA1700','Monitor, 1920X1080','Teclado Gamer, RGB','Kit, 2X16GB'])assert.equal(manufacturerCode(null,t),null,t);
 // Sem código no fim, nada é inferido do meio do título.
 assert.equal(manufacturerCode(null,'interno Adata Ultimate SU650 ASU650SS-480GT-R 480GB preto'),null);
});
