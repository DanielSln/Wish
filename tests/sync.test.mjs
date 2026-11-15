import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { device,adapter,productInput,MemoryServer,ownerA,ownerB,backend } from './helpers/sync-fixtures.mjs';
import { createRepository } from '../src/data/repository.ts';
import { SyncError } from '../src/sync/types.ts';
import { CatalogProfiles } from '../src/data/profiles.ts';
import { DatabaseSync } from 'node:sqlite';

test('guest/offline CRUD remains local; first association archives and backs up only after confirmation',async()=>{
 const d=await device();try{
  const server=new MemoryServer();const engine=d.engine(server.remote(ownerA));const cat=(await d.repo.categories())[0];const id=await d.repo.save(productInput(cat.id));
  await engine.run();assert.equal(server.pushCalls+server.pullCalls,0);assert.equal((await d.local.summary()).pending,0);
  await d.local.activate(ownerA,backend);assert.ok((await d.local.summary()).pending>=4);assert.equal((await d.local.summary()).state.last_success,null);
  await engine.run();const summary=await d.local.summary();assert.equal(summary.pending,0);assert.ok(summary.state.last_success);assert.equal(server.account(ownerA).records.get('product:'+id).data.name,'Desejo de teste');assert.equal((await d.repo.list()).length,1);assert.ok((await d.local.archives()).length>=4);
 }finally{d.raw.close()}
});

test('mutation and outbox commit atomically, including rollback on queue failure',async()=>{
 const d=await device();try{
  await d.local.activate(ownerA,backend);const server=new MemoryServer();await d.engine(server.remote(ownerA)).run();const category=(await d.repo.categories())[0];
  const broken={...d.db,runAsync:async(sql,...args)=>{if(sql.startsWith('INSERT INTO sync_outbox'))throw new Error('queue disk full');return d.db.runAsync(sql,...args)}};
  const repo=createRepository(broken,randomUUID);
  await assert.rejects(repo.save(productInput(category.id)),/queue disk full/);assert.equal((await d.repo.list()).length,0);assert.equal((await d.local.summary()).pending,0);
  const id=await d.repo.save(productInput(category.id));const count=(await d.local.summary()).pending;
  await assert.rejects(repo.setStatus(id,'purchased'),/queue disk full/);assert.equal((await d.repo.get(id)).status,'pending');assert.equal((await d.local.summary()).pending,count);
 }finally{d.raw.close()}
});

test('network failure persists retry/backoff; reconnect retries without duplication or premature success',async()=>{
 const d=await device();try{
  const server=new MemoryServer();const id=await d.repo.save(productInput((await d.repo.categories())[0].id));await d.local.activate(ownerA,backend);let now=1700000000000;
  const engine=d.engine(server.remote(ownerA),ownerA,()=>true,()=>now);server.failBefore=1;await engine.run();
  let s=await d.local.summary();assert.ok(s.pending);assert.equal(s.state.last_success,null);assert.equal(s.state.retry_count,1);assert.equal(s.state.retry_at,now+2000);
  const calls=server.pullCalls;await engine.run();assert.equal(server.pullCalls,calls);
  now+=2001;server.loseAck=1;await engine.run();s=await d.local.summary();assert.ok(s.pending);assert.equal(s.state.last_success,null);
  now=s.state.retry_at+1;await engine.run();assert.equal((await d.local.summary()).pending,0);assert.equal([...server.account(ownerA).records.values()].filter(r=>r.kind==='product').length,1);assert.ok(await d.repo.get(id));
 }finally{d.raw.close()}
});

test('recovery is paginated and restart-safe with a persisted cursor',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wish-sync-'));const source=await device();let target=await device(join(dir,'catalog.db'));
 try{
  const server=new MemoryServer();await source.local.activate(ownerA,backend);for(let i=0;i<6;i++)await source.repo.save({...productInput((await source.repo.categories())[0].id),name:'Item '+i});await source.engine(server.remote(ownerA)).run();
  server.pageSize=2;await target.local.activate(ownerA,backend);const remote=server.remote(ownerA);let reads=0;const fail={...remote,pull:async(...args)=>{if(++reads===2)throw new SyncError('offline','network');return remote.pull(...args)}};
  await target.engine(fail).run();const partial=await target.local.summary();assert.equal(partial.state.cursor,2);assert.ok(partial.state.upper_cursor>2);target.raw.close();target=await device(join(dir,'catalog.db'));
  await target.engine(server.remote(ownerA)).run(true);assert.equal((await target.repo.list()).length,6);assert.equal((await target.local.summary()).pending,0);assert.equal((await target.local.summary()).state.upper_cursor,null);assert.ok((await target.local.summary()).state.last_success);
 }finally{source.raw.close();target.raw.close();rmSync(dir,{recursive:true,force:true})}
});

