import {isLocalImage,remoteImageUrl} from './image-management.ts';
export type Priority = 'low' | 'medium' | 'high';
export type PurchaseStatus = 'pending' | 'purchased';
export type Category = { id: string; name: string };
export type Product = {
  id: string; name: string; description: string; category_id: string; priority: Priority;
  image_url: string; price_cents: number | null; desired_price_cents: number | null;
  store: string; original_url: string; notes: string; personal_notes: string; offer_details: string; status: PurchaseStatus;
  created_at: string; updated_at: string; deleted_at: string | null;
  category_name?: string;
};
export type ProductInput = Omit<Product, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'category_name' | 'personal_notes' | 'offer_details'> & { personal_notes?: string; offer_details?: string };
export type Filters = { search?: string; category?: string; status?: string; sort?: 'newest' | 'oldest' | 'price-asc' | 'price-desc' | 'priority' };
export const priorityLabels = { low: 'Baixa', medium: 'Média', high: 'Alta' };
export const money = (cents: number | null) => cents === null ? 'Preço não informado' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export function parsePrice(value: string): number | null {
  if (!value.trim()) return null;
  const clean = value.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(clean)) throw new Error('Use um valor positivo, como 1299,90, sem separador de milhar.');
  const cents = Math.round(Number(clean.replace(',', '.')) * 100);
  if (!Number.isSafeInteger(cents) || cents > 99999999999) throw new Error('O preço informado é muito alto.');
  return cents;
}
export function isHttpUrl(value: string): boolean {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !!url.hostname; } catch { return false; }
}
export function validateProduct(input: ProductInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name.trim()) errors.name = 'Informe o nome do produto.';
  else if (input.name.length > 160) errors.name = 'Use até 160 caracteres.';
  if (!input.category_id) errors.category_id = 'Selecione uma categoria.';
  if (!Object.hasOwn(priorityLabels, input.priority)) errors.priority = 'Selecione uma prioridade válida.';
  if (!['pending', 'purchased'].includes(input.status)) errors.status = 'Status inválido.';
  for (const key of ['original_url'] as const) {
    if (input[key] && (!isHttpUrl(input[key]) || input[key].length > 2048)) errors[key] = 'Informe um endereço http:// ou https:// válido (até 2048 caracteres).';
  }
  if (input.image_url && !isLocalImage(input.image_url)) { try { remoteImageUrl(input.image_url); } catch (error) { errors.image_url = (error as Error).message; } }
  for (const key of ['price_cents', 'desired_price_cents'] as const) {
    const value = input[key];
    if (value !== null && (!Number.isSafeInteger(value) || value < 0 || value > 99999999999)) errors[key] = 'Preço inválido.';
  }
  for (const key of ['description', 'notes', 'store'] as const) {
    if (input[key].length > (key === 'store' ? 160 : 10000)) errors[key] = 'Texto muito longo.';
  }
  for (const key of ['personal_notes','offer_details'] as const) { if (input[key] !== undefined && (typeof input[key] !== 'string' || input[key].length > 10000)) errors[key] = 'Texto muito longo ou inválido.'; }
  return errors;
}
