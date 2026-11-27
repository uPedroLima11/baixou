import {categories,money,type Alert,type Offer} from './types';
import {offerFacets} from './specs';
import {storeNames} from './stores';
import {marketDiscount,marketStatus} from './market';

export type NotificationReason={payment?:'pix'|'card';kind:'price'|'history'|'wishlist';summary:string;conditions:string[];product?:boolean;short:string};
const clean=(value:string)=>value.replace(/[\r\n\u0000-\u001f]+/g,' ').replace(/\s+/g,' ').trim();
export const escapeEmailHTML=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const cut=(value:string,length:number)=>value.length>length?value.slice(0,length-1).trimEnd()+'…':value;
// Nome curto para caber na prévia do celular. Usa apenas o título/ficha da própria loja.
export function notificationProductName(o:Offer){
 const title=clean(o.title),cpu=title.match(/\b(Ryzen\s*[3579]\s*\d{4}[a-z0-9]*|Core\s*(?:Ultra\s*)?i?[3579][-\s]*\d{3,5}[a-z]*)\b/i);
 if(o.category==='cpu'&&cpu)return clean(cpu[1]);
 const gpu=title.match(/\b((?:RTX|GTX)\s*\d{3,4}(?:\s*(?:Ti\s*Super|Ti|Super))?|RX\s*\d{3,4}(?:\s*(?:XTX|XT|GRE))?|Arc\s*[AB]\d{3})\b/i);
 if(o.category==='gpu'&&gpu)return clean((o.brand?o.brand+' ':'')+gpu[1]);
 const facets=offerFacets(o);
 if(o.category==='ssd'&&facets.capacity_gb)return clean('SSD '+(o.brand??'')+' '+(Number(facets.capacity_gb)>=1000?Number(facets.capacity_gb)/1000+'TB':facets.capacity_gb+'GB'));
 if(o.category==='ram'&&facets.total_gb)return clean('Memória '+(o.brand??'')+' '+facets.total_gb+'GB'+(facets.modules&&Number(facets.modules)>1?' ('+facets.modules+'x'+Number(facets.total_gb)/Number(facets.modules)+'GB)':'')+(facets.ddr?' DDR'+facets.ddr:''));
 return cut(title.split(/,| - | – /)[0],48);
}
export function reasonForAlert(a:Alert,o:Offer,pay?:'pix'|'card'):NotificationReason{
 const paid=pay??(a.payment==='card'?'card':'pix');
 const history=(a.min_drop_amount??0)>0||(a.min_discount??0)>0,product=!!(a.offer_id||a.product_id),conditions:string[]=['Regra: '+(product?'alerta deste produto':'alerta de '+(a.category==='all'?'todas as categorias':(categories.find(([id])=>id===a.category)?.[1]??a.category)))+(history&&a.max_price!=null?' (todas as condições juntas)':'')+'.'];
 if(a.max_price!=null)conditions.push('Preço máximo de '+money(Number(a.max_price))+' atingido.');
 if(a.min_drop_amount!=null)conditions.push('Queda de pelo menos '+money(Number(a.min_drop_amount))+' em relação ao preço habitual.');
 if(a.min_discount!=null)conditions.push('Queda de pelo menos '+a.min_discount+'% em relação ao preço habitual.');
 if(!product&&a.category!=='all')conditions.push('Categoria: '+(categories.find(([id])=>id===a.category)?.[1]??a.category)+'.');
 if(a.brands?.length)conditions.push('Marca dentro da sua seleção.');
 if(Object.keys(a.spec_filters??{}).length)conditions.push('As características técnicas selecionadas foram atendidas.');
 conditions.push((paid==='card'?'Forma de pagamento: cartão de crédito (total no cartão informado pela loja)':'Forma de pagamento: Pix / à vista')+(a.payment==='any'?' — seu alerta vale para Pix ou cartão.':'.'));
 const summary=history?'Seu alerta de queda de preço foi atendido.':product?'O produto que você acompanha chegou ao preço desejado.':'Uma oferta atingiu o preço do seu alerta.';
 const parts=[a.max_price!=null?'até '+money(Number(a.max_price)):'',a.min_drop_amount!=null?'queda ≥ '+money(Number(a.min_drop_amount)):'',a.min_discount!=null?'queda ≥ '+a.min_discount+'%':''].filter(Boolean);
 const scope=product?'este produto':a.category==='all'?'todas as categorias':(categories.find(([id])=>id===a.category)?.[1]??a.category);
 return {kind:history?'history':'price',summary,conditions,product,short:'Seu alerta ('+scope+(paid==='card'?', cartão':a.payment==='any'?', Pix':'')+'): '+parts.join(' e ')+'.'};
}
// Regra explícita no e-mail: favoritos só avisam fora do escopo dos alertas ativos, salvo opção marcada pelo usuário.
export function wishlistReason(ignoredAlertLimits=false):NotificationReason{return {kind:'wishlist',summary:'Um produto da sua lista de desejos caiu pelo menos 5% abaixo do preço habitual.',short:'Lista de desejos: ≥ 5% abaixo do preço habitual.',conditions:['Regra: lista de desejos.',ignoredAlertLimits?'Você permitiu avisos de favoritos fora dos limites dos seus alertas.':'Nenhum alerta ativo seu cobre este produto.']};}
export function offerEmailUrl(value:string){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['www.kabum.com.br','www.terabyteshop.com.br','www.pichau.com.br','www.waz.com.br','www.oficinadosbits.com.br','www.guerradigital.com.br','patoloco.com.br','www.ibyte.com.br','www.chipart.com.br','shopinfo.com.br','www.mercadolivre.com.br','produto.mercadolivre.com.br'].includes(u.hostname)?u.href:null;}catch{return null;}}
function imageUrl(value:string|null){try{if(!value)return null;const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&/\.(?:avif|webp|jpe?g|png)$/i.test(u.pathname)&&['kabum.com.br','waz.com.br','guerradigital.com.br','patoloco.com.br','mlstatic.com','lojaibyte.vtexassets.com','i.chipart.openk.com.br','shopinfo.com.br'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h))?u.href:null;}catch{return null;}}
// Preposição com o nome da loja: "no Mercado Livre", "na KaBuM!".
export const atStore=(store:string,name:string)=>(['mercadolivre'].includes(store)?'no ':'na ')+name;
const hasHistory=(o:Offer)=>Number(o.historical_median)>Number(o.price)&&o.historical_samples>=5&&o.historical_days>=3;

