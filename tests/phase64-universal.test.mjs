// Synthetic public-metadata fixtures. These do not prove live-store/Android compatibility.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedLinks, originalImportUrl } from '../src/services/import-links.ts';
import { extractProduct, importProduct, importUrl, linkImportPlan, manualProductFromLink } from '../src/services/product-import.ts';
import { importFailureMessage } from '../src/services/import-messages.ts';
import { importPriceSummary } from '../src/domain/price-presentation.ts';
import { kabumPage, kabumSource, pricingTime } from './fixtures/kabum-public-pricing.mjs';
import { microdataProducts } from '../src/services/product-microdata.ts';
import { validateProduct } from '../src/domain/product.ts';
import { importDraft } from '../src/domain/import-draft.ts';
const source = 'https://www.amazon.com.br/dp/B0GRWJ9QBR?psc=1';
const product = { '@type': 'Product', name: 'Headset fixture', offers: { '@type': 'Offer', price: '99.90', priceCurrency: 'BRL' } };
const json = item => '<script type="application/ld+json">'+JSON.stringify(item)+'</script>';
const response = html => new Response(html,{headers:{'Content-Type':'text/html'}});
test('shared text extracts one or several distinct URLs without losing variant/tracking parameters', () => {
 const a='https://www.mercadolivre.com.br/p/MLBU4871586876?pdp_filters=item_id%3AMLB5097782981&matt_source=fixture';
 assert.deepEqual(sharedLinks('Olha este headset! ('+a+').'),[a]);
 assert.deepEqual(sharedLinks('Produto '+source+' ou https://loja.example/item?variant=2 '+source),[source,'https://loja.example/item?variant=2']);
 assert.deepEqual(sharedLinks('[produto](https://loja.example/a_(b))'),['https://loja.example/a_(b)']);
 assert.deepEqual(sharedLinks('sem link'),[]); assert.deepEqual(sharedLinks('x'.repeat(16385)),[]);
});
test('original fragment and every essential query remain separate from consultation URL', () => {
 const url='https://loja.example/p?variant=2&seller_id=3&item_id=4&gclid=fixture#azul';
 assert.equal(originalImportUrl(url),url); assert.equal(importUrl(url),url.split('#')[0]);
 assert.deepEqual(manualProductFromLink(url),{original_url:url,store:'loja.example'});
 assert.equal(linkImportPlan(url).automatic,false);
});
test('long shared URLs remain savable without changing database schema or image URL bounds', () => {
 const url='https://loja.example/p?ref='+ 'x'.repeat(3000);
 const draft=importDraft({...product,name:'Produto',description:'',image_url:'',price_cents:null,store:'loja.example',original_url:url,notes:'',offer_details:''},[{id:'c',name:'Casa'}]);draft.category_id='c';
 assert.equal(validateProduct(draft).original_url,undefined); assert.equal(manualProductFromLink(url).original_url,url);
 assert.throws(()=>importUrl('https://loja.example/'+ 'x'.repeat(8192)),/8192/);
});
test('unknown DNS and unverified Shopee/Ali shorteners never trigger a request',async()=>{
 let calls=0;
 for(const host of ['unreviewed.example','127.0.0.1.nip.io','shope.ee','s.shopee.com.br','a.aliexpress.com','s.click.aliexpress.com']) {
  await assert.rejects(importProduct('https://'+host+'/x',undefined,async()=>{calls++}));
  assert.equal(manualProductFromLink('https://'+host+'/x').original_url,'https://'+host+'/x');
 }
 assert.equal(calls,0);
});
test('a.co chain validates each Amazon destination and saves the original short URL',async()=>{
 const calls=[];
 const result=await importProduct('https://a.co/d/fixture',undefined,async(url,options)=>{calls.push(url);assert.equal(options.redirect,'manual');return calls.length===1?new Response('',{status:301,headers:{Location:source}}):response(json(product))});
 assert.deepEqual(calls,['https://a.co/d/fixture',source]);assert.equal(result.product.original_url,'https://a.co/d/fixture');assert.equal(result.resolved_url,source);assert.match(result.product.offer_details,/B0GRWJ9QBR/);
});
test('normal redirects stay within the original reviewed store family',async()=>{
 let calls=0;
 const result=await importProduct('https://amazon.com.br/p',undefined,async()=>++calls===1?new Response('',{status:308,headers:{Location:source}}):response(json(product)));
 assert.equal(calls,2);assert.equal(result.product.original_url,'https://amazon.com.br/p');assert.equal(result.resolved_url,source);
});
test('Amazon shorteners reject private, cross-store, deceptive and non-HTTPS destinations before next request',async()=>{
 for(const target of ['https://127.0.0.1/','https://[::1]/','https://169.254.169.254/','https://www.amazon.com.br.evil.example/','https://www.kabum.com.br/p','http://www.amazon.com.br/p','https://user:secret@www.amazon.com.br/p']) {
  let calls=0;await assert.rejects(importProduct('https://a.co/d/fixture',undefined,async()=>{calls++;return new Response('',{status:302,headers:{Location:target}})}));assert.equal(calls,1);
 }
});
test('shortener cycles and shortener responses without a resolved store fail closed',async()=>{
 await assert.rejects(importProduct('https://a.co/d/fixture',undefined,async()=>new Response('',{status:302,headers:{Location:'/d/fixture'}})),/ciclo/);
 await assert.rejects(importProduct('https://a.co/d/fixture',undefined,async()=>response(json(product))),/não chegou/);
});
test('generic microdata nested Product/Offer supports text, content, image and currency',()=>{
 const html='<main itemscope itemtype="https://schema.org/Product"><h1 itemprop="name">Fone &amp; música</h1><img itemprop="image" src="https://m.media-amazon.com/fixture.png"><div itemprop="offers" itemscope itemtype="https://schema.org/Offer"><meta itemprop="price" content="123.45"><meta itemprop="priceCurrency" content="BRL"><link itemprop="availability" href="https://schema.org/InStock"></div></main>';
 const result=extractProduct(html,source);assert.equal(result.product.name,'Fone & música');assert.equal(result.product.price_cents,12345);assert.equal(result.product.image_url,'https://m.media-amazon.com/fixture.png');
});
test('microdata never executes scripts or fetches itemref/itemid; malicious depth fails closed',()=>{
 assert.deepEqual(microdataProducts('<script>'+ '<div itemscope itemtype="https://schema.org/Product">'+'</script>'),[]);
 assert.deepEqual(microdataProducts('<div>'.repeat(65)+'<div itemscope itemtype="https://schema.org/Product"></div>'),[]);
 const result=microdataProducts('<div itemscope itemtype="https://schema.org/Product" itemref="external"><span itemprop="name">Manual</span></div>');assert.equal(result[0].name,'Manual');
});
test('partial OG metadata without a name retains confirmed BRL price, requiring manual name',()=>{
 const result=extractProduct('<meta property="product:price:amount" content="10"><meta property="product:price:currency" content="BRL">',source);
 assert.equal(result.product.name,'');assert.equal(result.product.price_cents,1000);assert.match(result.warnings.join(' '),/nome/);
});
test('multiple products select only a uniquely matched product URL or identifier',()=>{
 const second={...product,name:'Wrong variant',url:'https://www.amazon.com.br/dp/B000000000'};
 assert.equal(extractProduct(json([second,{...product,url:source}]),source).product.name,product.name);
 assert.throws(()=>extractProduct(json([product,second]),'https://www.amazon.com.br/search'),/vários produtos/);
});
test('ambiguous variants preserve only page title/description, never arbitrary image or price',()=>{
 const html='<meta property="og:title" content="Escolha sua variante"><meta property="product:price:amount" content="1"><meta property="product:price:currency" content="BRL"><meta property="og:image" content="https://m.media-amazon.com/wrong.jpg">'+json([product,{...product,name:'Outro'}]);
 const result=extractProduct(html,source);assert.equal(result.product.name,'Escolha sua variante');assert.equal(result.product.price_cents,null);assert.equal(result.product.image_url,'');
});
test('conflicting product or offer variant URL never supplies a price for another variant',()=>{
 assert.throws(()=>extractProduct(json({...product,url:'https://www.amazon.com.br/dp/B000000000'}),source),/variante/);
 assert.equal(extractProduct(json({...product,offers:{...product.offers,url:source+'&variant=wrong'}}),source+'&variant=chosen').product.price_cents,null);
});
test('JS shells and protection interstitials are distinct from missing metadata',()=>{
 assert.throws(()=>extractProduct('<noscript>Please enable JavaScript on your browser.</noscript>',source),/JavaScript/);
 assert.throws(()=>extractProduct('<title>Amazon.com.br</title>Clique no botão abaixo para continuar comprando',source),/bloqueou/);
 assert.throws(()=>extractProduct('<html>Sem dados</html>',source),/não disponibilizou/);
 // Product description mentioning JavaScript is not itself an interstitial.
 assert.equal(extractProduct(json({...product,description:'Livro enable JavaScript'}),source).product.name,product.name);
});
test('HTTP blocking, unavailable, unsafe redirect, connection and JS messages remain distinct',()=>{
 assert.match(importFailureMessage(new Error('HTTP 429')),/bloqueou/);
 assert.match(importFailureMessage(new Error('HTTP 503')),/temporariamente/);
 assert.match(importFailureMessage(new Error('destino não autorizado')),/Redirecionamento/);
 assert.match(importFailureMessage(new Error('Não foi possível acessar a loja')),/conexão/);
 assert.match(importFailureMessage(new Error('JavaScript')),/JavaScript/);
});
test('equal explicit KaBuM PIX price remains classified and selected without coupon arithmetic',()=>{
 const result=extractProduct(kabumPage({product:{prices:{oldPrice:150,price:100,priceWithDiscount:100}}}),kabumSource,pricingTime);
 assert.equal(result.prices.current_cents,10000);assert.equal(result.prices.conditional.price_cents,10000);assert.equal(result.product.price_cents,10000);assert.equal(result.prices.coupon.price_cents,null);assert.match(importPriceSummary(result.prices).lowest.label,/PIX/);assert.match(result.product.offer_details,/PIX/);
});
test('equal numbers alone never establish PIX and ordinary coupon ties stay unconditional',()=>{
 const html=kabumPage({product:{prices:{oldPrice:150,price:100,priceWithDiscount:100}}}).replace('<p>à vista no PIX</p>','');
 const result=extractProduct(html,kabumSource,pricingTime);assert.equal(result.prices.conditional,null);assert.equal(importPriceSummary(result.prices).lowest.conditional,false);
 const p={current_cents:100,original_cents:null,conditional:null,coupon:{code:'CODE',price_cents:100,conditions:'fixture',expired:false}};assert.equal(importPriceSummary(p).lowest.conditional,false);
});
test('foreign currency remains explicit evidence without converting or filling BRL amount',()=>{
 const result=extractProduct(json({...product,offers:{price:'20',priceCurrency:'USD'}}),source);assert.equal(result.product.price_cents,null);assert.match(result.product.offer_details,/USD/);
});
test('unavailable and mismatched variant offers remain partial and do not supply prices',()=>{
 for(const offer of [{...product.offers,availability:'https://schema.org/OutOfStock'},{...product.offers,itemOffered:{sku:'wrong'}}]){const r=extractProduct(json({...product,sku:'chosen',offers:offer}),source);assert.equal(r.product.name,product.name);assert.equal(r.product.price_cents,null)}
});
test('observed CDN hosts stay bound to their own reviewed store and unknown image hosts stay excluded',()=>{
 for(const [page,image] of [['https://www.casasbahia.com.br/p','https://imgs.casasbahia.com.br/fixture.jpg'],['https://pt.aliexpress.com/item/fixture','https://ae-pic-a1.aliexpress-media.com/fixture.jpg'],['https://www.magazineluiza.com.br/p','https://wx.mlcdn.com.br/fixture.jpg']]){
  assert.equal(extractProduct(json({...product,image}),page).product.image_url,image);
  assert.equal(extractProduct(json({...product,image}),source).product.image_url,'');
 }
 assert.equal(extractProduct(json({...product,image:'https://unknown.example/product.jpg'}),source).product.image_url,'');
});

