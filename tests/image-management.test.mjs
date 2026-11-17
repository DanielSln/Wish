import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createImageManager,remoteImageUrl,imageExtension,isLocalImage,MAX_IMAGE_BYTES} from '../src/domain/image-management.ts';
import {createRepository} from '../src/data/repository.ts';
import {migrate} from '../src/data/migrations.ts';
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1sAAAAASUVORK5CYII=','base64'));
const dbAdapter=raw=>({execAsync:async sql=>raw.exec(sql),runAsync:async(sql,...args)=>raw.prepare(sql).run(...args),getFirstAsync:async(sql,...args)=>raw.prepare(sql).get(...args)??null,getAllAsync:async(sql,...args)=>raw.prepare(sql).all(...args),withTransactionAsync:async task=>{raw.exec('BEGIN');try{await task();raw.exec('COMMIT')}catch(e){raw.exec('ROLLBACK');throw e}}});
function files(root){const folder=join(root,'private');mkdirSync(folder,{recursive:true});let releases=0;return {get releases(){return releases},folder,async readPicked(uri){return new Uint8Array(readFileSync(uri))},async temporary(){return {uri:'file://preview',release:()=>{releases++}}},async persist(bytes,extension){const hash=createHash('sha256').update(bytes).digest('hex'),file=join(folder,hash+'.'+extension);if(!existsSync(file))writeFileSync(file,bytes);return `wish-image://${hash}.${extension}`},async resolve(ref){const name=ref.replace('wish-image://','');const path=join(folder,name);return existsSync(path)?path:null}}}
const forbiddenRequest=async()=>{throw new Error('network must not be used')};
test('gallery selection, cancellation, deduplication and persistence after SQLite/file-storage reopen',async()=>{
 const root=mkdtempSync(join(tmpdir(),'wish-photo-'));let raw=new DatabaseSync(join(root,'wish.db'));
 try{
  const storage=files(root);const manager=createImageManager(storage,forbiddenRequest);await migrate(dbAdapter(raw));let repo=createRepository(dbAdapter(raw),randomUUID);
  const category=(await repo.categories())[0].id;const original={name:'Desejo antigo',description:'Descrição',category_id:category,priority:'high',image_url:'https://img.youcom.com.br/old-small.webp',price_cents:11990,desired_price_cents:9990,store:'Youcom',original_url:'https://www.youcom.com.br/item?pp=1',notes:'Texto antigo',personal_notes:'Pessoal',offer_details:'Oferta',status:'purchased'};
  const id=await repo.save(original);const before=await repo.get(id);const picked=join(root,'picker-temporary.png');writeFileSync(picked,png);
  const cancelled=await manager.local(picked);cancelled.preview.release();assert.equal(storage.releases,1);assert.equal(readdirSync(storage.folder).length,0);assert.deepEqual(await repo.get(id),before);
  const draft=await manager.local(picked);const reference=await manager.persist(draft.bytes);assert.ok(isLocalImage(reference));await repo.saveImage(id,reference,original.image_url);draft.preview.release();
  const after=await repo.get(id);const comparable=p=>{const {image_url,updated_at,...fields}=p;return fields};assert.deepEqual(comparable(after),comparable(before));
  assert.equal(await manager.persist(png),reference);assert.equal(readdirSync(storage.folder).length,1);
  const second=await repo.save({...original,name:'Outro produto',image_url:reference});assert.equal((await repo.get(second)).image_url,reference);
  raw.close();raw=new DatabaseSync(join(root,'wish.db'));await migrate(dbAdapter(raw));repo=createRepository(dbAdapter(raw),randomUUID);
  const restarted=createImageManager(files(root),forbiddenRequest);assert.equal((await repo.get(id)).image_url,reference);assert.ok(await restarted.display(reference));assert.equal(raw.prepare('PRAGMA user_version').get().user_version,4);
  await repo.saveImage(id,'',reference);assert.equal((await repo.get(id)).image_url,'');assert.equal((await repo.get(second)).image_url,reference);assert.ok(await restarted.display(reference));
  await repo.saveImage(id,reference,'');await assert.rejects(repo.saveImage(id,'','stale-reference'),/alterado/);assert.equal((await repo.get(id)).image_url,reference);
  const source=await restarted.display(reference);rmSync(source.uri);assert.equal(await restarted.display(reference),null);assert.equal((await repo.get(id)).image_url,reference);
 }finally{raw.close();rmSync(root,{recursive:true,force:true})}
});
test('URLs reject local/dangerous sources; references cannot traverse private paths',()=>{
 for(const url of ['http://example.com/a.jpg','file:///private/a.png','content://picker/photo','javascript:alert(1)','data:image/png;base64,abc','https://127.0.0.1/a','https://0x7f000001/a','https://[::1]/a','https://localhost/a','https://metadata.google.internal/a','https://router.lan/a','https://user:password@example.com/a','https://example.com:444/a','https://example.com/a b','https://example.com/'+ 'x'.repeat(2050)])assert.throws(()=>remoteImageUrl(url));
 const url='https://img.youcom.com.br/photo.webp?width=1200&token=preserved';assert.equal(remoteImageUrl(url),url);assert.equal(isLocalImage('wish-image://../../database.db'),false);assert.equal(isLocalImage('file:///private/a.png'),false);
});
test('remote loader bounds bytes, requires actual raster image and refuses redirects without guessing URLs',async()=>{
 const url='https://img.youcom.com.br/photo.png?width=1';let calls=0;
 const request=async(address,options)=>{calls++;assert.equal(address,url);assert.equal(options.redirect,'manual');assert.equal(options.credentials,'omit');return new Response(png,{headers:{'Content-Type':'image/png'}})};
 const storage=files(mkdtempSync(join(tmpdir(),'wish-fetch-')));
 try{const manager=createImageManager(storage,request);assert.ok(await manager.remote(url));assert.equal(calls,1);await assert.rejects(manager.remote('http://example.com/a'));assert.equal(calls,1);
  for(const response of [new Response('<html>login</html>',{headers:{'Content-Type':'text/html'}}),new Response('<svg/>',{headers:{'Content-Type':'image/png'}}),new Response(png,{headers:{'Content-Type':'image/png','Content-Length':String(MAX_IMAGE_BYTES+1)}}),new Response(null,{status:302})])await assert.rejects(createImageManager(storage,async()=>response).remote(url));
  let cancelled=false;const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(MAX_IMAGE_BYTES+1))},cancel(){cancelled=true}});await assert.rejects(createImageManager(storage,async()=>new Response(stream,{headers:{'Content-Type':'image/png'}})).remote(url),/8 MB/);assert.ok(cancelled);
  const controller=new AbortController();const pending=createImageManager(storage,async()=>new Response(new ReadableStream({}),{headers:{'Content-Type':'image/png'}})).remote(url,controller.signal);await new Promise(resolve=>setTimeout(resolve,0));controller.abort();await assert.rejects(pending,/cancelada/);
 }finally{rmSync(join(storage.folder,'..'),{recursive:true,force:true})}
});
test('missing/corrupt picked files fail safely; oversized dimensions and bytes never reach persistence',async()=>{
 const root=mkdtempSync(join(tmpdir(),'wish-invalid-'));try{const manager=createImageManager(files(root),forbiddenRequest);await assert.rejects(manager.local(join(root,'missing.png')));const corrupt=join(root,'corrupt.png');writeFileSync(corrupt,'bad');await assert.rejects(manager.local(corrupt));assert.equal(readdirSync(join(root,'private')).length,0);
 const giant=new Uint8Array(png);new DataView(giant.buffer).setUint32(16,100000);assert.throws(()=>imageExtension(giant),/megapixels/);assert.throws(()=>imageExtension(new Uint8Array(MAX_IMAGE_BYTES+1)),/8 MB/);
 }finally{rmSync(root,{recursive:true,force:true})}
});

