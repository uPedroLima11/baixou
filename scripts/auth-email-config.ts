// Preparação somente local. Não chama APIs, não lê credenciais e não envia e-mails.
import {authTemplateEntries,authTemplatePatch} from '../supabase/templates/config';
const patch=authTemplatePatch();
if(process.argv.includes('--json'))console.log(JSON.stringify(patch));
else console.log(JSON.stringify({templates:authTemplateEntries().length,fields:Object.keys(patch),remote_changed:false,smtp_changed:false}));
