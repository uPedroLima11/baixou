import {test} from 'node:test';import assert from 'node:assert/strict';
import {searchableCode,sameCodeUrl} from '../scripts/targeted';
test('targeted discovery: only strong manufacturer codes are searched and only same-code results accepted',()=>{
 assert.equal(searchableCode('KF432C16BB/16'),'kf432c16bb16');assert.equal(searchableCode('G305'),null);assert.equal(searchableCode('Fury Beast'),null);
 assert.equal(sameCodeUrl('https://www.kabum.com.br/produto/172366/memoria-ram-kingston-fury-beast-16gb-3200mhz-ddr4-cl16-preto-kf432c16bb1-16','kf432c16bb116'),true);
 assert.equal(sameCodeUrl('https://www.kabum.com.br/produto/172365/memoria-ram-kingston-fury-beast-8gb-3200mhz-ddr4-cl16-preto-kf432c16bb-8','kf432c16bb16'),false);
});
