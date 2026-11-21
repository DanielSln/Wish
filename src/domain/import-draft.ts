import { suggestCategory } from './category-suggestion.ts';
import { validateProduct, type Category, type ProductInput } from './product.ts';
import type { ImportedProduct } from '../services/product-import.ts';

export function importDraft(product: ImportedProduct, categories: Category[]): ProductInput {
  return { name: product.name, description: product.description, image_url: product.image_url,
    price_cents: product.price_cents, store: product.store, original_url: product.original_url,
    notes: product.notes, offer_details: product.offer_details ?? '', personal_notes: '',
    category_id: suggestCategory(product.name, categories, product.category_hint, product.description) ?? '',
    priority: 'medium', desired_price_cents: null, status: 'pending' };
}

export function validateImportDraft(draft: ProductInput, categories: Category[]) {
  const errors = validateProduct(draft);
  if (!categories.some(category => category.id === draft.category_id)) errors.category_id = 'Selecione uma categoria disponível.';
  return errors;
}

// Shared by both import actions. A completed save stays locked until navigation/unmount.
// A failure unlocks for retry without mutating the caller's draft.
export function createSaveGate() {
  let locked = false;
  return { async run<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (locked) return undefined;
    locked = true;
    try { return await action(); } catch (error) { locked = false; throw error; }
  } };
}
