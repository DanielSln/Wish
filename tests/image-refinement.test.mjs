import test from 'node:test';
import assert from 'node:assert/strict';
import {remoteImageBytes,ImageLoadError,imageErrorMessage,MAX_IMAGE_BYTES,createImageManager} from '../src/domain/image-management.ts';
import {productImagePresentation} from '../src/domain/image-layout.ts';
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1sAAAAASUVORK5CYII=','base64'));
const source='https://img.youcom.com.br/photo.png?width=1&token=unchanged';
const response=()=>new Response(png,{headers:{'Content-Type':'image/png'}});
const rejects=(promise,code)=>assert.rejects(promise,e=>e instanceof ImageLoadError&&e.code===code);
test('direct HTTPS raster response succeeds; canonical host/port/fragment differences are not redirects',async()=>{
 const original='https://IMG.YOUCOM.COM.BR:443/photo.png?width=1&token=unchanged#preview';let called='';
 const bytes=await remoteImageBytes(original,async(url,options)=>{called=url;assert.equal(options.redirect,'manual');const result=response();Object.defineProperty(result,'url',{value:source});return result;});assert.equal(called,original);assert.deepEqual(bytes,png);
});
test('URL validation, missing image content, malformed body and actual byte limits have separate messages',async()=>{
 let calls=0;const request=async()=>{calls++;return response()};
 await rejects(remoteImageBytes('http://img.youcom.com.br/a',request),'URL');await rejects(remoteImageBytes('not-a-link',request),'URL');assert.equal(calls,0);
 await rejects(remoteImageBytes(source,async()=>new Response('<html>Page</html>',{headers:{'Content-Type':'text/html'}})),'CONTENT');
 await rejects(remoteImageBytes(source,async()=>new Response('not-image',{headers:{'Content-Type':'image/png'}})),'FORMAT');
 await rejects(remoteImageBytes(source,async()=>new Response(new Uint8Array(),{headers:{'Content-Type':'image/png'}})),'FORMAT');
 await rejects(remoteImageBytes(source,async()=>new Response(png,{headers:{'Content-Type':'image/png','Content-Length':String(MAX_IMAGE_BYTES+1)}})),'SIZE');
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(MAX_IMAGE_BYTES+1));c.close()}});await rejects(remoteImageBytes(source,async()=>new Response(stream,{headers:{'Content-Type':'image/png'}})),'SIZE');
});
test('network, server and local-cache failure are not reported as HTTPS or size errors',async()=>{
 await rejects(remoteImageBytes(source,async()=>{throw new TypeError('Network request failed')}),'NETWORK');
 for(const status of [403,404,500])await rejects(remoteImageBytes(source,async()=>new Response('error',{status})),'SERVER');
 const storage={async readPicked(){return png},async persist(){return ''},async resolve(){return null},async temporary(){throw new Error('private/path/cache write failed')}};
 await rejects(createImageManager(storage,async()=>response()).remote(source),'CACHE');
 assert.ok(!imageErrorMessage(new ImageLoadError('NETWORK','Falha de conexão')).includes('8 MB'));assert.match(imageErrorMessage(new ImageLoadError('NETWORK','Falha de conexão'),true),/navegador/);assert.ok(!imageErrorMessage(new Error('/private/path')).includes('/private'));
});
test('both otherwise-safe and unsafe redirects are rejected before any target request; opaque redirects fail closed',async()=>{
 for(const location of ['https://img.youcom.com.br/final.png','https://127.0.0.1/private','http://img.youcom.com.br/insecure','file:///private']){
  let calls=0;await rejects(remoteImageBytes(source,async()=>{calls++;return new Response(null,{status:302,headers:{Location:location}})}),'REDIRECT');assert.equal(calls,1);
 }
 const opaque=response();Object.defineProperty(opaque,'type',{value:'opaqueredirect'});await rejects(remoteImageBytes(source,async()=>opaque),'REDIRECT');
 const changed=response();Object.defineProperty(changed,'url',{value:'https://other.example/image'});await rejects(remoteImageBytes(source,async()=>changed),'REDIRECT');
});
test('deadline distinguishes timeout from explicit cancellation without relaxing twelve-second limit',async context=>{
 context.mock.timers.enable({apis:['setTimeout']});
 const pending=remoteImageBytes(source,async()=>new Response(new ReadableStream({}),{headers:{'Content-Type':'image/png'}}));
 await Promise.resolve();await Promise.resolve();context.mock.timers.tick(12000);await rejects(pending,'TIMEOUT');
 context.mock.timers.reset();
 const controller=new AbortController();controller.abort();await rejects(remoteImageBytes(source,async()=>response(),controller.signal),'CANCELLED');
});
test('adequate card photos fill the compact frame; small/panoramic photos avoid distortion and aggressive scaling',()=>{
 const card=productImagePresentation(1022,1400,98,98,3);assert.deepEqual(card,{width:98,height:98,resizeMode:'cover'});
 const landscape=productImagePresentation(1600,1200,98,98,3);assert.equal(landscape.resizeMode,'cover');
 const tiny=productImagePresentation(77,105,98,98,3);assert.equal(tiny.resizeMode,'contain');assert.ok(tiny.width*3<=77.00001);assert.ok(Math.abs(tiny.width/tiny.height-77/105)<1e-10);
 const wide=productImagePresentation(4000,500,98,98,3);assert.equal(wide.resizeMode,'contain');
 const detail=productImagePresentation(1022,1400,360,260,3,true);assert.equal(detail.resizeMode,'contain');assert.ok(Math.abs(detail.width/detail.height-1022/1400)<1e-10);
 assert.equal(productImagePresentation(1800,1300,360,260,3,true).resizeMode,'cover');
});

test('a filename/MIME claiming PNG does not make an ICO or another payload a supported raster',async()=>{
 const ico=Uint8Array.from([0,0,1,0,4,0,16,16,0,0,1,0,32,0]);
 await rejects(remoteImageBytes(source,async()=>new Response(ico,{headers:{'Content-Type':'image/png'}})),'FORMAT');
});
