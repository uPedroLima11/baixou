import * as cheerio from 'cheerio/slim';
import {cardTerms,installmentRows,NO_CARD} from '../payment';
import type {Connector,MarketplaceListing} from './types';
import {classify} from '../types';
// Mercado Livre sem API/OAuth: vitrines públicas de LOJAS OFICIAIS (www.mercadolivre.com.br/loja/{slug}).
// Por quê: API devolve 401/403 sem token (PolicyAgent); páginas de produto e listagens redirecionam para
// /gz/account-verification. As vitrines respondem 200 também no runner do GitHub, o robots.txt não as bloqueia
// para o nosso User-Agent, e cada loja oficial pertence a um único vendedor verificado pelo Mercado Livre.
// Limites: só os itens exibidos na vitrine (≈5–120 por loja); sem MPN/GTIN; estoque inferido da vitrine ativa.
export type OfficialStore={slug:string;name:string;brand:string|null};
// Slugs conferidos com HTTP 200 e cards em 23/11/2026. Slugs inexistentes redirecionam para /lojas-oficiais.
export const ML_OFFICIAL_STORES:OfficialStore[]=[
 {slug:'pichau',name:'Pichau',brand:null},{slug:'kabum',name:'KaBuM!',brand:null},
 {slug:'gigabyte',name:'Gigabyte',brand:'Gigabyte'},{slug:'asus',name:'ASUS',brand:'ASUS'},{slug:'nvidia',name:'NVIDIA',brand:null},
 {slug:'corsair',name:'Corsair',brand:'Corsair'},{slug:'xpg',name:'XPG',brand:'XPG'},{slug:'adata',name:'ADATA',brand:'ADATA'},{slug:'sandisk',name:'SanDisk',brand:'SanDisk'},
 {slug:'logitech-g',name:'Logitech G',brand:'Logitech'},{slug:'logitech',name:'Logitech',brand:'Logitech'},{slug:'redragon',name:'Redragon',brand:'Redragon'},{slug:'pcyes',name:'Pcyes',brand:'Pcyes'},{slug:'mancer',name:'Mancer',brand:'Mancer'},
 {slug:'samsung',name:'Samsung',brand:'Samsung'},{slug:'lg',name:'LG',brand:'LG'},{slug:'aoc',name:'AOC',brand:'AOC'},{slug:'philips',name:'Philips',brand:'Philips'},
 {slug:'acer',name:'Acer',brand:'Acer'},{slug:'lenovo',name:'Lenovo',brand:'Lenovo'},{slug:'dell',name:'Dell',brand:'Dell'},{slug:'hp',name:'HP',brand:'HP'},{slug:'positivo',name:'Positivo',brand:'Positivo'},
 {slug:'jbl',name:'JBL',brand:'JBL'},{slug:'edifier',name:'Edifier',brand:'Edifier'},
 // Consoles e controles (sondados no runner em 27/11/2026: HTTP 200). Xbox/Microsoft e 8BitDo não têm loja oficial no ML.
 {slug:'playstation',name:'PlayStation',brand:'Sony'},{slug:'nintendo',name:'Nintendo',brand:'Nintendo'},{slug:'gamesir',name:'GameSir',brand:'GameSir'},
];
const ORIGIN='https://www.mercadolivre.com.br';
// Vitrines de varejistas (Pichau, KaBuM!) não informam marca: usa a marca impressa no título SOMENTE quando
// exatamente um fabricante conhecido aparece ("Kit AMD Ryzen + placa MSI" cita dois e fica sem marca).
const KNOWN_BRANDS=['ASUS','Gigabyte','MSI','ASRock','Kingston','Corsair','XPG','ADATA','Redragon','Logitech','HyperX','Husky','Mancer','Pcyes','Rise Mode','TGT','Galax','Zotac','PNY','Palit','Sapphire','PowerColor','Inno3D','AMD','Intel','Samsung','LG','AOC','Philips','Dell','Lenovo','Acer','HP','SanDisk','Western Digital','Seagate','Crucial','Lexar','DeepCool','Cooler Master','Thermaltake','Lian Li','Gamdias','Fortrek','Apple','JBL','Edifier','Razer','SteelSeries','Havit','Keychron','Montech','Machenike'];
// PCs e kits juntam peças de vários fabricantes: sem inferência. AMD/Intel só identificam processadores
// (em "Notebook Lenovo, Intel i5" a marca é Lenovo, não Intel).
export function brandFromTitle(title:string){
 const category=classify(title);if(category==='pc'||category==='kit')return null;
 const t=' '+title.toLowerCase().replace(/[^a-z0-9]+/g,' ')+' ';
 const found=KNOWN_BRANDS.filter(b=>(category==='cpu'||(b!=='AMD'&&b!=='Intel'))&&t.includes(' '+b.toLowerCase()+' '));
 return found.length===1?found[0]:null;
}
// "Agora: 562 reais com 97 centavos" -> 562.97
export function brlFromAria(label:string|undefined|null){const m=String(label??'').match(/(\d[\d.]*)\s*reais(?:\s*com\s*(\d{1,2})\s*centavos?)?/i);if(!m)return null;const v=Number(m[1].replace(/\./g,''))+(m[2]?Number(m[2])/100:0);return Number.isFinite(v)&&v>0?Math.round(v*100)/100:null;}
function canonical(href:string){try{const u=new URL(href,ORIGIN);if(u.protocol!=='https:')return null;
 const item=(u.searchParams.get('pdp_filters')??'').match(/item_id:(MLB\d{6,})/)?.[1]??u.hash.match(/wid=(MLB\d{6,})/)?.[1]??null;
 if(u.hostname==='www.mercadolivre.com.br'){const p=u.pathname.match(/\/p\/(MLB\d{6,})$/);if(!p||!item)return null;return {url:ORIGIN+u.pathname+'?pdp_filters=item_id%3A'+item,item,catalog:p[1]};}
 if(u.hostname==='produto.mercadolivre.com.br'){const id=u.pathname.match(/^\/(MLB)-(\d{6,})/);if(!id)return null;return {url:'https://produto.mercadolivre.com.br'+u.pathname,item:id[1]+id[2],catalog:null};}
 return null;}catch{return null;}}