test('two devices preserve conflicting edits until explicit resolution and keep local archives',async()=>{
 const a=await device(),b=await device();try{
  const server=new MemoryServer();const id=await a.repo.save(productInput((await a.repo.categories())[0].id));await a.local.activate(ownerA,backend);await a.engine(server.remote(ownerA)).run();await b.local.activate(ownerA,backend);await b.engine(server.remote(ownerA)).run();
  await a.repo.save({...await a.repo.get(id),notes:'versão A'},id);await a.engine(server.remote(ownerA)).run();await b.repo.save({...await b.repo.get(id),notes:'versão B'},id);await b.engine(server.remote(ownerA)).run();
  assert.equal((await b.repo.get(id)).notes,'versão B');const conflicts=await b.local.conflicts();assert.equal(conflicts.length,1);assert.ok((await b.local.summary()).pending);
  await b.local.resolve(conflicts[0].id,'local');await b.engine(server.remote(ownerA)).run();assert.equal(server.account(ownerA).records.get('product:'+id).data.notes,'versão B');await a.engine(server.remote(ownerA)).run();assert.equal((await a.repo.get(id)).notes,'versão B');assert.ok((await a.local.archives()).some(r=>JSON.parse(r.payload).notes==='versão A'));
 }finally{a.raw.close();b.raw.close()}
});

test('edits made during an in-flight acknowledgement survive; concurrent runs share one worker',async()=>{
 const d=await device();try{
  const server=new MemoryServer();await d.local.activate(ownerA,backend);const engine=d.engine(server.remote(ownerA));await engine.run();const id=await d.repo.save(productInput((await d.repo.categories())[0].id));
  let entered,release;const started=new Promise(r=>entered=r);const gate=new Promise(r=>release=r);server.gate=async op=>{if(op.kind==='product'){server.gate=null;entered();await gate}};
  const first=engine.run();assert.equal(first,engine.run());await started;await d.repo.save({...await d.repo.get(id),notes:'editado em voo'},id);release();await first;
  assert.equal((await d.repo.get(id)).notes,'editado em voo');assert.equal(server.account(ownerA).records.get('product:'+id).data.notes,'editado em voo');assert.equal((await d.local.summary()).pending,0);
 }finally{d.raw.close()}
});

test('tombstones synchronize; accepting remote conflict preserves the replaced local snapshot',async()=>{
 const a=await device(),b=await device();try{
  const server=new MemoryServer();const id=await a.repo.save(productInput((await a.repo.categories())[0].id));await a.local.activate(ownerA,backend);await a.engine(server.remote(ownerA)).run();await b.local.activate(ownerA,backend);await b.engine(server.remote(ownerA)).run();
  await a.repo.remove(id);await a.engine(server.remote(ownerA)).run();await b.repo.save({...await b.repo.get(id),notes:'edição offline preservada'},id);await b.engine(server.remote(ownerA)).run();
  const [conflict]=await b.local.conflicts();assert.ok(conflict);assert.ok(await b.repo.get(id));await b.local.resolve(conflict.id,'remote');await b.engine(server.remote(ownerA)).run();assert.equal(await b.repo.get(id),null);assert.ok((await b.local.archives()).some(r=>JSON.parse(r.payload).notes==='edição offline preservada'));
 }finally{a.raw.close();b.raw.close()}
});

