import {test} from 'node:test';import assert from 'node:assert/strict';
import {assertNewProduct,excludedCondition,ExcludedProduct} from '../lib/product-policy';
test('recertified store GPUs are policy exclusions, without confusing normal marketing text',()=>{
 for(const title of ['Sapphire Nitro+ RX 7800 XT (RECERTIFICADA)','Placa RTX 5060 Open Box','Memória Recondicionada','RTX 3060 seminova','Placa Refurbished']){assert.ok(excludedCondition(title));assert.throws(()=>assertNewProduct(title),ExcludedProduct);}
 for(const title of ['Gabinete para visual de vitrine','Placa MSI RTX 5060 Ventus OC','Memória usada para desktop'])assert.equal(excludedCondition(title),title.includes('usada'));
});
