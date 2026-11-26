import {test} from 'node:test';import assert from 'node:assert/strict';
import {searchableCode,sameCodeUrl} from '../scripts/targeted';
import {targetedSearchUrl,targetedProductLinks,replacementUrls} from '../scripts/targeted-adapters';
test('targeted discovery: only strong manufacturer codes are searched and only same-code results accepted',()=>{
 assert.equal(searchableCode('KF432C16BB/16'),'kf432c16bb16');assert.equal(searchableCode('G305'),null);assert.equal(searchableCode('Fury Beast'),null);
 assert.equal(sameCodeUrl('https://www.kabum.com.br/produto/172366/memoria-ram-kingston-fury-beast-16gb-3200mhz-ddr4-cl16-preto-kf432c16bb1-16','kf432c16bb116'),true);
 assert.equal(sameCodeUrl('https://www.kabum.com.br/produto/172365/memoria-ram-kingston-fury-beast-8gb-3200mhz-ddr4-cl16-preto-kf432c16bb-8','kf432c16bb16'),false);
 assert.equal(sameCodeUrl('https://www.ibyte.com.br/memoria-kingston-kf432c16bb16/p','kf432c16bb16'),true);
 assert.equal(sameCodeUrl('https://www.chipart.com.br/produto/memoria-kf432c16bb-16/123','kf432c16bb16'),true);
 assert.equal(sameCodeUrl('https://patoloco.com.br/memoria-kf432c16bb-160','kf432c16bb16'),false,'code must not match a longer variant');
 assert.equal(sameCodeUrl('https://patoloco.com.br/memoria-akf432c16bb-16','kf432c16bb16'),false,'code must not match another manufacturer prefix');
});
test('targeted adapters only extract product URLs on their store; search terms stay in public HTML routes',()=>{
 assert.equal(targetedSearchUrl('ibyte','KF432C16BB/16'),'https://www.ibyte.com.br/kf432c16bb-16');
 assert.equal(targetedSearchUrl('shopinfo','KF432C16BB/16'),'https://shopinfo.com.br/search?q=KF432C16BB%2F16&type=product');
 assert.equal(targetedSearchUrl('waz','KF432C16BB/16'),null);
 const slug='memoria-kingston-fury-beast-kf432c16bb-16';
 assert.deepEqual(targetedProductLinks('patoloco',`<a href="/${slug}">x</a><a href="https://evil.example/${slug}">bad</a>`),['https://patoloco.com.br/'+slug]);
 assert.deepEqual(targetedProductLinks('ibyte',`<script>{"linkText":"${slug}"}</script>`),['https://www.ibyte.com.br/'+slug+'/p']);
 assert.deepEqual(targetedProductLinks('chipart',`<a href="/produto/${slug}/123">x</a>`),['https://www.chipart.com.br/produto/'+slug+'/123']);
 assert.deepEqual(targetedProductLinks('shopinfo',`<a href="/collections/hardware/products/${slug}">x</a>`),['https://shopinfo.com.br/products/'+slug]);
});
test('full discovery queue only replaces unprotected failed candidates, never an offer or exact hit, at most three',()=>{
 const urls=['has-offer','wanted','old1','old2','old3','old4'];
 assert.deepEqual(replacementUrls(urls,new Set(['has-offer']),['wanted'],10),['old1','old2','old3']);
 assert.deepEqual(replacementUrls(urls,new Set(urls),[],3),[]);
 assert.deepEqual(replacementUrls(urls,new Set(),[],0),[]);
});
