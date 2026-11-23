import {ExcludedProduct} from '../lib/product-policy';
import * as cheerio from 'cheerio/slim';import type {Offer} from '../lib/types';import {classify} from '../lib/types';
export function kabumDiscovery(html:string){const $=cheerio.load(html);const next=JSON.parse($('#__NEXT_DATA__').text()||'{}');const raw=next.props?.pageProps?.data;const data=typeof raw==='string'?JSON.parse(raw):raw;// Listagem já informa vendedor: itens de marketplace seriam excluídos por kabumProduct (só vendedor próprio), então nem são baixados.
 return (data?.catalogServer?.data??[]).filter((p:any)=>p.code&&p.friendlyName&&!(p.sellerId!=null&&Number(p.sellerId)!==0)&&p.flags?.isMarketplace!==true).map((p:any)=>'https://www.kabum.com.br/produto/'+p.code+'/'+p.friendlyName);}
export function kabumProduct(html:string,url:string):Omit<Offer,'historical_median'|'historical_samples'|'historical_days'|'discount'|'evidence'>{
 const $=cheerio.load(html);const next=JSON.parse($('#__NEXT_DATA__').text()||'{}');const p=next.props?.pageProps?.product;
 if(!p?.title||!p?.prices)throw new Error('Produto não encontrado no HTML');
 if(Number(p.sellerId)!==0||p.sellerName!=='KaBuM!'||p.flags?.isMarketplace||p.flags?.isMarketPlaceProduct)throw new ExcludedProduct('seller_untrusted');
 if(p.flags?.isPreOrder||p.flags?.isOpenbox)throw new ExcludedProduct('condition_excluded');
 const price=Number(p.prices.priceWithDiscount);if(!Number.isFinite(price)||price<=0)throw new Error('Preço inválido');
 const specDoc=cheerio.load(p.technicalInformation?.text??'');specDoc('br').replaceWith('\n');specDoc('p,li,tr').append('\n');
 const lines=specDoc.root().text().split(/\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
 const specs:Record<string,string>={};for(let i=0;i<lines.length;i++){const line=lines[i];const split=line.indexOf(':');if(split>0&&split<80){const k=line.slice(0,split).replace(/^[-•]\s*/,'');const v=line.slice(split+1).trim()||lines[i+1];if(v)specs[k.slice(0,80)]=v.slice(0,400);}}
 const mpn=Object.entries(specs).find(([k])=>/^(modelo|part number|mpn)$/i.test(k))?.[1]??null;
 const images=(p.medias??[]).map((m:any)=>m.images?.gg??m.images?.g).filter((s:any)=>typeof s==='string'&&s.startsWith('https://')&&new URL(s).hostname.endsWith('kabum.com.br')).slice(0,10);
 const now=new Date();return {id:'kabum-'+(p.id??new URL(url).pathname.split('/')[2]),store:'kabum',url:url.split('?')[0],title:String(p.title).slice(0,500),category:classify(p.title),brand:p.manufacturer?.name??null,mpn,image:images[0]??null,images,price,original_price:Number(p.prices.oldPrice)>price?Number(p.prices.oldPrice):null,available:!!p.available&&p.flags?.isAvailable===true&&p.flags?.isActive===true,seller:p.sellerName,sold:null,rating:p.rating?.score?Number(p.rating.score):p.rating?.average?Number(p.rating.average):null,review_count:Number(p.rating?.count)||null,specs,checked_at:now.toISOString(),expires_at:new Date(now.getTime()+30*60000).toISOString()};
}

// ChipArt (loja própria, Next.js): dados do produto no __NEXT_DATA__ renderizado no servidor.
// Preço = preco_pix, conferido com o "à vista no PIX" impresso no DOM. preco_lista NÃO é usado como preço antigo:
// a razão Pix/lista varia por produto e não bate com o total parcelado, então pode ser preço de cartão.
// Ficha estruturada (caracteristicas) traz Modelo e EAN do fabricante.
export function chipartLinks(html:string){const $=cheerio.load(html);return [...new Set($('a[href*="/produto/"]').toArray().map(a=>String($(a).attr('href')??'').trim().replace(/\/$/,'')))].filter(h=>/^(https:\/\/www\.chipart\.com\.br)?\/produto\/[^?#\s]+\/\d+$/.test(h)&&!/\/\.{1,2}(\/|$)/.test(h)).map(h=>h.startsWith('http')?h:'https://www.chipart.com.br'+h).slice(0,200);}
export function chipartProduct(html:string,url:string):Omit<Offer,'historical_median'|'historical_samples'|'historical_days'|'discount'|'evidence'>{
 const $=cheerio.load(html),next=JSON.parse($('#__NEXT_DATA__').text()||'{}'),data=next.props?.pageProps?.data?.product,p=data?.produto,store=next.props?.store;
 if(!p?.nome_produto)throw new Error('Produto não encontrado no HTML');
 if($('meta[property="og:site_name"]').attr('content')!=='CHIPART LTDA'||store?.b2c!==true)throw new ExcludedProduct('seller_untrusted');
 // A categoria pode linkar o produto por outro caminho; vale o mesmo ID, e a URL gravada é a do próprio produto.
 const path=new URL(url).pathname,id=path.match(/\/(\d+)$/)?.[1],own='/produto'+String(p.link??'').replace(/\s+/g,'').replace(/\/$/,'');// alguns links da loja trazem quebra de linha
 if(!id||String(p.codigo_sku)!==id||!/^\/produto\/[^?#\s]+\/\d+$/.test(own)||own.match(/\/(\d+)$/)?.[1]!==id||/\/\.{1,2}(\/|$)/.test(own))throw new Error('Produto da página diverge da URL');
 url='https://www.chipart.com.br'+own;
 const price=Number(p.preco_pix);if(!Number.isFinite(price)||price<=0)throw new Error('Preço inválido');
 const pixLabel=$('span').filter((_,e)=>/^à vista no PIX$/i.test($(e).text().trim())).first(),shown=Number((pixLabel.prev('strong').text().match(/R\$\s*([\d.]+,\d{2})/)?.[1]??'').replace(/\./g,'').replace(',','.'));
 if(!shown||Math.abs(shown-price)>.02)throw new Error('Preço Pix diverge do produto');
 const stock=Number(p.quantidade_estoque);if(!Number.isFinite(stock))throw new Error('Estoque não informado');
 const specs:Record<string,string>={};for(const c of data.caracteristicas??[]){const k=String(c.descricao_caracteristica??'').trim().slice(0,80),v=String(c.descricao_opcao_caracteristica??'').trim().slice(0,400);if(k&&v)specs[k]=v;}
 const base=String(store?.imagesUrl?.detail??'');const images=base==='https://i.chipart.openk.com.br/detalhe'?[...(data.fotos??[])].sort((a:any,b:any)=>(b.padrao-a.padrao)||(a.ordem-b.ordem)).map((f:any)=>String(f.descricao_imagem??'')).filter(n=>/^[\w.-]+\.(?:jpe?g|png|webp)$/i.test(n)).map(n=>base+'/'+n).slice(0,10):[];
 const mpn=specs.Modelo&&!/\s/.test(specs.Modelo)&&/\d/.test(specs.Modelo)?specs.Modelo:null,title=String(p.nome_produto).trim().slice(0,500),now=new Date();
 return {id:'chipart-'+id,store:'chipart',url,title,category:classify(title),brand:p.nome_fabricante?String(p.nome_fabricante):null,mpn,image:images[0]??null,images,price,original_price:null,available:stock>0,seller:'ChipArt',sold:null,rating:null,review_count:null,specs,payment_note:'À vista no Pix, confirmado no produto.',checked_at:now.toISOString(),expires_at:new Date(now.getTime()+30*60000).toISOString()};
}
