// Canais OFICIAIS de ofertas das lojas no Telegram, lidos pela prévia pública da web (https://t.me/s/<canal>),
// sem conta, sem bot e sem login. É a própria loja anunciando produto, preço e link — fonte de primeira mão, mas
// PONTUAL: o Baixou! não consegue conferir a página do produto (bloqueada para robôs). Por isso:
// - a oferta é gravada como "anunciada" (verification_status='announced'), com checked_at = horário do post;
// - vale por poucas horas (ANNOUNCED_TTL_MINUTES) e some sozinha se a loja não voltar a anunciar;
// - não entra no histórico de preços, na referência de mercado nem nos alertas por e-mail (exigem verificação).
// Canal só entra aqui depois de confirmado como da própria loja (link no site oficial). Ver docs/MAJOR_STORES.md.
import * as cheerio from 'cheerio/slim';
import type {Connector,ConnectorContext,MarketplaceListing} from './types';
export const ANNOUNCED_TTL_MINUTES=360,ANNOUNCED_LOOKBACK_HOURS=24;
const agent='BaixouBot/1.0 (+https://github.com/uPedroLima11/baixou)';
export type ChannelPost={id:number;date:string;text:string;links:string[];photo?:string|null};
export type ChannelConfig={channel:string;source:string;storeName:string;productHost:string;productPath:RegExp;shortHosts?:string[];minSlugParts?:number;channelLabel:string};
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

