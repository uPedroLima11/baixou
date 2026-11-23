// Envia o modelo de alerta com uma oferta verificada real SOMENTE ao remetente (proprietário), marcado [TESTE].
// Executado pelo workflow manual email-preview.yml. SMTP só existe na Vercel: chama a rota assinada (HMAC).
// Não imprime credenciais nem destinatário.
import {createHmac} from 'node:crypto';
import {sendTemplatePreview} from '../lib/notifications';
if(process.env.SMTP_USER&&process.env.SMTP_PASS){const r=await sendTemplatePreview();console.log(JSON.stringify({configured:r.configured,sent:'sent' in r?r.sent:false,subject:'subject' in r?r.subject:undefined}));}
else{
 const site=process.env.NEXT_PUBLIC_SITE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(site!=='https://baixouofertas.vercel.app'||!key)throw Error('Configuração de execução ausente');
 const time=String(Date.now()),signature=createHmac('sha256',key.trim()).update('preview:'+time).digest('hex');
 const r=await fetch(site+'/api/jobs/notifications?check=preview',{method:'POST',headers:{'x-baixou-time':time,'x-baixou-signature':signature},signal:AbortSignal.timeout(55000)});
 const body=await r.json();console.log(JSON.stringify({status:r.status,configured:body.configured,sent:body.sent,subject:body.subject,offer:body.offer,error:body.error}));
 if(!r.ok||!body.sent)process.exit(1);
}
