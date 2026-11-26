import {test} from 'node:test';import assert from 'node:assert/strict';
import {encodeSnapshot,decodeSnapshot} from '../lib/catalog-snapshot';import type {Offer} from '../lib/types';
test('shared public snapshot preserves verification, expiry and delta cursor exactly; packing never renews data',()=>{
 const s={at:123456789,since:'2026-11-26T21:00:00Z',offers:[{id:'old',checked_at:'2026-11-26T20:00:00Z',expires_at:'2026-11-26T21:00:00Z',title:'Memória à vista',price:123.45,verification_status:'announced'} as Offer]};
 assert.deepEqual(decodeSnapshot(encodeSnapshot(s)),s);
 assert.throws(()=>decodeSnapshot('invalid'));
});
