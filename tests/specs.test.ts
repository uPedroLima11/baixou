import {test} from 'node:test';import assert from 'node:assert/strict';
import {offerFacets,matchesSpecFilter,facetLabel} from '../lib/specs';
import {matchesAlert} from '../lib/alert-rules';
import type {Alert,Offer} from '../lib/types';
const now=Date.parse('2026-11-23T12:00:00Z');
const offer=(title:string,category:Offer['category'],extra:Partial<Offer>={}):Offer=>({id:title,store:'kabum',url:'https://www.kabum.com.br/produto/1',title,category,brand:null,mpn:null,image:null,images:[],price:500,original_price:null,available:true,seller:'KaBuM!',sold:null,rating:null,review_count:null,specs:{},checked_at:new Date(now).toISOString(),expires_at:new Date(now+3600000).toISOString(),historical_median:null,historical_samples:0,historical_days:0,discount:0,evidence:'none',...extra});
test('real titles produce conservative technical facets',()=>{
 const ram=offerFacets(offer('Memória DDR4 - 16GB (1x 16GB) / 3.200MHz - Smart - SMU4WEC8C2J3464SAG','ram'));
 assert.equal(ram.ddr,'4');assert.equal(ram.total_gb,16);assert.equal(ram.frequency,3200);assert.equal(ram.modules,1);assert.equal(ram.per_module_gb,16);
 const kit=offerFacets(offer('Memória RAM Kingston Fury Beast, RGB, 32GB (2x16GB), 5600MHz, DDR5, CL36, Branco','ram'));
 assert.equal(kit.total_gb,32);assert.equal(kit.per_module_gb,16);assert.equal(kit.modules,2);
 const gpu=offerFacets(offer('Placa de Vídeo Gigabyte RTX 5070 WINDFORCE OC SFF 12G NVIDIA GeForce, 12GB GDDR7','gpu',{brand:'Gigabyte'}));
 assert.equal(gpu.chip_vendor,'nvidia');assert.equal(gpu.gpu_model,'RTX 5070');assert.equal(gpu.vram_gb,12);assert.equal(gpu.brand,'gigabyte');
 assert.equal(offerFacets(offer('Sapphire RX 9060 XT PULSE AMD Radeon, 16GB, GDDR6','gpu')).gpu_model,'RX 9060 XT');
 const cpu=offerFacets(offer('Processador Intel Core i5-12400F, 2.5GHz (4.4GHz Max Turbo), Cache 18MB, 6 Núcleos, LGA 1700','cpu'));
 assert.equal(cpu.cpu_vendor,'intel');assert.equal(cpu.cpu_family,'Core i5');assert.equal(cpu.cpu_series,'12ª geração');assert.equal(cpu.socket,'LGA1700');assert.equal(cpu.cores,6);
 const mb=offerFacets(offer('Placa Mãe ASUS TUF GAMING B760M-PLUS II, Intel LGA 1700, mATX, DDR5, Preto','motherboard'));
 assert.equal(mb.chipset,'B760');assert.equal(mb.form_factor,'Micro-ATX');assert.equal(mb.ddr,'5');assert.equal(mb.socket,'LGA1700');
 const mon=offerFacets(offer('Monitor Gamer LG UltraGear 27G411B, 27", Full HD, IPS, 144Hz, 1ms','monitor'));
 assert.equal(mon.size_in,27);assert.equal(mon.resolution_label,'Full HD');assert.equal(mon.refresh_hz,144);assert.equal(mon.panel,'IPS');
 const nb=offerFacets(offer('Notebook Gamer Acer Nitro V15 Intel Core i5-13420H, 8GB RAM, 512GB SSD, RTX 4050','notebook'));
 assert.equal(nb.cpu_vendor,'intel');assert.equal(nb.ram_gb,8);assert.equal(nb.storage_gb,512);assert.equal(nb.gpu_type,'dedicada');assert.equal(nb.gpu_model,'RTX 4050');assert.equal(nb.use,'gamer');
 // Desconhecido não é inventado.
 assert.equal(offerFacets(offer('Monitor Samsung Odyssey','monitor')).refresh_hz,undefined);
 assert.equal(facetLabel('total_gb',1000),'1 TB');assert.equal(facetLabel('ddr','5'),'DDR5');
});
test('filters combine values (OR) and keys (AND), minimums are numeric, unknown never matches',()=>{
 const s={chip_vendor:'nvidia',vram_gb:12};
 assert.ok(matchesSpecFilter(s,{chip_vendor:['nvidia','amd'],vram_gb_min:12}));
 assert.equal(matchesSpecFilter(s,{vram_gb_min:16}),false);
 assert.equal(matchesSpecFilter({chip_vendor:'nvidia'},{vram_gb_min:8}),false);
 assert.ok(matchesSpecFilter({socket:'LGA1700'},{socket:'lga 1700'}));
});
test('owner examples: any DDR5 16GB R$100 below history; any NVIDIA with >=12GB VRAM under a price',()=>{
 const hist={historical_median:600,historical_samples:8,historical_days:4,evidence:'history' as const,discount:17};
 const ddr5=offer('Memória RAM XPG Lancer, 16GB, 6000MHz, DDR5, CL30','ram',{...hist,price:490,brand:'XPG',store:'waz'});
 const ddr4=offer('Memória RAM Kingston Fury Beast, 16GB, 3200MHz, DDR4','ram',{...hist,price:400});
 const alert:Alert={enabled:true,category:'ram',offer_id:null,max_price:null,min_discount:null,min_drop_amount:100,spec_filters:{ddr:'5',total_gb:16}};
 assert.ok(matchesAlert(alert,ddr5,now));assert.equal(matchesAlert(alert,ddr4,now),false);
 assert.equal(matchesAlert(alert,{...ddr5,price:520},now),false);
 const gpuAlert:Alert={enabled:true,category:'gpu',offer_id:null,max_price:3500,min_discount:null,min_drop_amount:null,spec_filters:{chip_vendor:['nvidia'],vram_gb_min:12}};
 assert.ok(matchesAlert(gpuAlert,offer('Placa de Vídeo MSI RTX 5070 12GB GDDR7','gpu',{price:3299}),now));
 assert.equal(matchesAlert(gpuAlert,offer('Placa de Vídeo MSI RTX 5060 8GB GDDR7','gpu',{price:1999}),now),false);
 assert.equal(matchesAlert(gpuAlert,offer('Placa de Vídeo Sapphire RX 9070 16GB','gpu',{price:3299}),now),false);
});

import {offerFacets as facetsMT} from '../lib/specs';
test('RAM frequency in MT/s is the same as MHz (Kingston Fury Beast KF432C16BB/16)',()=>{
 const f=facetsMT({title:'Memoria RAM Kingston Fury  Beast, 16GB, 3200MT/s, DDR4, CL16, DIMM,  Preto - KF432C16BB/16',category:'ram',specs:{},brand:'Kingston'} as any);
 assert.equal(f.frequency,3200);assert.equal(f.ddr,'4');assert.equal(f.total_gb,16);assert.equal(f.form_factor,'desktop');
});
