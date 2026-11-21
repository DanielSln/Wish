import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestCategory} from '../src/domain/category-suggestion.ts';
import {importProduct} from '../src/services/product-import.ts';
const cats=[{id:'tech',name:'Tecnologia'},{id:'home',name:'Casa'},{id:'clothes',name:'Roupas'}];
test('local category suggestions use product words and existing categories only',()=>{
 for(const [name,id] of [['Headset HyperX','tech'],['Monitor Samsung','tech'],['Sofá','home'],['Camiseta','clothes'],['Tênis','clothes']])assert.equal(suggestCategory(name,cats),id);
 assert.equal(suggestCategory('Samsung',cats),null);assert.equal(suggestCategory('Item qualquer',cats),null);assert.equal(suggestCategory('Sofá com monitor',cats),null);
 assert.equal(suggestCategory('Headset',[]),null);assert.equal(suggestCategory('Item',cats,'Tecnologia'), 'tech');
});
test('specific custom categories take precedence without creating a new category',()=>{
 const specific=[...cats,{id:'headsets',name:'Headsets'}];assert.equal(suggestCategory('Headset HyperX',specific),'headsets');
 assert.equal(suggestCategory('Headset HyperX',[...cats,{id:'peripherals',name:'Periféricos'}]),'peripherals');assert.equal(specific.length,4);
});
const final='https://produto.mercadolivre.com.br/MLB-123-fixture';
const html='<script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:'Monitor de teste',category:'Tecnologia',offers:{price:'99.90',priceCurrency:'BRL'}})+'</script>';
const response=()=>new Response(html,{headers:{'Content-Type':'text/html'}});
test('meli.la manually validates each hop and preserves the original and resolved Mercado Livre URLs',async()=>{
 const calls=[];const r=await importProduct('https://meli.la/fixture',undefined,async(url,options)=>{calls.push(url);assert.equal(options.redirect,'manual');return calls.length===1?new Response('',{status:302,headers:{Location:final}}):response()});
 assert.deepEqual(calls,['https://meli.la/fixture',final]);assert.equal(r.product.original_url,'https://meli.la/fixture');assert.equal(r.resolved_url,final);assert.equal(r.product.category_hint,'Tecnologia');assert.equal(r.product.notes,'');
});
test('short links reject private IPs, local hosts, lookalikes and other stores before the next request',async()=>{
 for(const location of ['http://www.mercadolivre.com.br/p','https://127.0.0.1/p','https://169.254.169.254/p','https://[::1]/p','https://localhost/p','https://produto.mercadolivre.com.br.evil.example/p','https://www.amazon.com.br/p','https://user:password@www.mercadolivre.com.br/p']){
  let calls=0;await assert.rejects(importProduct('https://meli.la/fixture',undefined,async()=>{calls++;return new Response('',{status:302,headers:{Location:location}})}));assert.equal(calls,1);
 }
});
test('cycles, excessive hops, missing locations and opaque browser redirects fail closed',async()=>{
 await assert.rejects(importProduct('https://meli.la/fixture',undefined,async()=>new Response('',{status:302,headers:{Location:'/fixture'}})),/ciclo/);
 let n=0;await assert.rejects(importProduct('https://meli.la/fixture',undefined,async()=>new Response('',{status:302,headers:{Location:'https://www.mercadolivre.com.br/hop'+(++n)}})),/limite/);assert.equal(n,5);
 await assert.rejects(importProduct('https://meli.la/fixture',undefined,async()=>new Response('',{status:302})),/destino/);
 await assert.rejects(importProduct('https://meli.la/fixture',undefined,async()=>({status:0,type:'opaqueredirect'})),/navegador/);
 await assert.rejects(importProduct('https://meli.la/fixture',undefined,async()=>new Response('',{status:403})),/HTTP 403/);
});
test('resolved pages retain size limits and cross-store redirects remain forbidden',async()=>{
 let n=0;await assert.rejects(importProduct('https://meli.la/fixture',undefined,async()=>++n===1?new Response('',{status:302,headers:{Location:final}}):new Response('',{headers:{'Content-Type':'text/html','Content-Length':'2000001'}})),/grande/);
 await assert.rejects(importProduct('https://www.amazon.com.br/product',undefined,async()=>new Response('',{status:302,headers:{Location:final}})),/destino não autorizado/);
});