test('atomic file cleanup respects Expo move URI mutation and never deletes the persistent target',async()=>{
 const {writePhotoAtomically}=await import('../src/domain/image-management.ts');let deleted=0;
 const temporary={uri:'file:///private/uuid.tmp',exists:false,create(){this.exists=true},async write(){},async move(target){this.uri=target},delete(){deleted++;this.exists=false}};
 await writePhotoAtomically(temporary,'file:///private/hash.png',png);assert.equal(deleted,0);assert.equal(temporary.uri,'file:///private/hash.png');assert.equal(temporary.exists,true);
 const failed={...temporary,uri:'file:///private/other.tmp',async write(){throw new Error('disk full')}};
 await assert.rejects(writePhotoAtomically(failed,'file:///private/hash.png',png),/disk full/);assert.equal(deleted,1);assert.equal(temporary.exists,true);
});

test('legacy v4 references remain unchanged on ordinary edits; new insecure images are rejected',async()=>{
 const raw=new DatabaseSync(':memory:');try{const db=dbAdapter(raw);await migrate(db);const repo=createRepository(db,randomUUID);const category=(await repo.categories())[0].id;const id=await repo.save({name:'Legado',description:'',category_id:category,priority:'medium',image_url:'',price_cents:null,desired_price_cents:null,store:'',original_url:'',notes:'',status:'pending'});raw.prepare('UPDATE products SET image_url=? WHERE id=?').run('http://legacy.example/small.jpg',id);const old=await repo.get(id);await repo.save({...old,name:'Legado editado'},id);assert.equal((await repo.get(id)).image_url,old.image_url);await assert.rejects(repo.saveImage(id,'http://other.example/photo.jpg',old.image_url));assert.equal((await repo.get(id)).name,'Legado editado');}finally{raw.close()}
});

test('remote replacement persists exact URL after restart while cancelled preview and local photo remain intact',async()=>{
 const root=mkdtempSync(join(tmpdir(),'wish-remote-persist-'));let raw=new DatabaseSync(join(root,'wish.db'));
 try{const storage=files(root),manager=createImageManager(storage,async()=>new Response(png,{headers:{'Content-Type':'image/png'}}));await migrate(dbAdapter(raw));let repo=createRepository(dbAdapter(raw),randomUUID);const local=await manager.persist(png);const category=(await repo.categories())[0].id;const product={name:'Foto remota',description:'Descrição',category_id:category,priority:'medium',image_url:local,price_cents:11990,desired_price_cents:9990,store:'Loja',original_url:'https://example.com/product',notes:'Legado',personal_notes:'Nota',offer_details:'Oferta',status:'pending'};const id=await repo.save(product);const before=await repo.get(id);const url='https://img.youcom.com.br/direct.png?width=1000&token=preserved';
 const preview=await manager.remote(url);preview.release();assert.deepEqual(await repo.get(id),before);
 await repo.saveImage(id,url,local);raw.close();raw=new DatabaseSync(join(root,'wish.db'));await migrate(dbAdapter(raw));repo=createRepository(dbAdapter(raw),randomUUID);const after=await repo.get(id);assert.equal(after.image_url,url);const rest=p=>{const {image_url,updated_at,...other}=p;return other};assert.deepEqual(rest(after),rest(before));assert.ok(await manager.display(local));assert.equal(raw.prepare('PRAGMA user_version').get().user_version,4);
 }finally{raw.close();rmSync(root,{recursive:true,force:true})}
});
