import {test} from 'node:test';import assert from 'node:assert/strict';
import {currentSavedOffer,offerState} from '../lib/wishlist';import type {Offer} from '../lib/types';
const now=Date.now(),saved={id:'old',product_id:'canonical',brand:'Kingston',mpn:'KF560-32',available:true,expires_at:new Date(now-1000).toISOString(),price:700} as Offer;
test('expired favorites remain when no current offer exists',()=>{assert.equal(currentSavedOffer(saved,[],now),saved);assert.equal(offerState(saved,now),'expired');});
test('failed verification differs from confirmed out of stock',()=>{assert.equal(offerState({...saved,verification_status:'failed'} as Offer,now),'verification_failed');assert.equal(offerState({...saved,available:false},now),'out_of_stock');});
test('future offers in other stores renew saved canonical product without mutation',()=>{const future={...saved,id:'future',store:'pichau',price:500,expires_at:new Date(now+60000).toISOString()};assert.equal(currentSavedOffer(saved,[future],now),future);assert.equal(saved.id,'old');assert.equal(currentSavedOffer(saved,[{...future,product_id:'different',mpn:'different'}],now),saved);});
