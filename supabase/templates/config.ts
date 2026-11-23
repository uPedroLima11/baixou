import {readFileSync} from 'node:fs';

export const AUTH_TEMPLATE_KEYS=[
 'confirmation','recovery','invite','magic_link','email_change','reauthentication',
 'password_changed_notification','email_changed_notification','phone_changed_notification',
 'identity_linked_notification','identity_unlinked_notification',
 'mfa_factor_enrolled_notification','mfa_factor_unenrolled_notification',
] as const;
type AuthTemplateKey=typeof AUTH_TEMPLATE_KEYS[number];
export type AuthTemplateEntry={key:AuthTemplateKey;subject:string;html:string;text:string;security:boolean};

export function authTemplateEntries():AuthTemplateEntry[]{
 const entries=JSON.parse(readFileSync(new URL('./manifest.json',import.meta.url),'utf8')) as AuthTemplateEntry[];
 if(entries.length!==AUTH_TEMPLATE_KEYS.length||new Set(entries.map(e=>e.key)).size!==entries.length)throw Error('Manifesto Auth incompleto');
 for(const entry of entries){
  if(!AUTH_TEMPLATE_KEYS.includes(entry.key)||entry.html!==entry.key+'.html'||entry.text!==entry.key+'.txt'||entry.security!==entry.key.endsWith('_notification'))throw Error('Template Auth inesperado');
  if(!entry.subject.startsWith('Baixou!')||/[\r\n]/.test(entry.subject))throw Error('Assunto Auth inválido');
 }
 return entries;
}

// Payload parcial do PATCH /v1/projects/{ref}/config/auth. Nunca inclui SMTP, URLs, flags ou secrets.
export function authTemplatePatch():Record<string,string>{
 const patch:Record<string,string>={};
 for(const entry of authTemplateEntries()){
  const content=readFileSync(new URL('./'+entry.html,import.meta.url),'utf8');
  patch['mailer_subjects_'+entry.key]=entry.subject;
  patch['mailer_templates_'+entry.key+'_content']=content;
 }
 return patch;
}