export function parseOfficialStorefront(html:string,store:OfficialStore,fetchedAt=new Date().toISOString()):MarketplaceListing[]{
 const officialStoreId=html.match(/"official_store_id":(\d+)/)?.[1],sellerId=html.match(/"seller_id":(\d+)/)?.[1];
 if(!officialStoreId||!sellerId)throw Error('Página sem loja oficial identificada');
 const $=cheerio.load(html),seen=new Set<string>(),out:MarketplaceListing[]=[];
 $('.poly-card').each((_,el)=>{const card=$(el),a=card.find('a.poly-component__title').first(),title=a.text().trim(),link=canonical(a.attr('href')??'');
  if(!title||!link||seen.has(link.item))return;seen.add(link.item);
  const price=brlFromAria(card.find('.poly-price__current [role="img"]').first().attr('aria-label'));if(!price)return;
  const previous=brlFromAria(card.find('s.andes-money-amount--previous').first().attr('aria-label'));
  const text=card.text(),pix=/no\s+pix/i.test(card.find('.poly-price__disc-label,.poly-price__current').text());
  const other=brlFromAria(card.find('.poly-price__installments [role="img"]').first().attr('aria-label'));
  const instText=card.find('.poly-price__installments').text().replace(/s+/g,' '),rows=installmentRows(instText.replace(/^(d{1,2})xs*R/i,'$1x de R'));
  // Cartão no ML: parcelas "sem juros" fecham o total; preço que não é exclusivo do Pix vale no cartão à vista (parcelas acima dele = com juros).
  const freeTerms=cardTerms({pix:price,rows:rows.map(r=>({...r,interestFree:/sem juros/i.test(instText)?true:r.interestFree}))});
  const cardInfo=freeTerms.card_price?freeTerms:!pix?{card_price:price,card_installments:rows[0]?.n??null,card_installment_value:rows[0]?.value??null,card_interest_free:rows[0]?(rows[0].n*rows[0].value>price*1.001?false:true):null}:NO_CARD;
  const img=card.find('img.poly-component__picture').first().attr('src')??'';
  const used=/\b(usado|recondicionado|seminovo|open\s*box|vitrine)\b/i.test(title+' '+text);
  out.push({card:cardInfo,source:'mercadolivre',externalId:link.item,url:link.url,title,price,originalPrice:previous&&previous>price?previous:null,currency:'BRL',
   paymentBasis:pix?'cash':null,available:/esgotad|indispon[ií]vel/i.test(text)?false:true,condition:used?'used':'new',
   seller:{id:sellerId,name:store.name+' (loja oficial no Mercado Livre)',official:true,reputationLevel:'official',positiveRate:null,completedSales:null},
   images:/^https:\/\/http2\.mlstatic\.com\/[\w./-]+\.(?:webp|jpg|jpeg|png)$/i.test(img)?[img]:[],brand:store.brand??brandFromTitle(title),mpn:null,gtin:null,
   couponHint:pix&&other&&other>price?'Preço no Pix; em outros meios R$ '+other.toFixed(2).replace('.',','):null,fetchedAt});});
 return out;}
const agent='BaixouBot/1.0 (+https://github.com/uPedroLima11/baixou)';
async function fetchStorefront(fetcher:typeof fetch,slug:string){
 const res=await fetcher(ORIGIN+'/loja/'+slug,{headers:{'User-Agent':agent,Accept:'text/html'},redirect:'manual',signal:AbortSignal.timeout(10000)});
 if(res.status!==200)throw Error('HTTP '+res.status+(res.headers.get('location')?.includes('account-verification')?' (verificação de conta: não contornar)':''));
 const text=await res.text();if(text.length>8_000_000)throw Error('Resposta maior que 8MB');return text;}
export function rotateStores<T>(list:readonly T[],now:number,step=3,slotMs=15*60000):T[]{if(!list.length)return [];const start=(Math.floor(now/slotMs)*step)%list.length;return [...list.slice(start),...list.slice(0,start)];}
export const mercadoLivreOfficialStores:Connector={
 id:'mercadolivre-lojas-oficiais',name:'Mercado Livre (lojas oficiais)',marketplace:true,requiredEnv:[],
 hosts:['www.mercadolivre.com.br','produto.mercadolivre.com.br'],
 // Ativado após coleta hospedada real (ver docs/HANDOFF.md). Desligar com ML_STOREFRONTS=off.
 implemented:true,
 async *listings(ctx){
  if(ctx.env.ML_STOREFRONTS==='off')return;
  let count=0;
  // Rodízio: o prazo da execução alcança só 3–4 vitrines (cada anúncio passa por gravação completa). Começar sempre
  // pela primeira deixava as do fim da lista sem nenhuma visita; o início avança 3 lojas a cada janela de 15 min.
  for(const store of rotateStores(ML_OFFICIAL_STORES,Date.now())){if(Date.now()>ctx.deadline||count>=ctx.maxListings)return;
   await new Promise(r=>setTimeout(r,1500));
   try{for(const l of parseOfficialStorefront(await fetchStorefront(ctx.fetch,store.slug),store)){yield l;if(++count>=ctx.maxListings)return;}}
   catch(e){console.error('mercadolivre loja '+store.slug+':',e instanceof Error?e.message.slice(0,160):'erro');}}
 },
};