export function notificationSubject(o:Offer,reason:NotificationReason){
 const historic=reason.kind!=='price'&&hasHistory(o),below=!historic&&marketStatus(o)==='below';
 const prefix=historic?'Baixou! 📉 ':below?'Baixou! 🔥 ':'Baixou! 🔔 ',suffix=historic?' caiu para '+money(o.price):below?' por '+money(o.price):' atingiu '+money(o.price);
 // ~70 caracteres cabem na prévia de notificações de celular.
 return prefix+cut(notificationProductName(o),Math.max(16,72-prefix.length-suffix.length))+suffix;
}

export function buildNotificationEmail({offer:o,reason,siteUrl,unsubscribeToken}:{offer:Offer;reason:NotificationReason;siteUrl:string;unsubscribeToken:string}){
 const site=new URL(siteUrl);if(site.origin!=='https://baixouofertas.vercel.app')throw Error('SITE_URL de e-mail não autorizado');
 const storeUrl=offerEmailUrl(o.url);if(!storeUrl)throw Error('Link de loja não permitido');
 if(!/^[a-f0-9-]{36}$/i.test(unsubscribeToken))throw Error('Token de cancelamento inválido');
 const product=site.origin+'/produto/'+encodeURIComponent(o.id),settings=site.origin+'/?conta=notificacoes',unsubscribe=site.origin+'/cancelar?token='+encodeURIComponent(unsubscribeToken),oneClick=site.origin+'/api/unsubscribe?token='+encodeURIComponent(unsubscribeToken);
 const historic=hasHistory(o);
 if(reason.kind!=='price'&&!historic)throw Error('E-mail de queda sem histórico suficiente');
 const subject=notificationSubject(o,reason),store=storeNames[o.store]??o.store,seller=clean(o.seller);
 const payment=clean(o.payment_note??(o.store!=='mercadolivre'||o.payment_basis==='cash'?'Preço à vista/Pix informado pela loja.':'Confira as condições de pagamento na loja.'));
 // Evidência só quando comprovada: histórico próprio ou mediana de outros vendedores. Preço riscado nunca aparece como prova.
 const evidence:string[]=[];
 if(historic)evidence.push('Mediana histórica: '+money(Number(o.historical_median))+' ('+o.historical_samples+' observações em '+o.historical_days+' dias). Queda de '+money(Number(o.historical_median)-Number(o.price))+' ('+Math.floor((1-Number(o.price)/Number(o.historical_median))*100)+'%).');
 if(marketStatus(o)==='below')evidence.push(Math.floor(marketDiscount(o)!)+'% abaixo da mediana de '+o.market_stores+' outros vendedores monitorados ('+money(Number(o.market_median))+'). Cobertura parcial: pode haver preços menores fora da amostra.');
 if(!evidence.length)evidence.push('Meta de preço atingida. Isso não indica queda histórica nem menor preço de todo o mercado.');
 const checked=new Date(o.checked_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}),image=imageUrl(o.image);
 const preheader=cut(money(o.price)+' '+atStore(o.store,store)+' · '+reason.summary+' '+payment,150);
 const text=[subject,'',reason.summary,'',clean(o.title),money(o.price)+' — '+payment,store+' · vendido por '+seller,'',...reason.conditions,...evidence,'Verificado em '+checked+'. Preço e estoque podem mudar; frete e condições na loja.','','Ver oferta no Baixou!: '+product,'Comprar na loja: '+storeUrl,'','Gerenciar alertas: '+settings,'Desativar e-mails de alerta: '+unsubscribe].join('\n');
 const h=escapeEmailHTML;
 const button=(href:string,label:string,bg:string,fg:string,border:string)=>'<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto"><tr><td bgcolor="'+bg+'" style="border-radius:8px;border:1px solid '+border+';mso-padding-alt:14px 26px"><a href="'+h(href)+'" style="display:inline-block;padding:14px 26px;color:'+fg+';font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;font-family:Arial,Helvetica,sans-serif">'+h(label)+'</a></td></tr></table>';
 const html='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>'+h(subject)+'</title></head>'
 +'<body style="margin:0;padding:0;background:#f4f6f8;color:#202329;font-family:Arial,Helvetica,sans-serif">'
 +'<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;max-height:0;max-width:0;overflow:hidden;mso-hide:all">'+h(preheader)+'&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>'
 +'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f4f6f8"><tr><td align="center" style="padding:24px 12px">'
 +'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e1e5eb;border-radius:12px;overflow:hidden">'
 +'<tr><td bgcolor="#202329" style="padding:22px 28px;border-bottom:4px solid #f45b22"><a href="'+h(site.origin)+'" style="color:#ffffff;text-decoration:none;font-size:28px;line-height:1.2;font-weight:800">Baixou<span style="color:#ff8050">!</span></a><p style="margin:6px 0 0;color:#d7dce3;font-size:13px;line-height:1.5">Alerta de preço</p></td></tr>'
 +'<tr><td style="padding:28px 28px 8px"><p style="margin:0 0 18px;color:#b73810;font-size:14px;font-weight:700;line-height:1.5">'+h(reason.summary)+'</p>'
 +(image?'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:4px 0 20px"><img src="'+h(image)+'" alt="'+h(cut(clean(o.title),120))+'" width="220" style="display:block;width:220px;max-width:100%;height:auto;border:0"></td></tr></table>':'')
 +'<h1 style="margin:0 0 8px;font-size:19px;line-height:1.45;color:#202329;font-weight:700">'+h(clean(o.title))+'</h1>'
 +'<p style="margin:0;color:#606773;font-size:13px;line-height:1.6">'+h(store)+' · vendido por '+h(seller)+'</p>'
 +'<p style="margin:18px 0 2px;font-size:34px;line-height:1.2;font-weight:800;color:#0f7a5a">'+h(money(o.price))+'</p>'
 +'<p style="margin:0 0 22px;color:#606773;font-size:13px;line-height:1.6">'+h(payment)+'</p>'
 +'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:16px 18px;background:#fff7f2;border-left:3px solid #f45b22;border-radius:4px;color:#3d434d;font-size:14px;line-height:1.65"><p style="margin:0 0 6px;font-weight:700;color:#202329">Por que você recebeu este alerta</p>'
 +reason.conditions.map(c=>'<p style="margin:0 0 4px">'+h(c)+'</p>').join('')+evidence.map(c=>'<p style="margin:8px 0 0">'+h(c)+'</p>').join('')+'</td></tr></table>'
 +'</td></tr>'
 +'<tr><td style="padding:24px 28px 6px">'+button(product,'Ver oferta no Baixou!','#f45b22','#ffffff','#f45b22')+'</td></tr>'
 +'<tr><td align="center" style="padding:10px 28px 4px"><a href="'+h(storeUrl)+'" style="color:#b73810;font-size:14px;font-weight:700;text-decoration:underline">Ir direto para '+h(atStore(o.store,store).slice(1))+'</a></td></tr>'
 +'<tr><td style="padding:16px 28px 26px"><p style="margin:0;color:#606773;font-size:12px;line-height:1.7;text-align:center">Verificado em '+h(checked)+' (horário de Brasília). Preço e estoque podem mudar a qualquer momento; frete e condições na loja.</p></td></tr>'
 +'<tr><td style="padding:20px 28px;border-top:1px solid #e1e5eb;background:#fafbfc;color:#606773;font-size:12px;line-height:1.8">Você recebeu este e-mail porque ativou alertas de preço no Baixou!.<br><a href="'+h(settings)+'" style="color:#b73810">Gerenciar ou editar alertas</a> &nbsp;·&nbsp; <a href="'+h(unsubscribe)+'" style="color:#606773">Desativar e-mails de alerta</a></td></tr>'
 +'</table></td></tr></table></body></html>';
 return {subject,preheader,text,html,unsubscribe,oneClick,settings};
}
