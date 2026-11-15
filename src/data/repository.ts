import type { Database } from './migrations.ts';
import { validateProduct } from '../domain/product.ts';
import type { Category, Filters, Product, ProductInput, PurchaseStatus } from '../domain/product.ts';

const fields = ['name','description','category_id','priority','image_url','price_cents','desired_price_cents','store','original_url','notes','status'] as const;
export function createRepository(db: Database, uuid: () => string, now = () => new Date().toISOString()) {
  return {
    categories: () => db.getAllAsync<Category>('SELECT id,name FROM categories WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE'),
    async addCategory(name: string) {
      const trimmed = name.trim();
      if (!trimmed || trimmed.length > 60) throw new Error('Informe uma categoria com 1 a 60 caracteres.');
      const existing = await db.getAllAsync<Category>('SELECT id,name FROM categories WHERE deleted_at IS NULL');
      if (existing.some(c => c.name.toLocaleLowerCase('pt-BR') === trimmed.toLocaleLowerCase('pt-BR'))) throw new Error('Essa categoria já existe.');
      const id = uuid(); const date = now();
      await db.runAsync('INSERT INTO categories(id,name,created_at,updated_at) VALUES (?,?,?,?)', id, trimmed, date, date);
      return id;
    },
    list(filters: Filters = {}) {
      const where = ['p.deleted_at IS NULL']; const args: (string | number | null)[] = [];
      if (filters.search?.trim()) { where.push("p.name LIKE ? ESCAPE '\\'"); args.push('%' + filters.search.trim().replace(/[\\%_]/g, '\\$&') + '%'); }
      if (filters.category) { where.push('p.category_id = ?'); args.push(filters.category); }
      if (filters.status) { where.push('p.status = ?'); args.push(filters.status); }
      const order = { newest: 'p.created_at DESC', oldest: 'p.created_at ASC', 'price-asc': 'p.price_cents IS NULL, p.price_cents ASC', 'price-desc': 'p.price_cents IS NULL, p.price_cents DESC', priority: "CASE p.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END" };
      const sort = filters.sort ?? 'newest';
      const ordering = Object.hasOwn(order, sort) ? order[sort] : order.newest;
      return db.getAllAsync<Product>(`SELECT p.*,c.name AS category_name FROM products p JOIN categories c ON c.id=p.category_id WHERE ${where.join(' AND ')} ORDER BY ${ordering}, p.id`, ...args);
    },
    get: (id: string) => db.getFirstAsync<Product>('SELECT p.*,c.name AS category_name FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id=? AND p.deleted_at IS NULL', id),
    async save(input: ProductInput, id?: string) {
      const errors = validateProduct(input);
      if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
      const date = now();
      const values = fields.map(key => key === 'name' ? input.name.trim() : input[key]);
      if (id) {
        const exists = await db.getFirstAsync<{ id: string }>('SELECT id FROM products WHERE id=? AND deleted_at IS NULL', id);
        if (!exists) throw new Error('Produto não encontrado.');
        await db.runAsync(`UPDATE products SET ${fields.map(key => `${key}=?`).join(',')}, updated_at=? WHERE id=? AND deleted_at IS NULL`, ...values, date, id);
      } else {
        id = uuid();
        await db.runAsync(`INSERT INTO products(id,${fields.join(',')},created_at,updated_at) VALUES (${Array(fields.length + 3).fill('?').join(',')})`, id, ...values, date, date);
      }
      return id;
    },
    setStatus: (id: string, status: PurchaseStatus) => db.runAsync('UPDATE products SET status=?,updated_at=? WHERE id=? AND deleted_at IS NULL', status, now(), id),
    // Tombstones preserve deletions for a future sync adapter. No sync or user data leaves the device.
    remove: (id: string) => { const date = now(); return db.runAsync('UPDATE products SET deleted_at=?,updated_at=? WHERE id=? AND deleted_at IS NULL', date, date, id); },
  };
}
