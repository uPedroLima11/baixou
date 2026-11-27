import {NextResponse} from 'next/server';
import {createHash,timingSafeEqual} from 'node:crypto';
import {sendNotifications} from '@/lib/notifications';
import {whatsappMode} from '@/lib/whatsapp';
import {whatsappPulse} from '@/lib/whatsapp-session';
import {adminDb} from '@/lib/server';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
// Rotina AUTOMÁTICA de alertas (pg_cron do Supabase, a cada minuto; independe do GitHub, do navegador e do computador):
// 1) decide alertas sobre as ofertas verificadas nos últimos 3 min (mesma decisão de sempre; reserva atômica por canal,
//    então repetir não duplica) e envia e-mail / enfileira WhatsApp;
// 2) ciclo do WhatsApp: só conecta se houver fila, código aguardando ou ≥15 min sem conexão (PARAR é lido antes de
//    qualquer envio). Lease exclusivo impede ciclos simultâneos. Também recupera pendências de execuções que falharam.
export async function POST(req:Request){
 const expected=process.env.CRON_SECRET?.trim();if(!expected)return NextResponse.json({error:'unavailable'},{status:503});
 const incoming=(req.headers.get('authorization')??'').replace(/^Bearer /,'').trim();
 if(!timingSafeEqual(createHash('sha256').update(incoming).digest(),createHash('sha256').update(expected).digest()))return NextResponse.json({error:'unauthorized'},{status:401});
 const started=Date.now(),db=adminDb(),site=process.env.NEXT_PUBLIC_SITE_URL??'https://baixouofertas.vercel.app';
 let notifications:unknown=null,whatsapp:unknown=null;
 try{notifications=await sendNotifications({budgetMs:20000,windowMs:3*60000});}catch(e){notifications={error:'notification_failed'};console.error('alertas:',e instanceof Error?e.message.slice(0,200):String((e as {message?:unknown})?.message??'erro').slice(0,200));}
 if(whatsappMode()!=='off'){
  try{whatsapp=await whatsappPulse(db,{siteUrl:site,deadlineMs:Math.max(15000,53000-(Date.now()-started))});}catch(e){whatsapp={error:'whatsapp_failed'};console.error('WhatsApp:',e instanceof Error?e.message.slice(0,200):'erro');}
  await db.from('whatsapp_sender').update({last_cycle_at:new Date().toISOString(),last_cycle:{notifications,whatsapp,ms:Date.now()-started}}).eq('id',1);
 }
 return NextResponse.json({notifications,whatsapp,elapsed_ms:Date.now()-started});
}
