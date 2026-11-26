import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {parseChannelPage,postToListing,postPrice,postTitle,type ChannelConfig} from '../lib/connectors/telegram-channels';
import {brandInTitle,manufacturerCode} from '../lib/identity';
const tera:ChannelConfig={channel:'terabyteshopoficial',source:'terabyte',storeName:'Terabyte',productHost:'www.terabyteshop.com.br',productPath:/^\/produto\/(\d+)\/[\w-]+\/?$/,channelLabel:'canal oficial da Terabyte no Telegram'};
const pich:ChannelConfig={channel:'pichauofertas',source:'pichau',storeName:'Pichau',productHost:'www.pichau.com.br',productPath:/^\/([a-z0-9][a-z0-9-]{8,200})\/?$/,shortHosts:['pruuu.me'],minSlugParts:4,channelLabel:'canal da Pichau no Telegram'};
test('generic store post reuses a previously published title only for its exact canonical URL',()=>{
 const url='https://www.terabyteshop.com.br/produto/10712/fonte-pcyes-electro-v2-650w-80-plus-bronze-pfc-ativo';
 const p={id:129047,date:'2026-11-26T20:58:00Z',text:'✨ Produto ✨\n💰 A partir de: R$ 249,99',links:[url+'?p=1798490']};
 const titles=new Map([[url,'Fonte PCYes Electro V2 650W, 80 Plus Bronze, PFC Ativo']]);
 assert.equal(postToListing(p,tera).ok,false);
 const d=postToListing(p,tera,undefined,titles);assert.ok(d.ok);assert.equal(d.listing.price,249.99);assert.equal(d.listing.title,titles.get(url));
 assert.equal(postToListing({...p,links:[url.replace('10712','10713')]},tera,undefined,titles).ok,false);
 assert.equal(postToListing({...p,text:p.text.replace('Produto','Cadeira Azul')},tera,undefined,titles).ok,false,'conflicting explicit title never replaced');
 assert.equal(postToListing(p,tera,undefined,new Map([[url,'Cadeira Azul Grande']])).ok,false);
});

test('parses real Terabyte channel posts into product listings (Pix price, canonical URL, post time)',()=>{
 const posts=parseChannelPage(readFileSync('tests/fixtures/telegram-terabyte.html','utf8'),'terabyteshopoficial');
 assert.ok(posts.length>=8);assert.ok(posts.every((p,i)=>i===0||posts[i-1].id>p.id),'newest first');
 const ok=posts.map(p=>postToListing(p,tera)).filter(d=>d.ok).map(d=>d.ok?d.listing:null)!;
 assert.ok(ok.length>=5);
 const gpu=ok.find(l=>l!.externalId==='44165')!;
 assert.equal(gpu.price,3139.99);assert.equal(gpu.url,'https://www.terabyteshop.com.br/produto/44165/placa-de-video-gainward-nvidia-geforce-rtx-5060-ghost-8gb-gddr7-dlss-ray-tracing-ne75060019p1-gb2063b');
 assert.match(gpu.title,/^Placa de Vídeo Gainward NVIDIA GeForce RTX 5060 Ghost, 8GB, GDDR7, DLSS, Ray Tracing, NE75060019P1-GB2063B$/);
 assert.equal(gpu.announcement!.postedAt,'2026-11-24T00:40:06.000Z');assert.equal(gpu.paymentBasis,'cash');assert.equal(gpu.originalPrice,null);
 assert.equal(manufacturerCode(null,gpu.title),'NE75060019P1GB2063B');
 for(const l of ok){assert.ok(!new URL(l!.url).search,'tracking query removed');assert.equal(l!.seller.name,'Terabyte');}
});

test('price parsing: single cash value, "De X por Y", installment kept apart, ambiguous rejected',()=>{
 assert.deepEqual(postPrice('Produto\n💰 A partir de: R$ 149,99\n👉 link'),{price:149.99,original:null,installmentTotal:null});
 assert.deepEqual(postPrice('Produto\n🛒 Oferta a partir de R$499,99\n💳 Ou Parcelado R$588,22'),{price:499.99,original:null,installmentTotal:588.22});
 assert.deepEqual(postPrice('X\n💰 De R$ 1.000,00 por R$ 899,90'),{price:899.9,original:1000,installmentTotal:null});
 assert.equal(postPrice('X\n💰 R$ 100,00 ou R$ 120,00'),null);
 assert.equal(postPrice('X\n10x de R$ 50,00'),null);
});

