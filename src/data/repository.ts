import type { Database } from './migrations.ts';
import { isLocalImage, remoteImageUrl } from '../domain/image-management.ts';
import { validateProduct } from '../domain/product.ts';
import type { Category, Filters, Product, ProductInput, PurchaseStatus } from '../domain/product.ts';

const fields = ['name','description','category_id','priority','image_url','price_cents','desired_price_cents','store','original_url','notes','personal_notes','offer_details','status'] as const;
export function createRepository(db: Database, uuid: () => string, now = () => new Date().toISOString()) {
  return {
    categories: () => db.getAllAsync<Category>('SELECT id,name FROM categories WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE'),
    async addCategory(name: string) {
      const trimmed = name.trim();
      if (!trimmed || trimmed.length > 60) throw new Error('Informe uma categoria com 1 a 60 caracteres.');
      const existing = await db.getAllAsync<Category & { deleted_at: string | null }>('SELECT id,name,deleted_at FROM categories');
      const match = existing.find(c => c.name.toLocaleLowerCase('pt-BR') === trimmed.toLocaleLowerCase('pt-BR'));
      if (match && !match.deleted_at) throw new Error('Essa categoria já existe.');
      if (match) {
        await db.runAsync('UPDATE categories SET name=?,deleted_at=NULL,updated_at=? WHERE id=?', trimmed, now(), match.id);
        return match.id;
      }
      const id = uuid(); const date = now();
      await db.runAsync('INSERT INTO categories(id,name,created_at,updated_at) VALUES (?,?,?,?)', id, trimmed, date, date);
      return id;
    },
    async renameCategory(id: string, name: string) {
      const trimmed = name.trim();
      if (!trimmed || trimmed.length > 60) throw new Error('Informe uma categoria com 1 a 60 caracteres.');
      const categories = await db.getAllAsync<Category & { deleted_at: string | null }>('SELECT id,name,deleted_at FROM categories');
      if (!categories.some(c => c.id === id && !c.deleted_at)) throw new Error('Categoria não encontrada.');
      if (categories.some(c => c.id !== id && c.name.toLocaleLowerCase('pt-BR') === trimmed.toLocaleLowerCase('pt-BR'))) throw new Error('Esse nome de categoria já está em uso.');
      await db.runAsync('UPDATE categories SET name=?,updated_at=? WHERE id=? AND deleted_at IS NULL', trimmed, now(), id);
    },
    async removeCategory(id: string) {
      // One statement prevents deleting a category with live references; tombstones keep the FK.
      const date = now();
      await db.runAsync('UPDATE categories SET deleted_at=?,updated_at=? WHERE id=? AND deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM products WHERE category_id=? AND deleted_at IS NULL)', date, date, id, id);
      const category = await db.getFirstAsync<{ deleted_at: string | null }>('SELECT deleted_at FROM categories WHERE id=?', id);
      if (!category) throw new Error('Categoria não encontrada.');
      if (!category.deleted_at) throw new Error('Mova ou exclua os produtos desta categoria antes de excluí-la, incluindo os comprados.');
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
      const oldImage = id ? await db.getFirstAsync<{image_url:string}>('SELECT image_url FROM products WHERE id=? AND deleted_at IS NULL',id) : null;
      if (oldImage && oldImage.image_url === input.image_url) delete errors.image_url; // Preserve unchanged legacy references without creating new insecure ones.
      if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
      const category = await db.getFirstAsync<{ id: string }>('SELECT id FROM categories WHERE id=? AND deleted_at IS NULL', input.category_id);
      if (!category) throw new Error('Selecione uma categoria disponível.');
      const date = now();
      const previous = id ? await db.getFirstAsync<{id:string;personal_notes:string;offer_details:string}>('SELECT id,personal_notes,offer_details FROM products WHERE id=? AND deleted_at IS NULL',id) : null;
      const values = fields.map(key => key === 'name' ? input.name.trim() : key === 'personal_notes' || key === 'offer_details' ? input[key] ?? previous?.[key] ?? '' : input[key]);
      if (id) {
        if (!previous) throw new Error('Produto não encontrado.');
        const result = await db.runAsync(`UPDATE products SET ${fields.map(key => `${key}=?`).join(',')}, updated_at=? WHERE id=? AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM categories WHERE id=? AND deleted_at IS NULL)`, ...values, date, id, input.category_id) as { changes: number };
        if (!result.changes) throw new Error('O produto ou a categoria não está mais disponível.');
      } else {
        id = uuid();
        const result = await db.runAsync(`INSERT INTO products(id,${fields.join(',')},created_at,updated_at) SELECT ${Array(fields.length + 3).fill('?').join(',')} WHERE EXISTS (SELECT 1 FROM categories WHERE id=? AND deleted_at IS NULL)`, id, ...values, date, date, input.category_id) as { changes: number };
        if (!result.changes) throw new Error('Selecione uma categoria disponível.');
      }
      return id;
    },
    async saveImage(id: string, reference: string, expected: string) {
      if (reference && !isLocalImage(reference)) remoteImageUrl(reference);
      const result = await db.runAsync('UPDATE products SET image_url=?,updated_at=? WHERE id=? AND image_url=? AND deleted_at IS NULL',reference,now(),id,expected) as {changes:number};
      if (!result.changes) throw new Error('O produto foi alterado. Reabra a edição antes de trocar a imagem.');
    },
    async savePersonalNotes(id: string, value: string) {
      if (value.length > 10000) throw new Error('Use até 10.000 caracteres.');
      const result = await db.runAsync('UPDATE products SET personal_notes=?,updated_at=? WHERE id=? AND deleted_at IS NULL', value, now(), id) as { changes: number };
      if (!result.changes) throw new Error('Produto não encontrado.');
    },
    setStatus: (id: string, status: PurchaseStatus) => db.runAsync('UPDATE products SET status=?,updated_at=? WHERE id=? AND deleted_at IS NULL', status, now(), id),
    // Tombstones preserve deletions for a future sync adapter. No sync or user data leaves the device.
    remove: (id: string) => { const date = now(); return db.runAsync('UPDATE products SET deleted_at=?,updated_at=? WHERE id=? AND deleted_at IS NULL', date, date, id); },
  };
}
