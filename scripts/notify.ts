import {triggerNotifications} from './notify-trigger';
const result=await triggerNotifications();
console.log(result.configured===false?'SMTP não configurado; nenhum e-mail foi enviado.':String(result.sent)+' e-mails enviados.');
