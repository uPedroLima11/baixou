import {test} from 'node:test';import assert from 'node:assert/strict';
import {ramGroup,gpuGroup,snapshot,panel,groupPanel,chainIndex,type StatOffer} from '../lib/stats';
const live=new Date(Date.now()+3600000).toISOString();
const o=(id:string,title:string,price:number,extra:Partial<StatOffer>={}):StatOffer=>({id,title,price,store:'kabum',category:'ram',brand:'Kingston',specs:{},variant:{},url:'https://x/'+id,seller:'KaBuM!',seller_key:null,payment_basis:'cash',available:true,expires_at:live,image:null,...extra} as StatOffer);
test('RAM groups never mix module with kit, kit splits, DDR generations, notebook or server memory',()=>{
 const k=(t:string)=>ramGroup(o('a',t,1))?.key??null;
 assert.equal(k('Memória Kingston Fury Beast 16GB DDR5 5600MHz'),'ddr5|desktop|módulo|16');
 assert.equal(k('Kit Memória Kingston Fury 32GB (2x16GB) DDR5 6000MHz'),'ddr5|desktop|kit 2×16 GB|32');
 assert.equal(k('Memória 32GB (4x8GB) DDR5'),'ddr5|desktop|kit 4×8 GB|32');
 assert.equal(k('Memória Kingston 16GB DDR4 3200MHz'),'ddr4|desktop|módulo|16');
 assert.equal(k('MEMORIA S-DIMM DDR4 04GB/3200 ADATA'),'ddr4|notebook|módulo|4');
 assert.equal(k('Memória Notebook Kingston 8GB DDR4 SODIMM'),'ddr4|notebook|módulo|8');
 assert.equal(k('Memória DDR4 Smart ECC Server, 8GB, 3200MHz'),'ddr4|servidor|módulo|8');
 assert.equal(k('Kit Memória DDR5 32GB 6000MHz'),null);// kit sem divisão: fora
 assert.equal(k('Memória Kingston 16GB 3200MHz'),null);// geração desconhecida: fora
});
test('GPU groups keep exact model and VRAM (5070 ≠ 5070 Ti; 8 GB ≠ 16 GB)',()=>{
 const k=(t:string)=>gpuGroup(o('g',t,1,{category:'gpu'}))?.key??null;
 assert.equal(k('Placa de Vídeo RTX 5070 Gigabyte Windforce 12GB GDDR7'),'RTX 5070|12');
 assert.equal(k('Placa de Vídeo RTX 5070 Ti ASUS TUF 16GB GDDR7'),'RTX 5070 Ti|16');
 assert.equal(k('Placa de Vídeo RTX 5060 Ti 8GB'),'RTX 5060 Ti|8');
 assert.equal(k('Placa de Vídeo RTX 5060 Ti 16GB'),'RTX 5060 Ti|16');
 assert.equal(k('Placa de Vídeo RX 9070 XT 16GB'),'RX 9070 XT|16');
 assert.equal(k('Placa de Vídeo GeForce RTX 5070'),null);// sem VRAM: fora
});
test('snapshot: only live cash-comparable offers; per-GB and seller counts',()=>{
 const list=[o('a','Memória 16GB DDR5',800),o('b','Memória 16GB DDR5',1000,{store:'waz',seller:'WAZ'}),o('c','Memória 16GB DDR5',500,{store:'mercadolivre',payment_basis:null,seller:'X'}),o('d','Memória 16GB DDR5',100,{available:false})];
 const [g]=snapshot(list,ramGroup);assert.equal(g.offers,2);assert.equal(g.sellers,2);assert.equal(g.low,800);assert.equal(g.median,900);assert.equal(g.perGbLow,50);assert.equal(g.best.id,'a');
});
test('consistent panel: needs a base and a recent observation; 2% threshold',()=>{
 const rows=[{offer_id:'a',base_day:'2026-11-20',base_price:100,last_day:'2026-11-27',last_price:90},{offer_id:'b',base_day:'2026-11-20',base_price:100,last_day:'2026-11-27',last_price:101},{offer_id:'c',base_day:null,base_price:null,last_day:'2026-11-27',last_price:50},{offer_id:'d',base_day:'2026-11-20',base_price:100,last_day:'2026-11-21',last_price:200}];
 const {panel:p,changes}=panel(rows,'2026-11-26');assert.equal(p.offers,2);assert.equal(p.down,1);assert.equal(p.stable,1);assert.equal(p.up,0);
 assert.equal(groupPanel(['a','c','zz'],changes).offers,1);
});
test('chained index starts at 100 and breaks (null) on thin days',()=>{
 const r=chainIndex([{day:'1',offers:0,ratio:null},{day:'2',offers:10,ratio:0.9},{day:'3',offers:2,ratio:2},{day:'4',offers:8,ratio:1.1}]);
 assert.deepEqual(r.map(x=>x.value==null?null:Math.round(x.value*100)/100),[100,90,null,99]);
});
