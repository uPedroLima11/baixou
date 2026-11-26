import {test} from 'node:test';import assert from 'node:assert/strict';import {equivalentGroup} from '../lib/groups';import type {StatOffer} from '../lib/stats';
const o=(title:string,category='ssd',specs:Record<string,string>={}):StatOffer=>({title,category,specs,variant:{}} as StatOffer);
test('equivalent alternatives preserve explicit NAND and GPU memory types; unknown quality is never inferred',()=>{
 const tlc=o('SSD NVMe PCIe 4.0 1TB TLC'),qlc=o('SSD NVMe PCIe 4.0 1TB QLC'),unknown=o('SSD NVMe PCIe 4.0 1TB');
 assert.notEqual(equivalentGroup(tlc)?.key,equivalentGroup(qlc)?.key);assert.notEqual(equivalentGroup(qlc)?.key,equivalentGroup(unknown)?.key);
 assert.notEqual(equivalentGroup(o('SSD NVMe PCIe 4.0 1TB TLC com DRAM'))?.key,equivalentGroup(o('SSD NVMe PCIe 4.0 1TB TLC sem DRAM'))?.key);
 assert.notEqual(equivalentGroup(o('Placa RTX 3060 12GB GDDR6','gpu'))?.key,equivalentGroup(o('Placa RTX 3060 12GB GDDR6X','gpu'))?.key);
 assert.equal(equivalentGroup(o('Memória 16GB DDR4 3200MHz CL16','ram')),null,'unknown RAM usage stays unknown');
 assert.equal(equivalentGroup(o('Placa RX 7800 XT 16GB RECERTIFICADA','gpu')),null);
});
