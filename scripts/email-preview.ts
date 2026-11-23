// Envia o modelo de alerta com uma oferta verificada real SOMENTE ao remetente (proprietário), marcado [TESTE].
// Executar pelo workflow manual email-preview.yml (os segredos SMTP não podem ser baixados da Vercel).
// Não imprime credenciais nem destinatário.
import {sendTemplatePreview} from '../lib/notifications';
const r=await sendTemplatePreview();
console.log(JSON.stringify({configured:r.configured,sent:'sent' in r?r.sent:false,subject:'subject' in r?r.subject:undefined,offer:'offer' in r?r.offer:undefined}));