export function parseChannelPage(html:string,channel:string):ChannelPost[]{
 const $=cheerio.load(html),out:ChannelPost[]=[];
 $('.tgme_widget_message').each((_,el)=>{
  const post=String($(el).attr('data-post')??''),[name,num]=post.split('/');
  if(name?.toLowerCase()!==channel.toLowerCase()||!/^\d+$/.test(num??''))return;// só posts do próprio canal (sem encaminhados de outros)
  if($(el).find('.tgme_widget_message_forwarded_from').length)return;
  const body=$(el).find('.tgme_widget_message_text').first().clone();body.find('br').replaceWith('\n');
  const text=body.text().replace(/ /g,' ').trim(),date=String($(el).find('time[datetime]').first().attr('datetime')??'');
  const links=[...new Set([...body.find('a[href]').toArray().map(a=>String($(a).attr('href'))),...(text.match(/https?:\/\/[^\s<>"']+/g)??[])])];
  // Foto publicada no próprio post (CDN do Telegram, HTTPS). Só a primeira; vídeos não viram imagem.
  const style=String($(el).find('.tgme_widget_message_photo_wrap').first().attr('style')??''),photo=style.match(/url\(['"]?(https:\/\/cdn\d*\.telesco\.pe\/file\/[A-Za-z0-9_\-]+\.jpg)['"]?\)/)?.[1]??null;
  if(text&&Date.parse(date))out.push({id:Number(num),date,text,links,photo});
 });
 return out.sort((a,b)=>b.id-a.id);
}
const money=(s:string)=>Number(s.replace(/\./g,'').replace(',','.'));
const AMOUNT=/R\$\s*([\d.]+,\d{2})/g;
// Preço à vista do post: linha com 💰/"a partir de"/"oferta"; exige um único valor (ou "De X por Y"). Parcelado é separado.
export function postPrice(text:string):{price:number;original:number|null;installmentTotal:number|null}|null{
 const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);
 const priceLine=lines.find(l=>/💰|a partir de|^oferta|por:?\s*R\$/i.test(l)&&/R\$/.test(l)&&!/parcelad|\d+\s*x\s/i.test(l));if(!priceLine)return null;
 const values=[...priceLine.matchAll(AMOUNT)].map(m=>money(m[1]));let price:number,original:number|null=null;
 if(values.length===1)price=values[0];
 else if(values.length===2&&/\bde\b[^R]*R\$[^R]*\bpor\b/i.test(priceLine)){original=values[0];price=values[1];if(!(original>price))original=null;}
 else return null;
 const inst=lines.find(l=>/parcelad/i.test(l)&&/R\$/.test(l)),instValues=inst?[...inst.matchAll(AMOUNT)].map(m=>money(m[1])):[];
 return Number.isFinite(price)&&price>0?{price,original,installmentTotal:instValues.length===1?instValues[0]:null}:null;
}
// Título = linha do post que mais coincide com o slug da URL do produto; corta chamadas de marketing após travessão.
export function postTitle(text:string,url:string){
 const slug=decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).at(-1)??'').toLowerCase().split('-').filter(w=>w.length>1);
 const norm=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
 let best='',score=0;
 for(const raw of text.split('\n')){const line=raw.replace(/^[^\p{L}\p{N}]+/u,'').split(/\s[—–]\s/)[0].trim();if(line.length<10||/R\$|https?:/.test(line))continue;const words=norm(line).split(/[^a-z0-9]+/).filter(Boolean),hit=slug.filter(w=>words.includes(w)).length/Math.max(1,slug.length);if(hit>score){score=hit;best=line;}}
 return score>=0.5?best.slice(0,300):null;
}
const EXCLUDED=/\b(open\s*box|usad[oa]|recondicionad[oa]|seminov[oa]|vitrine|mostru[aá]rio|pr[eé]-?venda)\b/i;
export type PostDecision={ok:true;listing:MarketplaceListing}|{ok:false;reason:string};
export function postToListing(p:ChannelPost,cfg:ChannelConfig,resolvedUrl?:string):PostDecision{
 if(/cupom/i.test(p.text))return {ok:false,reason:'preço condicionado a cupom'};
 if(EXCLUDED.test(p.text))return {ok:false,reason:'condição diferente de novo'};
 const raw=resolvedUrl??p.links.find(l=>{try{return new URL(l).hostname===cfg.productHost;}catch{return false;}});
 if(!raw)return {ok:false,reason:'sem link de produto da loja'};
 let url:URL;try{url=new URL(raw);}catch{return {ok:false,reason:'URL inválida'};}
 if(url.protocol!=='https:'||url.hostname!==cfg.productHost||!cfg.productPath.test(url.pathname))return {ok:false,reason:'link fora da loja'};
 const canonical='https://'+url.hostname+url.pathname.replace(/\/$/,'');
 if(cfg.minSlugParts&&(url.pathname.split('/').filter(Boolean).at(-1)??'').split('-').length<cfg.minSlugParts)return {ok:false,reason:'link não parece página de produto'};
 const price=postPrice(p.text);if(!price)return {ok:false,reason:'preço ausente ou ambíguo'};
 const title=postTitle(p.text,canonical);if(!title)return {ok:false,reason:'título não confere com o link'};
 const externalId=cfg.productPath.exec(url.pathname)?.[1]??url.pathname;
 return {ok:true,listing:{source:cfg.source,externalId,url:canonical,title,price:price.price,originalPrice:price.original,currency:'BRL',available:true,condition:'new',paymentBasis:'cash',
  seller:{id:null,name:cfg.storeName,official:true,reputationLevel:null,positiveRate:null,completedSales:null},images:p.photo?[p.photo]:[],brand:null,mpn:null,gtin:null,couponHint:null,fetchedAt:new Date(p.date).toISOString(),
  announcement:{channel:cfg.channel,postId:p.id,postedAt:new Date(p.date).toISOString(),installmentTotal:price.installmentTotal,label:cfg.channelLabel}}};
}
async function resolveShort(ctx:ConnectorContext,link:string,cfg:ChannelConfig){
 try{const u=new URL(link);if(!cfg.shortHosts?.includes(u.hostname))return undefined;const r=await ctx.fetch(link,{method:'HEAD',redirect:'manual',headers:{'User-Agent':agent},signal:AbortSignal.timeout(8000)});const loc=r.headers.get('location');return loc&&r.status>=300&&r.status<400?new URL(loc,link).toString():undefined;}catch{return undefined;}
}
export function telegramChannelConnector(cfg:ChannelConfig&{id:string;name:string;implemented:boolean}):Connector{
 return {id:cfg.id,name:cfg.name,marketplace:false,requiredEnv:[],hosts:[cfg.productHost],implemented:cfg.implemented,
  async *listings(ctx){
   // Lê 24 h de posts: o mais recente de cada produto vira oferta (vale 6 h a partir do post; mais antigo já nasce
   // vencido e fica fora do catálogo); todos alimentam o histórico de preços anunciados.
   const since=Date.now()-ANNOUNCED_LOOKBACK_HOURS*3600000,seen=new Set<string>();let before:number|undefined,emitted=0,last=0;
   for(let page=0;page<12&&Date.now()<ctx.deadline;page++){
    const wait=last+1500-Date.now();if(wait>0)await sleep(wait);last=Date.now();
    const r=await ctx.fetch('https://t.me/s/'+cfg.channel+(before?'?before='+before:''),{headers:{'User-Agent':agent,Accept:'text/html'},redirect:'manual',signal:AbortSignal.timeout(10000)});
    if(!r.ok)throw new Error('Telegram HTTP '+r.status);
    const posts=parseChannelPage(await r.text(),cfg.channel);if(!posts.length)break;
    for(const p of posts){if(Date.parse(p.date)<since)continue;
     let resolved:string|undefined;if(cfg.shortHosts?.length){for(const l of p.links){let host='';try{host=new URL(l).hostname;}catch{continue;}if(!cfg.shortHosts.includes(host))continue;await sleep(400);resolved=await resolveShort(ctx,l,cfg);if(resolved)break;}}
     const d=postToListing(p,cfg,resolved);if(!d.ok)continue;
     // Posts mais novos primeiro: o anúncio mais recente de cada produto vence; os anteriores só entram no histórico.
     d.listing.announcement!.latest=!seen.has(d.listing.externalId);seen.add(d.listing.externalId);
     yield d.listing;if(++emitted>=ctx.maxListings)return;}
    const oldest=posts[posts.length-1];if(Date.parse(oldest.date)<since)break;before=oldest.id;
   }
  }};
}
// Terabyte: canal t.me/terabyteshopoficial está linkado no rodapé de www.terabyteshop.com.br (conferido em 24/11/2026).
export const terabyteTelegram=telegramChannelConnector({id:'terabyte-telegram',name:'Terabyte (canal oficial no Telegram)',channel:'terabyteshopoficial',source:'terabyte',storeName:'Terabyte',productHost:'www.terabyteshop.com.br',productPath:/^\/produto\/(\d+)\/[\w-]+\/?$/,channelLabel:'canal oficial da Terabyte no Telegram',implemented:true});
// Pichau: t.me/pichauofertas (desde 01/2022). pruuu.me é o encurtador de marca da Pichau (links personalizados nas
// descrições do YouTube oficial @pichauinfo); o canal publica links personalizados desse domínio para as lives oficiais
// (pruuu.me/Live24H e /Live13-11-26 → vídeos do canal oficial), vídeos e matérias da Pichau. Nenhuma página acessível
// da Pichau linka o canal diretamente (site 403), então a UI diz "canal da Pichau no Telegram". Ver MAJOR_STORES.md.
export const pichauTelegram=telegramChannelConnector({id:'pichau-telegram',name:'Pichau (canal no Telegram)',channel:'pichauofertas',source:'pichau',storeName:'Pichau',productHost:'www.pichau.com.br',productPath:/^\/([a-z0-9][a-z0-9-]{8,200})\/?$/,shortHosts:['pruuu.me'],minSlugParts:4,channelLabel:'canal da Pichau no Telegram',implemented:true});
