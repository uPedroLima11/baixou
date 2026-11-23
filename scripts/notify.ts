import {createHmac} from 'node:crypto';
import {sendNotifications} from '../lib/notifications';
if(process.env.SMTP_USER&&process.env.SMTP_PASS){console.log(await sendNotifications());}else{
 const site=process.env.NEXT_PUBLIC_SITE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!site?.startsWith('https://')||!key)throw Error('Configuração de execução ausente');
 const time=String(Date.now()),signature=createHmac('sha256',key.trim()).update('notify:'+time).digest('hex');
 const r=await fetch(site+'/api/jobs/notifications',{method:'POST',headers:{'x-baixou-time':time,'x-baixou-signature':signature},signal:AbortSignal.timeout(55000)});
 if(!r.ok)throw Error('Notificações HTTP '+r.status);const result=await r.json();
 console.log(result.configured?String(result.sent)+' e-mails enviados.':'Gmail SMTP aguarda a senha de aplicativo; nenhum e-mail foi enviado.');
}
