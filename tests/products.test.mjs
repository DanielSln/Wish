import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate as migrateWithBackup } from '../src/data/migrations.ts';
const migrate = db => migrateWithBackup(db, async () => 'fixture-backup.db');
import { createRepository } from '../src/data/repository.ts';
import { parsePrice, validateProduct } from '../src/domain/product.ts';
import { resolveAppearance, palettes } from '../src/theme/palette.ts';
function adapter(raw) {
  return {
    async execAsync(sql) { raw.exec(sql); },
    async runAsync(sql, ...args) { return raw.prepare(sql).run(...args); },
    async getFirstAsync(sql, ...args) { return raw.prepare(sql).get(...args) ?? null; },
    async getAllAsync(sql, ...args) { return raw.prepare(sql).all(...args); },
    async withTransactionAsync(task) { raw.exec('BEGIN'); try { await task(); raw.exec('COMMIT'); } catch (e) { raw.exec('ROLLBACK'); throw e; } },
  };
}
const input = category_id => ({ name: 'Notebook', description: 'Trabalho', category_id, priority: 'high', image_url: '', price_cents: 499990, desired_price_cents: 400000, store: 'Loja', original_url: 'https://example.com/product', notes: 'Esperar promoção', status: 'pending' });
test('SQLite: migrate, create, edit, categories, search, sorting, status, deletion and reopen', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wish-test-')); const path = join(dir, 'wish.db');
  let raw = new DatabaseSync(path);
  try {
    let db = adapter(raw); await migrate(db);
    let tick = 0; let repo = createRepository(db, randomUUID, () => new Date(1700000000000 + tick++ * 1000).toISOString());
    const cats = await repo.categories(); assert.equal(cats.length, 3);
    const a = await repo.save(input(cats[0].id)); assert.match(a, /^[0-9a-f-]{36}$/);
    const before = await repo.get(a);
    const custom = await repo.addCategory('Livros');
    await assert.rejects(repo.addCategory(' livros '), /já existe/);
    await assert.rejects(repo.addCategory('  '), /1 a 60/);
    const b = await repo.save({ ...input(custom), name: 'Livro 100%_legal', price_cents: 1000, priority: 'low' });
    await repo.save({ ...input(custom), name: 'Sem preço', price_cents: null, priority: 'medium' });
    assert.equal((await repo.list({ category: custom })).length, 2);
    assert.equal((await repo.list({ search: 'notebook' }))[0].id, a);
    assert.equal((await repo.list({ search: '%_' })).length, 1);
    assert.equal((await repo.list({ search: "' OR 1=1 --" })).length, 0);
    assert.equal((await repo.list({ sort: 'price-asc' }))[0].id, b);
    assert.equal((await repo.list({ sort: 'price-desc' }))[0].id, a);
    assert.equal((await repo.list({ sort: 'priority' }))[0].id, a);
    assert.equal((await repo.list({ sort: 'oldest' }))[0].id, a);
    assert.equal((await repo.list({ sort: 'newest' }))[2].id, a);
    for (const sort of ['constructor', '__proto__', 'toString', 'newest; DELETE FROM products']) {
      assert.deepEqual(await repo.list({ sort }), await repo.list({ sort: 'newest' }));
    }
    await repo.save({ ...input(custom), name: 'Notebook atualizado', notes: 'Nova anotação' }, a);
    const updated = await repo.get(a); assert.equal(updated.notes, 'Nova anotação'); assert.equal(updated.created_at, before.created_at); assert.notEqual(updated.updated_at, before.updated_at);
    await repo.setStatus(a, 'purchased'); assert.equal((await repo.list({ status: 'purchased', category: custom, search: 'Notebook' })).length, 1);
    await repo.setStatus(a, 'pending'); assert.equal((await repo.list({ status: 'purchased' })).length, 0);
    await repo.remove(b); assert.equal(await repo.get(b), null); assert.ok(raw.prepare('SELECT deleted_at FROM products WHERE id=?').get(b).deleted_at);
    await assert.rejects(repo.save({ ...input(custom), name: '' }), /nome/);
    await assert.rejects(repo.save(input('missing-category')));
    await migrate(db); assert.equal((await repo.list()).length, 2);
    raw.close(); raw = new DatabaseSync(path); db = adapter(raw); await migrate(db); repo = createRepository(db, randomUUID);
    assert.equal((await repo.list()).length, 2); assert.equal((await repo.get(a)).notes, 'Nova anotação'); assert.equal((await repo.categories()).length, 4);
    raw.exec('PRAGMA user_version = 6'); await assert.rejects(migrate(db), /mais recente/);
    assert.equal(raw.prepare('SELECT count(*) AS n FROM products').get().n, 3);
  } finally { raw.close(); rmSync(dir, { recursive: true, force: true }); }
});
test('migration rolls back schema and version if initialization fails', async () => {
  const raw = new DatabaseSync(':memory:'); const db = adapter(raw);
  const fail = { ...db, runAsync: async () => { throw new Error('disk full'); } };
  try { await assert.rejects(migrate(fail), /disk full/); assert.equal(raw.prepare('PRAGMA user_version').get().user_version, 0); assert.equal(raw.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='products'").get().n, 0); await migrate(db); } finally { raw.close(); }
});
test('validation: Brazilian currency, unsafe URLs and invalid values', () => {
  assert.equal(parsePrice('1299,90'), 129990); assert.equal(parsePrice('0'), 0); assert.equal(parsePrice(''), null);
  for (const value of ['-1', 'NaN', '1.299,90', '1,001', 'Infinity', '999999999999']) assert.throws(() => parsePrice(value));
  const errors = validateProduct({ ...input('x'), name: ' ', image_url: 'javascript:alert(1)', original_url: 'file:///secret', price_cents: -1 });
  assert.ok(errors.name); assert.ok(errors.image_url); assert.ok(errors.original_url); assert.ok(errors.price_cents);
  for (const priority of ['constructor', '__proto__', 'toString', 'urgent']) {
    assert.equal(validateProduct({ ...input('x'), priority }).priority, 'Selecione uma prioridade válida.');
  }
});

test('categories: rename keeps references, deletion protects pending/purchased and reuses tombstones', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = adapter(raw); await migrate(db); const repo = createRepository(db, randomUUID);
    const id = await repo.addCategory('Livros'); const productId = await repo.save(input(id));
    await repo.renameCategory(id, 'Leitura');
    assert.equal((await repo.get(productId)).category_name, 'Leitura');
    await assert.rejects(repo.removeCategory(id), /Mova/);
    await repo.setStatus(productId, 'purchased');
    await assert.rejects(repo.removeCategory(id), /incluindo os comprados/);
    await assert.rejects(repo.renameCategory(id, 'Casa'), /já está em uso/);
    await assert.rejects(repo.renameCategory(id, '  '), /1 a 60/);
    const other = await repo.addCategory('Outros');
    await repo.save({ ...(await repo.get(productId)), category_id: other }, productId);
    await repo.removeCategory(id);
    assert.equal((await repo.categories()).some(c => c.id === id), false);
    await assert.rejects(repo.save(input(id)), /categoria disponível/);
    assert.equal(await repo.addCategory('leitura'), id);
    assert.equal((await repo.categories()).find(c => c.id === id).name, 'leitura');
    await repo.remove(productId); await repo.removeCategory(other);
    assert.equal(raw.prepare('PRAGMA foreign_key_check').all().length, 0);
    assert.equal((await repo.list()).length, 0);
  } finally { raw.close(); }
});

