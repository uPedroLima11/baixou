import {createHmac} from 'node:crypto';
import {sendNotifications} from '../lib/notifications';
// Dispara o envio de alertas: localmente se houver SMTP; senão pela rota assinada da Vercel (onde o SMTP existe).
export async function triggerNotifications(){
 if(process.env.SMTP_USER&&process.env.SMTP_PASS)return sendNotifications();
 const site=process.env.NEXT_PUBLIC_SITE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!site?.startsWith('https://')||!key)throw Error('Configuração de execução ausente');
 const time=String(Date.now()),signature=createHmac('sha256',key.trim()).update('notify:'+time).digest('hex');
 const r=await fetch(site+'/api/jobs/notifications',{method:'POST',headers:{'x-baixou-time':time,'x-baixou-signature':signature},signal:AbortSignal.timeout(55000)});
 if(!r.ok)throw Error('Notificações HTTP '+r.status);return r.json();
}
// Limita a uma chamada a cada intervalo (padrão 2 min), para que ofertas confirmadas no início da coleta não envelheçam além de 5 min.
export function throttledNotifier(intervalMs=120000){let last=Date.now();return async()=>{if(Date.now()-last<intervalMs)return;last=Date.now();const r=await triggerNotifications();if(r&&typeof r==='object'&&'sent' in r&&Number(r.sent)>0)console.log(r.sent+' alertas enviados durante a coleta.');};}
