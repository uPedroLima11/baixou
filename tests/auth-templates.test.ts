import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AUTH_TEMPLATE_KEYS,authTemplateEntries,authTemplatePatch} from '../supabase/templates/config';

test('Auth template patch can change content and subjects only; never SMTP or security settings',()=>{
 const patch=authTemplatePatch();
 assert.equal(Object.keys(patch).length,AUTH_TEMPLATE_KEYS.length*2);
 for(const key of Object.keys(patch))assert.match(key,/^mailer_(?:subjects_[a-z_]+|templates_[a-z_]+_content)$/);
 assert.equal(Object.keys(patch).some(k=>/smtp|enabled|redirect|autoconfirm|hook/.test(k)),false);
});

test('Auth confirmation and recovery preserve the original Supabase verification URL and useful preview',()=>{
 const patch=authTemplatePatch();
 for(const key of ['confirmation','recovery','invite','magic_link','email_change']){
  const content=patch['mailer_templates_'+key+'_content'];
  assert.match(content,/href="{{ \.ConfirmationURL }}"/);
  assert.doesNotMatch(content,/token_hash=|redirect_to=|\/auth\/v1\/verify/);
  assert.match(content,/mso-hide:all/);
  assert.match(content,/<html lang="pt-BR">/);
 }
 assert.match(patch.mailer_templates_reauthentication_content,/{{ \.Token }}/);
 assert.doesNotMatch(patch.mailer_subjects_reauthentication,/\.Token/);
});

test('Every Auth message has local text QA copy; security notifications do not invent action tokens',()=>{
 for(const entry of authTemplateEntries()){
  const text=readFileSync(new URL('../supabase/templates/'+entry.text,import.meta.url),'utf8');
  assert.match(text,/Baixou!/);
  const content=authTemplatePatch()['mailer_templates_'+entry.key+'_content'];
  assert.doesNotMatch(content,/<script|javascript:|data:image|<svg/i);
  if(entry.security){assert.doesNotMatch(content,/\.ConfirmationURL|\.Token/);assert.match(content,/\.SiteURL/);}
 }
});
