'use client';import {useEffect,useMemo,useState} from 'react';import type {User} from '@supabase/supabase-js';import {Bell,Plus,Trash2} from 'lucide-react';import {supabase} from '@/lib/supabase';import {FACETS,facetLabel,offerFacets,type SpecValue} from '@/lib/specs';import {categories,money,type Alert,type Offer} from '@/lib/types';
export function AuthForm({onSuccess}:{onSuccess:()=>void}){const [mode,setMode]=useState<'login'|'register'|'reset'>('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[message,msg]=useState(''),[busy,setBusy]=useState(false);const configured=!!supabase();return <><p className="muted">Salve os favoritos e acompanhe os preços que importam para você.</p><div className="tabs auth-tabs"><button className={mode==='login'?'active':''} onClick={()=>{setMode('login');msg('')}}>Entrar</button><button className={mode==='register'?'active':''} onClick={()=>{setMode('register');msg('')}}>Criar conta</button></div><form className="form-stack" onSubmit={async e=>{e.preventDefault();const db=supabase();if(!db){msg('O acesso às contas ainda está sendo ativado.');return;}setBusy(true);msg('');try{if(mode==='login'){const {error}=await db.auth.signInWithPassword({email,password});if(error)throw error;onSuccess();}else if(mode==='register'){const {data,error}=await db.auth.signUp({email,password,options:{data:{name},emailRedirectTo:location.origin+'/auth/callback'}});if(error)throw error;if(data.session)onSuccess();else msg('Confira seu e-mail para confirmar o cadastro.');}else{const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/auth/reset'});if(error)throw error;msg('Se existir uma conta com esse e-mail, você receberá o link de recuperação.');}}catch{msg('Não foi possível concluir. Confira os dados ou tente novamente em instantes.');}finally{setBusy(false)}}}>{mode==='register'&&<label>Seu nome<input value={name} onChange={e=>setName(e.target.value)} required maxLength={80} autoComplete="name"/></label>}<label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label>{mode!=='reset'&&<label>Senha<input type="password" required minLength={10} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='register'?'new-password':'current-password'}/>{mode==='register'&&<small>Pelo menos 10 caracteres.</small>}</label>}<button className="primary" disabled={busy||!configured}>{busy?'Aguarde…':mode==='login'?'Entrar na minha conta':mode==='register'?'Criar minha conta':'Enviar link de recuperação'}</button><p className="form-message" role="status">{message||(!configured?'Cadastro e acesso aguardam a ativação do serviço.':'')}</p></form><button className="text-button" onClick={()=>{setMode(mode==='reset'?'login':'reset');msg('')}}>{mode==='reset'?'Voltar para entrar':'Esqueci minha senha'}</button></>;}
// Perfil: nome, foto e dados da conta.
export function ProfileSettings({user,notify}:{user:User;notify:(s:string)=>void}){
 const [name,setName]=useState(user.user_metadata?.name??''),[busy,setBusy]=useState(false);
 return <div className="form-stack">
  <label>Nome<input value={name} maxLength={80} onChange={e=>setName(e.target.value)}/></label>
  <label>Foto de perfil<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>1048576||!['image/png','image/jpeg','image/webp'].includes(file.type)){notify('Use uma foto JPG, PNG ou WebP de até 1 MB.');return;}const db=supabase()!,ext=file.type==='image/jpeg'?'jpg':file.type.split('/')[1],path=user.id+'/avatar.'+ext;const {error}=await db.storage.from('avatars').upload(path,file,{upsert:true});if(error){notify('Não foi possível enviar a foto.');return;}const url=db.storage.from('avatars').getPublicUrl(path).data.publicUrl+'?v='+Date.now();const r=await db.auth.updateUser({data:{avatar_url:url}});if(r.error){notify('Não foi possível atualizar o perfil.');return;}await db.from('profiles').update({avatar_url:url}).eq('id',user.id);notify('Foto atualizada.');}}/><small>JPG, PNG ou WebP. Até 1 MB.</small></label>
  <div className="account-facts"><span><small>E-mail</small>{user.email}</span><span><small>E-mail confirmado</small>{user.email_confirmed_at?'Sim':'Pendente'}</span><span><small>Conta criada em</small>{new Date(user.created_at).toLocaleDateString('pt-BR')}</span></div>
  <button className="primary" disabled={busy} onClick={async()=>{setBusy(true);const db=supabase()!;const a=await db.auth.updateUser({data:{name}});const b=await db.from('profiles').update({name}).eq('id',user.id);setBusy(false);notify(a.error||b.error?'Não foi possível salvar.':'Perfil salvo.');}}>Salvar perfil</button>
 </div>;
}