test('explicit Google URL wrappers are decoded locally while original links remain untouched',async()=>{
 const wrapper='https://www.google.com/url?q='+encodeURIComponent(source+'&variant=blue&seller_id=store');
 assert.equal(linkImportPlan(wrapper).url,source+'&variant=blue&seller_id=store');
 let called='';const result=await importProduct(wrapper,undefined,async url=>{called=url;return response(json(product))});
 assert.equal(called,source+'&variant=blue&seller_id=store');assert.equal(result.product.original_url,wrapper);
 assert.throws(()=>linkImportPlan('https://www.google.com/url?q='+encodeURIComponent('https://127.0.0.1/')),/HTTPS/);
 assert.equal(linkImportPlan('https://www.google.com/shopping/product/fixture').automatic,false);
});
test('shared links preserve punctuation that is part of a query value',()=>{
 assert.deepEqual(sharedLinks('Confira https://loja.example/p?variant=hello!'),['https://loja.example/p?variant=hello!']);
});
test('microdata parser bounds malformed tags and ignores prototype properties',()=>{
 assert.deepEqual(microdataProducts('<div title="'+ 'x'.repeat(17000)),[]);
 const result=microdataProducts('<main itemscope itemtype="https://schema.org/Product"><span itemprop="__proto__">bad</span><meta itemprop="name" content="Safe"></main>');
 assert.equal(Object.hasOwn(result[0],'__proto__'),false);assert.equal(result[0].name,'Safe');
});

