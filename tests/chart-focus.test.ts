import {test} from 'node:test';import assert from 'node:assert/strict';
import {nearestChartPoint} from '../lib/chart-focus';
test('tooltip selects one actual point by both screen coordinates, rather than every series on the day',()=>{
 const a={id:'a',points:[{t:10,p:10},{t:30,p:12}],maxGap:20},b={id:'b',points:[{t:10,p:80}],maxGap:20};
 const hit=nearestChartPoint([a,b],{x:10,y:75},t=>t,p=>p,8);
 assert.equal(hit?.s.id,'b');assert.equal(hit?.p.p,80);
 assert.equal(nearestChartPoint([a,b],{x:20,y:75},t=>t,p=>p,8),null,'no invented point through a gap');
 assert.equal(nearestChartPoint([],{x:10,y:75},t=>t,p=>p,8),null);
});
