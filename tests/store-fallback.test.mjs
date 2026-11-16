import test from 'node:test';
import assert from 'node:assert/strict';
import {extractProduct,importDestination,importProduct,linkImportPlan,manualProductFromLink,ProductMetadataUnavailable} from '../src/services/product-import.ts';
const source='https://www.youcom.com.br/camiseta-fixture';
const product={'@type':'Product',name:'Camiseta de teste',image:'https://img.youcom.com.br/fixture.png',offers:{price:'79.90',priceCurrency:'BRL'}};
const html=p=>'<script type="application/ld+json; charset=utf-8">'+JSON.stringify(p)+'</script>';
test('reviewed Youcom hosts use the generic JSON-LD parser and dedicated HTTPS image host',async()=>{
 assert.equal(importDestination(source),source);const r=await importProduct(source,undefined,async()=>new Response(html(product),{headers:{'Content-Type':'text/html'}}));assert.equal(r.product.name,product.name);assert.equal(r.product.price_cents,7990);assert.equal(r.product.image_url,product.image);
 assert.equal(extractProduct(html({...product,image:'https://other-cdn.example/image'}),source).product.image_url,'');
});
test('unknown HTTPS shops can create a manual draft, without any automatic network access',async()=>{
 const url='https://clothes.example/product?ref=fixture';assert.deepEqual(linkImportPlan(url),{url,host:'clothes.example',automatic:false});assert.deepEqual(manualProductFromLink(url),{original_url:url,store:'clothes.example'});
 let requests=0;await assert.rejects(importProduct(url,undefined,async()=>{requests++}),/manual/);assert.equal(requests,0);
});
test('missing metadata differs from invalid links and the manual draft preserves the ML link',()=>{
 assert.throws(()=>extractProduct('<html><title>Entre na loja</title></html>','https://www.mercadolivre.com.br/product'),e=>e instanceof ProductMetadataUnavailable&&e.code==='METADATA_UNAVAILABLE');
 assert.equal(manualProductFromLink('https://meli.la/1pXnAoY').original_url,'https://meli.la/1pXnAoY');
 for(const url of ['http://example.com/p','https://127.0.0.1/p','https://[::1]/p','https://localhost.localdomain/p','https://metadata.google.internal/p','https://router.lan/p','https://user:password@example.com/p'])assert.throws(()=>linkImportPlan(url));
});
test('generic Open Graph remains available but shop homepages are not mistaken for products',()=>{
 const r=extractProduct('<meta property="og:title" content="Camiseta"><meta property="og:type" content="product"><meta property="product:price:amount" content="49.90"><meta property="product:price:currency" content="BRL">',source);assert.equal(r.product.price_cents,4990);
 assert.throws(()=>extractProduct('<meta property="og:title" content="Loja"><meta property="og:type" content="website">',source),ProductMetadataUnavailable);
 assert.throws(()=>extractProduct('<meta property="og:title" content="Loja">','https://www.youcom.com.br/'),ProductMetadataUnavailable);
});
test('a single structured variant and partial metadata are reviewable; multiple variants stay ambiguous',()=>{
 const r=extractProduct(html({'@type':'ProductGroup',hasVariant:[product]}),source);assert.equal(r.product.name,product.name);
 assert.throws(()=>extractProduct(html({'@type':'ProductGroup',hasVariant:[product,{...product,name:'Outra variante'}]}),source),/vários produtos/);
 const partial=extractProduct(html({...product,name:undefined}),source);assert.equal(partial.product.name,'');assert.equal(partial.product.price_cents,7990);assert.ok(partial.warnings.some(w=>w.includes('nome')));
});