test('purchased uses the same catalog, updates live and excludes deleted products', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = adapter(raw); await migrate(db); const repo = createRepository(db, randomUUID);
    assert.deepEqual(await repo.list({ status: 'purchased' }), []);
    const id = await repo.save(input((await repo.categories())[0].id));
    await repo.setStatus(id, 'purchased');
    assert.equal((await repo.list({ status: 'purchased' }))[0].id, id);
    assert.equal((await repo.list()).length, 1);
    await repo.setStatus(id, 'pending');
    assert.deepEqual(await repo.list({ status: 'purchased' }), []);
    await repo.setStatus(id, 'purchased'); await repo.remove(id);
    assert.deepEqual(await repo.list({ status: 'purchased' }), []);
  } finally { raw.close(); }
});

test('v1 to v2 migration preserves products/categories and rolls back settings failure', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = adapter(raw); await migrate(db); const repo = createRepository(db, randomUUID);
    const id = await repo.save(input((await repo.categories())[0].id));
    raw.exec('DROP TABLE product_offers; DROP TABLE app_settings; ALTER TABLE products DROP COLUMN personal_notes; ALTER TABLE products DROP COLUMN offer_details; PRAGMA user_version=1');
    const fail = { ...db, execAsync: async sql => { if (sql.includes('CREATE TABLE app_settings')) throw new Error('disk full'); return db.execAsync(sql); } };
    await assert.rejects(migrate(fail), /disk full/);
    assert.equal(raw.prepare('PRAGMA user_version').get().user_version, 1);
    assert.equal((await repo.get(id)).name, 'Notebook');
    await migrate(db); await migrate(db);
    assert.equal(raw.prepare('PRAGMA user_version').get().user_version, 5);
    assert.equal((await repo.categories()).length, 3);
    raw.prepare("INSERT INTO app_settings(key,value) VALUES ('appearance','dark')").run();
    await migrate(db);
    assert.equal(raw.prepare("SELECT value FROM app_settings WHERE key='appearance'").get().value, 'dark');
  } finally { raw.close(); }
});