test('same-name categories reconcile explicitly without losing products or creating duplicate identities',async()=>{
 const a=await device(),b=await device();try{
  const server=new MemoryServer();const canonical=await a.repo.addCategory('Livros');await a.local.activate(ownerA,backend);await a.engine(server.remote(ownerA)).run();
  const duplicate=await b.repo.addCategory('Livros');const id=await b.repo.save(productInput(duplicate));await b.local.activate(ownerA,backend);await b.engine(server.remote(ownerA)).run();
  const conflict=(await b.local.conflicts()).find(c=>c.type==='category_name');assert.ok(conflict);assert.equal((await b.repo.get(id)).category_id,duplicate);
  await b.local.resolve(conflict.id,'merge_category');await b.engine(server.remote(ownerA)).run();assert.equal((await b.repo.get(id)).category_id,canonical);assert.equal((await b.repo.categories()).filter(c=>c.name==='Livros').length,1);assert.equal((await b.local.summary()).pending,0);assert.equal(b.raw.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{a.raw.close();b.raw.close()}
});

test('scope guard prevents uploads to another account and logout stops in-flight application',async()=>{
 const d=await device();try{
  await d.local.activate(ownerA,backend);const server=new MemoryServer();await d.engine(server.remote(ownerB),ownerB).run();assert.equal(server.pushCalls,0);assert.equal(server.pullCalls,0);
  await assert.rejects(d.local.activate(ownerB,backend),/outra conta/);
  let active=true,release,entered;const wait=new Promise(r=>release=r),started=new Promise(r=>entered=r);const remote=server.remote(ownerA);const blocked={...remote,pull:async(...args)=>{entered();await wait;return remote.pull(...args)}};
  const engine=d.engine(blocked,ownerA,()=>active);const run=engine.run(true);await started;active=false;engine.stop();release();await run;assert.equal((await d.local.summary()).state.cursor,0);assert.equal((await d.local.summary()).state.last_success,null);
 }finally{d.raw.close()}
});

test('catalog registry isolates logout/account changes and recovers an interrupted first binding',async()=>{
 const raw=new DatabaseSync(':memory:');const metadata=new Map([['wish.db',{owner_id:null,backend:null}]]);const registry=new CatalogProfiles(adapter(raw),async file=>metadata.get(file)??{owner_id:null,backend:null},randomUUID);
 try{
  await registry.init();assert.equal(await registry.select(null),'wish.db');metadata.set('wish.db',{owner_id:ownerA,backend});
  const guest=await registry.select(null);assert.notEqual(guest,'wish.db');assert.equal(await registry.select({userId:ownerA,backend}),'wish.db');assert.equal(await registry.select({userId:ownerB,backend}),guest);
  metadata.set(guest,{owner_id:ownerB,backend});await registry.register({userId:ownerB,backend},guest);assert.equal(await registry.select({userId:ownerB,backend}),guest);assert.notEqual(await registry.select(null),guest);assert.equal(await registry.select({userId:ownerA,backend}),'wish.db');
 }finally{raw.close()}
});

test('invalid remote data never advances the cursor or marks a backup complete',async()=>{
 const d=await device();try{
  await d.local.activate(ownerA,backend);const remote={pull:async()=>({items:[{kind:'product',id:randomUUID(),version:1,seq:1,data:{name:'inválido'}}],cursor:1,upper:1,more:false}),push:async()=>{throw new Error('must not upload')}};
  await d.engine(remote).run();const s=await d.local.summary();assert.equal(s.state.cursor,0);assert.equal(s.state.last_success,null);assert.equal(JSON.parse(s.state.last_error).code,'invalid');
 }finally{d.raw.close()}
});

test('invalid/permission errors pause automatic retries until explicit manual action',async()=>{
 const d=await device();try{await d.local.activate(ownerA,backend);let calls=0;const remote={pull:async()=>{calls++;throw new SyncError('migration missing','permission')},push:async()=>{throw Error('must not push')}};const engine=d.engine(remote);await engine.run();assert.equal(calls,1);await engine.run();assert.equal(calls,1);await engine.run(true);assert.equal(calls,2);assert.equal((await d.local.summary()).state.last_success,null);}finally{d.raw.close()}
});

test('an inconsistent acknowledgement cannot discard the queued local content',async()=>{
 const d=await device();try{await d.local.activate(ownerA,backend);const server=new MemoryServer();const base=server.remote(ownerA);const remote={...base,push:async(op,signal)=>{const r=await base.push(op,signal);r.record.data.name='Incorrect server content';return r}};await d.engine(remote).run();assert.ok((await d.local.summary()).pending>0);assert.equal((await d.local.summary()).state.last_success,null);assert.equal((await d.repo.categories())[0].name,'Casa');}finally{d.raw.close()}
});
