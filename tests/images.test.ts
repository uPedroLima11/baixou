import {test} from 'node:test';
import assert from 'node:assert/strict';
import {imageCandidates,rasterUrl} from '../lib/images';
const k='https://images.kabum.com.br/produtos/fotos/904364/mouse-gamer-attack-shark-r1-white_1771274097_gg.jpg';
test('KaBuM card uses _g thumbnail and keeps the original as second attempt',()=>{
 assert.deepEqual(imageCandidates(k,230),[k.replace('_gg.jpg','_g.jpg'),k]);
 assert.deepEqual(imageCandidates(k,48),[k.replace('_gg.jpg','_m.jpg'),k]);
 assert.deepEqual(imageCandidates(k,600),[k]);
});
test('VTEX and Shopify thumbnails come from the same CDN file',()=>{
 const v='https://waz.vtexassets.com/arquivos/ids/238983/131728-1-Placa.jpg?v=638886420244200000';
 assert.equal(imageCandidates(v,230)[0],'https://waz.vtexassets.com/arquivos/ids/238983-400-400/131728-1-Placa.jpg?v=638886420244200000');
 const s='https://shopinfo.com.br/cdn/shop/files/1_b0b3.png?v=1785373584&width=1920';
 assert.equal(imageCandidates(s,230)[0],'https://shopinfo.com.br/cdn/shop/files/1_b0b3.png?v=1785373584&width=480');
 assert.equal(imageCandidates(s,230)[1],s);
});
test('unsafe or non-raster images are refused',()=>{
 assert.equal(rasterUrl('http://images.kabum.com.br/a.jpg'),null);
 assert.equal(rasterUrl('https://x.com/a.svg'),null);
 assert.equal(rasterUrl('https://u:p@x.com/a.jpg'),null);
 assert.deepEqual(imageCandidates(null,230),[]);
 const ml='https://http2.mlstatic.com/D_Q_NP_2X_854723-MLA99919842923_112025-AB.webp';
 assert.deepEqual(imageCandidates(ml,230),[ml]);
});
