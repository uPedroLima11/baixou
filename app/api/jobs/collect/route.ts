import {candidateSourceIds} from '@/scripts/sources';
import {sendNotifications} from '@/lib/notifications';
import {NextResponse} from 'next/server';
import {createHash,timingSafeEqual} from 'node:crypto';
import {runCollector} from '@/lib/collector';
export const runtime='nodejs';
export const maxDuration=60;
const scheduledStores=['kabum','waz','guerradigital','patoloco'];
export async function POST(req:Request){
 const expected=process.env.CRON_SECRET?.trim();if(!expected)return NextResponse.json({error:'unavailable'},{status:503});
 const incoming=(req.headers.get('authorization')??'').replace(/^Bearer /,'').trim();
 if(!timingSafeEqual(createHash('sha256').update(incoming).digest(),createHash('sha256').update(expected).digest()))return NextResponse.json({error:'unauthorized'},{status:401});
 const url=new URL(req.url),batch=url.searchParams.get('batch')==='1',store=url.searchParams.get('store')??'kabum';
 if(!batch&&!candidateSourceIds.includes(store))return NextResponse.json({error:'invalid_store'},{status:400});
 const started=Date.now(),cpu=process.cpuUsage();
 const results=await Promise.all((batch?scheduledStores:[store]).map(async store=>{
  try{return {store,...await runCollector({max:batch?6:10,stores:[store],deadlineMs:35000})};}
  catch{console.error('Falha de worker: '+store);return {store,total:0,failures:1,discovered:0,stock_only_checks:0,skipped:false};}
 }));
 let notifications:unknown=null;
 if(results.some(r=>r.total>0)){try{notifications=await sendNotifications({budgetMs:7000,maxEmails:1});}catch{notifications={error:'notification_failed'};}}
 const usage=process.cpuUsage(cpu);
 return NextResponse.json({total:results.reduce((n,r)=>n+r.total,0),failures:results.reduce((n,r)=>n+r.failures,0),discovered:results.reduce((n,r)=>n+r.discovered,0),skipped:results.every(r=>r.skipped),results,notifications,elapsed_ms:Date.now()-started,cpu_ms:Math.round((usage.user+usage.system)/1000)});
}