test('appearance respects explicit choice and follows system without changing product data', () => {
  assert.equal(resolveAppearance('system', 'dark'), 'dark');
  assert.equal(resolveAppearance('system', null), 'light');
  assert.equal(resolveAppearance('light', 'dark'), 'light');
  assert.equal(resolveAppearance('dark', 'light'), 'dark');
  assert.equal(palettes.light.accent, '#A9D8F4');
  assert.equal(palettes.light.primary, '#287BB5');
});

test('v2 to v4 preserves every legacy note verbatim and adds separate empty personal/commercial fields',async()=>{
 const raw=new DatabaseSync(':memory:');try{const db=adapter(raw);await migrate(db);const repo=createRepository(db,randomUUID);const legacy='Informações da página na importação\nTexto que também pode ter sido escrito pelo usuário.';const id=await repo.save({...input((await repo.categories())[0].id),notes:legacy});
 raw.exec('DROP TABLE product_offers; ALTER TABLE products DROP COLUMN personal_notes; ALTER TABLE products DROP COLUMN offer_details; PRAGMA user_version=2');
 const failed={...db,execAsync:async sql=>{if(sql.includes('ADD COLUMN personal_notes'))return db.execAsync(sql.replace('ALTER TABLE products ADD COLUMN offer_details','INVALID SYNTAX'));return db.execAsync(sql)}};await assert.rejects(migrate(failed),/syntax/);assert.equal(raw.prepare('PRAGMA user_version').get().user_version,2);assert.ok(!raw.prepare('PRAGMA table_info(products)').all().some(c=>c.name==='personal_notes'));await migrate(db);
 const p=await repo.get(id);assert.equal(p.notes,legacy);assert.equal(p.personal_notes,'');assert.equal(p.offer_details,'');assert.equal(p.original_url,'https://example.com/product');
 await repo.savePersonalNotes(id,'Minha nota\nSegunda linha');assert.equal((await repo.get(id)).notes,legacy);assert.equal((await repo.get(id)).personal_notes,'Minha nota\nSegunda linha');
 await repo.save({...input((await repo.categories())[0].id),notes:legacy},id);assert.equal((await repo.get(id)).personal_notes,'Minha nota\nSegunda linha');
 raw.exec('PRAGMA user_version=3');await assert.rejects(migrate(db),/outra versão/);assert.equal(raw.prepare('SELECT notes FROM products WHERE id=?').get(id).notes,legacy);
 }finally{raw.close()}
});

test('manual Mercado Livre fallback saves and reopens with the exact selected link; v4 reopen keeps old image',async()=>{
 const raw=new DatabaseSync(':memory:');try{
  const db=adapter(raw);await migrate(db);const repo=createRepository(db,randomUUID);
  const {manualProductFromLink}=await import('../src/services/product-import.ts');
  const url='https://meli.la/fixture?ref=preservado';
  const category=(await repo.categories())[0].id;
  const oldImage='https://img.youcom.com.br/already-saved-thumbnail.webp';
  const id=await repo.save({...input(category),...manualProductFromLink(url),image_url:oldImage,personal_notes:'Minha nota',offer_details:'Oferta revisada'});
  const before=await repo.get(id);await migrate(db);const after=await repo.get(id);
  assert.equal(raw.prepare('PRAGMA user_version').get().user_version,5);
  assert.deepEqual(after,before);assert.equal(after.original_url,url);assert.equal(after.image_url,oldImage);
  assert.equal(after.personal_notes,'Minha nota');assert.equal(after.offer_details,'Oferta revisada');
 }finally{raw.close()}
});