test('rejects coupon-conditioned, non-new, off-store and title/link mismatch posts',()=>{
 const base={id:1,date:'2026-11-24T00:00:00Z',links:['https://www.terabyteshop.com.br/produto/1/memoria-kingston-fury-beast-16gb-ddr5'],text:'Memória Kingston Fury Beast 16GB DDR5\n💰 R$ 500,00'};
 assert.ok(postToListing(base,tera).ok);
 assert.deepEqual(postToListing({...base,text:base.text+'\nPreço final com o cupom TERA10'},tera),{ok:false,reason:'preço condicionado a cupom'});
 assert.deepEqual(postToListing({...base,text:'Memória Kingston Fury Beast 16GB DDR5\n💰 R$ 500,00 com cupom'},tera),{ok:false,reason:'preço condicionado a cupom'});
 const hint=postToListing({...base,text:base.text+'\nCUPOM 5% OFF'},tera);assert.ok(hint.ok&&hint.listing.price===500&&hint.listing.couponHint==='CUPOM 5% OFF','separate coupon line = unvalidated hint, price unchanged');
 assert.deepEqual(postToListing({...base,text:'Open Box '+base.text},tera),{ok:false,reason:'condição diferente de novo'});
 assert.ok(postToListing({...base,text:'Memória Kingston Fury Beast 16GB DDR5 — visual de vitrine\n💰 R$ 500,00'},tera).ok,'marketing "vitrine" is not a condition');
 assert.deepEqual(postToListing({...base,text:'Memória Kingston Fury Beast 16GB DDR5 Usada\n💰 R$ 500,00'},tera),{ok:false,reason:'condição diferente de novo'});
 assert.deepEqual(postPrice('🌙 PRUUMO DA MADRUGADA!\nPreço à vista R$54,99\nControle X\nParcelado R$64,69'),{price:54.99,original:null,installmentTotal:64.69});
 assert.deepEqual(postToListing({...base,links:['https://evil.example/produto/1/x']},tera),{ok:false,reason:'sem link de produto da loja'});
 assert.deepEqual(postToListing({...base,text:'Cadeira Gamer Azul Confortável\n💰 R$ 500,00'},tera),{ok:false,reason:'título não confere com o link'});
 assert.equal(postTitle('🔥 Chamada\nMemória Kingston Fury Beast 16GB DDR5 — envio rápido\n💰 R$ 1,00','https://www.terabyteshop.com.br/produto/1/memoria-kingston-fury-beast-16gb-ddr5'),'Memória Kingston Fury Beast 16GB DDR5');
});

test('Pichau posts need the pruuu.me redirect target on pichau.com.br; cash and installment separated',()=>{
 const posts=parseChannelPage(readFileSync('tests/fixtures/telegram-pichau.html','utf8'),'pichauofertas');
 assert.ok(posts.length>=4);
 const chair=posts.find(p=>/Acegeek Lorien/.test(p.text))!;
 assert.equal(postToListing(chair,pich).ok,false,'short link without resolution is not a store URL');
 const d=postToListing(chair,pich,'https://www.pichau.com.br/cadeira-gamer-acegeek-lorien-tecido-preto-ag-lorien-bk');
 assert.ok(d.ok);if(d.ok){assert.equal(d.listing.price,499.99);assert.equal(d.listing.announcement!.installmentTotal,588.22);assert.equal(d.listing.title,'Cadeira Gamer Acegeek Lorien, Tecido, Preto');}
});

test('brand from title only among catalog brands; first occurrence (board maker) wins',()=>{
 const brands=new Set(['gainward','nvidia','kingston','havit']);
 assert.equal(brandInTitle('Placa de Vídeo Gainward NVIDIA GeForce RTX 5060',brands),'Gainward');
 assert.equal(brandInTitle('Memória Kingston Fury 16GB',brands),'Kingston');
 assert.equal(brandInTitle('Cadeira Gamer Acegeek Lorien',brands),null);
});
import {knownCodeInSlug} from '../lib/identity';
test('post photo comes from the same post (Telegram CDN, https); Pichau category links rejected',()=>{
 const posts=parseChannelPage(readFileSync('tests/fixtures/telegram-terabyte.html','utf8'),'terabyteshopoficial');
 const withPhoto=posts.filter(p=>p.photo);assert.ok(withPhoto.length>=5);
 for(const p of withPhoto)assert.match(p.photo!,/^https:\/\/cdn\d*\.telesco\.pe\/file\/[A-Za-z0-9_-]+\.jpg$/);
 const d=postToListing(withPhoto.find(p=>/terabyteshop\.com\.br\/produto/.test(p.links.join(' ')))!,tera);assert.ok(d.ok&&d.listing.images.length===1);
 const cat={id:9,date:'2026-11-24T00:00:00Z',links:['https://pruuu.me/x'],text:'Placas de vídeo em oferta\n🛒 Oferta a partir de R$999,99'};
 assert.deepEqual(postToListing(cat,pich,'https://www.pichau.com.br/placas-de-video'),{ok:false,reason:'link não parece página de produto'});
});
test('manufacturer code from the store URL slug only when identical to a known code of the same brand',()=>{
 const known=new Map([['amd',new Set(['100100000591WOF','100100000926WOF'])],['acegeek',new Set(['AGLORIENBK'])]]);
 assert.equal(knownCodeInSlug('https://www.pichau.com.br/processador-amd-ryzen-7-7700x-8-core-am5-100-100000591wof','AMD',known),'100100000591WOF');
 assert.equal(knownCodeInSlug('https://www.pichau.com.br/processador-amd-ryzen-7-7700x-8-core-am5-100-100000591wof','Intel',known),null);
 assert.equal(knownCodeInSlug('https://www.pichau.com.br/processador-amd-ryzen-7-7700x-8-core-am5','AMD',known),null);
});