test('selected metadata never borrows another product OG price/image or ignores explicit variant identity',()=>{
 const chosen={...product,url:source};const wrong={...product,name:'Wrong',url:'https://www.amazon.com.br/dp/B000000000'};
 const meta='<meta property="product:sale_price:amount" content="1"><meta property="product:sale_price:currency" content="BRL"><meta property="og:image" content="https://m.media-amazon.com/wrong.jpg">';
 const result=extractProduct(meta+json([chosen,wrong]),source);assert.equal(result.product.price_cents,9990);assert.equal(result.product.image_url,'');
 assert.throws(()=>extractProduct(json([chosen,wrong]),source+'&variant=blue'),/vários produtos/);
 const matched={...chosen,url:source+'&variant=blue',offers:{...product.offers,url:source+'&variant=red'}};
 assert.equal(extractProduct(json([matched,wrong]),source+'&variant=blue').product.price_cents,null);
});
test('Mercado Livre catalog and listing identifiers are separate and essential filters select the listing',()=>{
 const url='https://www.mercadolivre.com.br/p/MLBU4871586876?pdp_filters=item_id%3AMLB5097782981';
 const selected={...product,name:'Chosen listing',url:'https://produto.mercadolivre.com.br/MLB-5097782981-fixture'};
 const wrong={...product,url:'https://produto.mercadolivre.com.br/MLB-0000000000-fixture'};
 assert.equal(extractProduct(json([selected,wrong]),url).product.name,'Chosen listing');
});
