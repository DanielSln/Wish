import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from '../src/data/migrations.ts';
import { createRepository } from '../src/data/repository.ts';
import { parsePrice, validateProduct } from '../src/domain/product.ts';
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
    raw.exec('PRAGMA user_version = 2'); await assert.rejects(migrate(db), /mais recente/);
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
