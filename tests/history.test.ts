import {test} from 'node:test';import assert from 'node:assert/strict';
import {availablePeriods,closeDaysAgo,dailyLowest,describeTrend,periodStats,segments,spDay,DAY,type DailyPoint} from '../lib/history';
const now=Date.parse('2026-12-20T15:00:00Z');
const day=(n:number)=>spDay(now-n*DAY);
const d=(n:number,close:number,min=close,max=close,samples=3):DailyPoint=>({day:day(n),min,max,close,samples});

test('collection gaps break the line; nothing is interpolated',()=>{
 const h=3600000,s=segments([{t:0,p:1},{t:h,p:1},{t:2*h,p:1},{t:12*h,p:2},{t:13*h,p:2}],6*h);
 assert.equal(s.length,2);assert.deepEqual(s.map(x=>x.length),[3,2]);
});

test('periods unlock only when history covers the previous period',()=>{
 const two=availablePeriods(now-2*DAY,now);assert.deepEqual(two.map(p=>p.enabled),[true,true,false,false,false]);
 const forty=availablePeriods(now-40*DAY,now);assert.deepEqual(forty.map(p=>p.enabled),[true,true,true,false,false]);
 assert.deepEqual(availablePeriods(null,now).map(p=>p.enabled),[true,true,false,false,false]);
});

test('price N days ago uses that day (or the day before), never a later or invented value',()=>{
 const daily=[d(8,100),d(3,90),d(0,80)];
 assert.equal(closeDaysAgo(daily,7,now),100);// dia 7 sem dado, usa dia 8
 assert.equal(closeDaysAgo(daily,2,now),90);// dia 2 sem dado, usa dia 3
 assert.equal(closeDaysAgo(daily,30,now),null);
});

test('period stats: min, max, median and change from real points',()=>{
 const s=periodStats([{t:3,p:120},{t:1,p:100},{t:2,p:90}])!;
 assert.equal(s.low,90);assert.equal(s.high,120);assert.equal(s.median,100);assert.equal(s.first.p,100);assert.equal(s.last.p,120);assert.ok(Math.abs(s.change-0.2)<1e-9);
});

test('trend stays "forming" with under 3 days or 5 samples (no prediction)',()=>{
 assert.equal(describeTrend([d(1,100),d(0,100)],100,now).kind,'forming');
 assert.equal(describeTrend([d(2,100,100,100,1),d(1,100,100,100,1),d(0,100,100,100,1)],100,now).kind,'forming');
 assert.equal(describeTrend([d(2,100),d(1,100),d(0,100)],null,now).kind,'forming');
});

test('descriptive signals: at the observed low, below median, fell in 7 days',()=>{
 const daily=[d(10,1200),d(9,1200),d(8,1190),d(7,1180),d(5,1100),d(3,1000),d(1,900),d(0,850)];
 const t=describeTrend(daily,850,now);assert.equal(t.kind,'ready');
 const texts=t.kind==='ready'?t.signals.map(s=>s.text).join(' | '):'';
 assert.match(texts,/No menor preço observado/);assert.match(texts,/abaixo da mediana/);assert.match(texts,/Caiu 27,9% em 7 dias/);
});

test('stable series is described as stable, rising one as above median',()=>{
 const flat=Array.from({length:8},(_,i)=>d(i,500,499,501));
 const t=describeTrend(flat,500,now);assert.ok(t.kind==='ready'&&t.signals.some(s=>/Estável há 8 dias/.test(s.text)));
 const up=[d(9,500),d(8,500),d(7,500),d(1,560),d(0,560)];
 const u=describeTrend(up,560,now);assert.ok(u.kind==='ready'&&u.signals.some(s=>/acima da mediana/.test(s.text))&&u.signals.some(s=>/Subiu 12% em 7 dias/.test(s.text)));
});

test('lowest across stores keeps the store of each daily minimum',()=>{
 const low=dailyLowest([{label:'KaBuM!',daily:[d(1,100),d(0,95)]},{label:'WAZ',daily:[d(1,98,97,99),d(0,96)]}]);
 assert.deepEqual(low.map(x=>[x.price,x.label]),[[97,'WAZ'],[95,'KaBuM!']]);
});
import {dailySeries} from '../lib/history';
test('daily series: one point per observed day (the day low), today partial with the verified current price',()=>{
 const daily=[d(3,110,105,120,4),d(1,100,98,101,5),d(0,97,96,97,2)];
 const s=dailySeries(daily,7,95,now);
 assert.deepEqual(s.map(x=>[x.day,x.p,x.partial]),[[day(3),105,false],[day(1),98,false],[day(0),95,true]]);// dia 2 sem coleta: sem ponto
 assert.equal(s[2].close,95);assert.equal(s[0].max,120);
 assert.equal(new Set(s.map(x=>x.day)).size,s.length);
 assert.deepEqual(dailySeries(daily,2,null,now).map(x=>x.day),[day(1),day(0)]);// janela de 2 dias
 assert.deepEqual(dailySeries([],7,90,now).map(x=>[x.p,x.partial,x.samples]),[[90,true,1]]);// só o preço verificado de hoje
});
