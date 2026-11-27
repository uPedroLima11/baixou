import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withRetry,transientError} from '../lib/db-retry';
test('statement timeout and network failures are retried; SQL errors are not',async()=>{
 assert.equal(transientError({code:'57014',message:'canceling statement due to statement timeout'}),true);
 assert.equal(transientError({message:'TypeError: fetch failed'}),true);
 assert.equal(transientError({code:'42703',message:'column does not exist'}),false);
 assert.equal(transientError(null),false);
 let n=0;const r=await withRetry(async()=>(++n<3?{error:{code:'57014'}}:{error:null,data:[1]}),[1,1]);
 assert.equal(n,3);assert.deepEqual((r as {data:number[]}).data,[1]);
 let m=0;await withRetry(async()=>{m++;return {error:{code:'42501',message:'permission denied'}};},[1,1]);
 assert.equal(m,1);
 let k=0;const last=await withRetry(async()=>{k++;return {error:{code:'57014'}};},[1,1]);
 assert.equal(k,3);assert.equal(last.error?.code,'57014');
});
