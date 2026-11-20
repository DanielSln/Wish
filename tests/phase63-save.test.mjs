import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { createRepository } from '../src/data/repository.ts';
import { migrate } from '../src/data/migrations.ts';
import { createSaveGate, importDraft, validateImportDraft } from '../src/domain/import-draft.ts';
const categories=[{id:'tech',name:'Tecnologia'}];
const product={name:'Headset fixture',description:'Descrição integral',image_url:'',price_cents:8000,store:'Loja fixture',original_url:'https://www.amazon.com.br/fixture?variant=one',notes:'',offer_details:'À vista no PIX + cupom TESTE15'};

test('quick draft uses valid category, medium priority and preserves all imported fields',()=>{
  const draft=importDraft(product,categories);
  assert.equal(draft.category_id,'tech');assert.equal(draft.priority,'medium');assert.equal(draft.status,'pending');
  assert.equal(draft.original_url,product.original_url);assert.equal(draft.description,product.description);assert.equal(draft.offer_details,product.offer_details);
  assert.deepEqual(validateImportDraft(draft,categories),{});
  const edit={...draft,name:'Edited',price_cents:9000};assert.equal(draft.name,product.name);assert.equal(draft.price_cents,8000);assert.equal(edit.price_cents,9000);
});
test('missing name/category require only those fields; missing price/image are allowed',()=>{
  const draft=importDraft({...product,name:'',price_cents:null},categories);
  assert.deepEqual(Object.keys(validateImportDraft(draft,categories)).sort(),['category_id','name']);
  assert.deepEqual(validateImportDraft({...draft,name:'Manual',category_id:'tech'},categories),{});
  assert.ok(validateImportDraft(importDraft(product,categories),[]).category_id);
});
test('consecutive taps share a gate; successful save stays locked',async()=>{
  const gate=createSaveGate();let calls=0,release;const pending=new Promise(resolve=>{release=resolve});
  const first=gate.run(async()=>{calls++;await pending;return 'saved-id'});
  assert.equal(await gate.run(async()=>{calls++;return 'duplicate'}),undefined);
  release();assert.equal(await first,'saved-id');assert.equal(await gate.run(async()=>{calls++;return 'again'}),undefined);assert.equal(calls,1);
});
test('failed save unlocks for retry and preserves the draft',async()=>{
  const gate=createSaveGate();const draft=importDraft(product,categories);const before=structuredClone(draft);
  await assert.rejects(gate.run(async()=>{throw Error('fixture failure')}),/failure/);
  assert.equal(await gate.run(async()=> 'retried'), 'retried');assert.deepEqual(draft,before);
});
test('quick save uses repository, keeps SQLite v5 and survives a second repository instance',async()=>{
  const raw=new DatabaseSync(':memory:');
  const db={execAsync:async sql=>{raw.exec(sql)},runAsync:async(sql,...args)=>raw.prepare(sql).run(...args),getFirstAsync:async(sql,...args)=>raw.prepare(sql).get(...args)??null,getAllAsync:async(sql,...args)=>raw.prepare(sql).all(...args),withTransactionAsync:async action=>{raw.exec('BEGIN');try{await action();raw.exec('COMMIT')}catch(e){raw.exec('ROLLBACK');throw e}}};
  try{
    await migrate(db,async()=> 'fixture-backup.db');
    const repo=createRepository(db,randomUUID);const cats=await repo.categories();const draft=importDraft(product,cats);
    const id=await createSaveGate().run(()=>repo.save(draft));
    const reopened=await createRepository(db,randomUUID).get(id);
    assert.equal(raw.prepare('PRAGMA user_version').get().user_version,5);assert.equal(reopened.price_cents,8000);assert.equal(reopened.original_url,product.original_url);assert.equal(reopened.offer_details,product.offer_details);
    const missing=importDraft({...product,price_cents:null,image_url:''},cats);await repo.save(missing);
    assert.equal((await repo.list()).length,2);
  }finally{raw.close()}
});