type Choice={key:string;label:string;count:number;value:SpecValue};
// Opções reais do catálogo para a categoria (mesma extração e normalização dos filtros do catálogo).
function choicesFor(offers:Offer[],category:string){
 const result:Record<string,Choice[]>={},items=offers.filter(o=>category==='all'||o.category===category);
 for(const def of FACETS[category]??[]){
  const counts=new Map<string,Choice>();
  for(const o of items){const v=offerFacets(o)[def.key];if(v===undefined)continue;const key=String(v),c=counts.get(key);if(c)c.count++;else counts.set(key,{key,label:facetLabel(def.key,v),count:1,value:v});}
  result[def.key]=[...counts.values()].sort((a,b)=>def.numeric?Number(a.value)-Number(b.value):b.count-a.count);
 }
 return result;
}
function describeFilters(a:Alert){
 const parts:string[]=[];
 for(const [k,v] of Object.entries(a.spec_filters??{})){const key=k.replace(/_min$/,''),def=Object.values(FACETS).flat().find(d=>d.key===key);const values=(Array.isArray(v)?v:[v]).map(x=>facetLabel(key,x)).join(' ou ');parts.push((def?.label??key)+(k.endsWith('_min')?' a partir de ':': ')+values);}
 return parts;
}
// Notificações: e-mail, limite geral e alertas por categoria, características e valores.
export function NotificationSettings({user,notify,offers}:{user:User;notify:(s:string)=>void;offers:Offer[]}){
 const [enabled,setEnabled]=useState(false),[max,setMax]=useState(''),[alerts,setAlerts]=useState<Alert[]>([]),[category,setCategory]=useState('all'),[price,setPrice]=useState(''),[discount,setDiscount]=useState(''),[drop,setDrop]=useState(''),[picked,setPicked]=useState<Record<string,string[]>>({}),[mins,setMins]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false);
 useEffect(()=>{const db=supabase()!;db.from('profiles').select('*').eq('id',user.id).single().then(({data})=>{if(data){setEnabled(data.email_enabled);setMax(data.global_max_price??'');}});db.from('alerts').select('*').eq('user_id',user.id).then(({data})=>setAlerts(data??[]));},[user.id]);
 const choices=useMemo(()=>choicesFor(offers,category),[offers,category]);
 const toggle=(key:string,v:string)=>setPicked(x=>{const cur=x[key]??[];return {...x,[key]:cur.includes(v)?cur.filter(y=>y!==v):[...cur,v]};});
 return <div className="form-stack">
  <h3><Bell size={18}/>Notificações por e-mail</h3>
  <label className="switch-label"><span>Receber alertas de preço<small>Enviados para {user.email}{user.email_confirmed_at?'':' (confirme o e-mail para receber)'}</small></span><input type="checkbox" role="switch" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/></label>
  <label>Limite geral de preço (opcional)<input type="number" min="1" placeholder="Sem limite geral" value={max} onChange={e=>setMax(e.target.value)}/></label>
  <button className="primary" disabled={busy} onClick={async()=>{if(max&&Number(max)<=0){notify('Informe um limite maior que zero.');return;}setBusy(true);const {error}=await supabase()!.from('profiles').update({email_enabled:enabled,global_max_price:max?Number(max):null}).eq('id',user.id);setBusy(false);notify(error?'Não foi possível salvar.':'Preferências salvas.');}}>Salvar preferências</button>
  <hr/>
  <h3>Seus alertas</h3>
  {alerts.length===0&&<p className="muted">Nenhum alerta ainda.</p>}
  {alerts.map(a=><div className="alert-row" key={a.id}><span><strong>{categories.find(c=>c[0]===a.category)?.[1]??a.category}</strong><small>{[a.max_price!=null?'Até '+money(a.max_price):'',a.min_drop_amount?'Queda de '+money(a.min_drop_amount):'',a.min_discount?'Queda de '+a.min_discount+'%':'',a.brands?.length?'Marcas: '+a.brands.join(', '):'',...describeFilters(a)].filter(Boolean).join(' · ')}</small></span><button className="icon" aria-label="Excluir alerta" onClick={async()=>{const {error}=await supabase()!.from('alerts').delete().eq('id',a.id!);if(!error)setAlerts(x=>x.filter(y=>y.id!==a.id));else notify('Não foi possível excluir.');}}><Trash2 size={17}/></button></div>)}
  <hr/>
  <h3>Novo alerta por categoria</h3>
  <p className="muted">Escolha só as características que importam; o resto fica livre (qualquer marca, loja ou modelo). Quedas em reais ou porcentagem exigem histórico suficiente do produto; preço máximo funciona sempre.</p>
  <form className="alert-create" onSubmit={async e=>{e.preventDefault();if(!price&&!discount&&!drop){notify('Defina pelo menos uma condição de preço ou queda.');return;}
   const spec_filters:Record<string,string[]|number>={};for(const [k,v] of Object.entries(picked))if(v.length&&k!=='brand')spec_filters[k]=v;for(const [k,v] of Object.entries(mins))if(v)spec_filters[k+'_min']=Number(v);
   const {data,error}=await supabase()!.from('alerts').insert({user_id:user.id,category,max_price:price?Number(price):null,min_discount:discount?Number(discount):null,min_drop_amount:drop?Number(drop):null,brands:(picked.brand??[]).map(b=>choices.brand?.find(c=>c.key===b)?.label??b),spec_filters,enabled:true}).select().single();
   if(error){notify('Não foi possível criar o alerta.');return;}setAlerts(x=>[...x,data]);setPrice('');setDrop('');setDiscount('');setPicked({});setMins({});notify('Alerta criado.');}}>
   <label>Categoria<select value={category} onChange={e=>{setCategory(e.target.value);setPicked({});setMins({});}}>{categories.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   {(FACETS[category]??[]).map(def=>{const opts=choices[def.key]??[];if(!opts.length)return null;return <fieldset className="alert-facet" key={def.key}><legend>{def.label}</legend><div className="chip-options">{opts.slice(0,14).map(o=><button type="button" key={o.key} aria-pressed={picked[def.key]?.includes(o.key)??false} className={picked[def.key]?.includes(o.key)?'active':''} onClick={()=>toggle(def.key,o.key)}>{o.label}</button>)}</div>{def.numeric&&<label className="inline-min">ou pelo menos<select value={mins[def.key]??''} onChange={e=>setMins(x=>({...x,[def.key]:e.target.value}))}><option value="">qualquer</option>{opts.map(o=><option key={o.key} value={String(o.value)}>{o.label}</option>)}</select></label>}</fieldset>;})}
   <div className="form-columns"><label>Preço máximo (R$)<input type="number" min="0.01" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} placeholder="Sem limite"/></label><label>Queda mínima (R$)<input type="number" min="0.01" step="0.01" value={drop} onChange={e=>setDrop(e.target.value)} placeholder="Opcional"/></label><label>Queda mínima (%)<input type="number" min="1" max="100" value={discount} onChange={e=>setDiscount(e.target.value)} placeholder="Opcional"/></label></div>
   <button className="secondary"><Plus size={16}/>Adicionar alerta</button>
  </form>
 </div>;
}
