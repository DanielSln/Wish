import { validateProduct } from '../domain/product.ts';
import type { Product } from '../domain/product.ts';
export type Kind = 'category' | 'product';
export type CategoryData = { id: string; name: string; created_at: string; updated_at: string; deleted_at: string | null };
export type ProductData = Omit<Product, 'category_name'>;
export type RecordData = CategoryData | ProductData;
export type RemoteRecord = { kind: Kind; id: string; version: number; seq: number; data: RecordData; op_id?: string };
export type PushOperation = { op_id: string; kind: Kind; id: string; base_version: number; data: RecordData };
export type PushResult = { status: 'ok' | 'conflict' | 'category_name' | 'category_in_use'; record: RemoteRecord };
export type PullPage = { items: RemoteRecord[]; cursor: number; upper: number; more: boolean };
export interface Remote {
  push(operation: PushOperation, signal: AbortSignal): Promise<PushResult>;
  pull(cursor: number, upper: number | null, signal: AbortSignal): Promise<PullPage>;
}
export class SyncError extends Error {
  constructor(message: string, readonly code: 'network' | 'auth' | 'permission' | 'invalid' | 'cancelled', readonly retryAfterMs = 0) { super(message); }
}
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string { return typeof value === 'string' && uuidPattern.test(value); }
export function count(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
const timestamp = (value: unknown) => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)) && /(?:Z|[+-]\d\d:\d\d)$/.test(value);
export function validateRecord(kind: Kind, value: unknown): RecordData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SyncError('Registro remoto inválido.', 'invalid');
  const row = value as Record<string, unknown>;
  if (!isUuid(row.id) || !timestamp(row.created_at) || !timestamp(row.updated_at) || !(row.deleted_at === null || timestamp(row.deleted_at))) throw new SyncError('Identidade ou datas remotas inválidas.', 'invalid');
  if (kind === 'category') {
    if (typeof row.name !== 'string' || !row.name.trim() || row.name.length > 60) throw new SyncError('Categoria remota inválida.', 'invalid');
    return { id: row.id, name: row.name, created_at: new Date(row.created_at as string).toISOString(), updated_at: new Date(row.updated_at as string).toISOString(), deleted_at: row.deleted_at===null?null:new Date(row.deleted_at as string).toISOString() };
  }
  if (!isUuid(row.category_id)) throw new SyncError('Referência remota inválida.', 'invalid');
  for (const key of ['name','description','priority','image_url','store','original_url','notes','status']) if (typeof row[key] !== 'string') throw new SyncError('Campos remotos inválidos.', 'invalid');
  const input = row as unknown as ProductData;
  if (Object.keys(validateProduct(input)).length) throw new SyncError('O servidor devolveu dados fora dos limites do Wish.', 'invalid');
  const fields = ['id','name','description','category_id','priority','image_url','price_cents','desired_price_cents','store','original_url','notes','status','created_at','updated_at','deleted_at'] as const;
  return { ...Object.fromEntries(fields.map(key => [key, input[key]])), created_at:new Date(input.created_at).toISOString(),updated_at:new Date(input.updated_at).toISOString(),deleted_at:input.deleted_at===null?null:new Date(input.deleted_at).toISOString() } as ProductData;
}
export function remoteRecord(value: unknown): RemoteRecord {
  const r = value as Partial<RemoteRecord> | null;
  if (!r || !['category','product'].includes(r.kind ?? '') || !isUuid(r.id) || !count(r.version) || r.version < 1 || !count(r.seq) || r.seq < 1) throw new SyncError('Versão remota inválida.', 'invalid');
  const data = validateRecord(r.kind!, r.data);
  if (data.id !== r.id || (r.op_id !== undefined && !isUuid(r.op_id))) throw new SyncError('Envelope remoto inválido.', 'invalid');
  return { kind:r.kind!,id:r.id,version:r.version,seq:r.seq,data,...(r.op_id ? {op_id:r.op_id}: {}) };
}
export function sameContent(a: RecordData, b: RecordData): boolean {
  const ignore = new Set(['created_at','updated_at']);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(key => !ignore.has(key)).sort();
  return keys.every(key => (a as unknown as Record<string, unknown>)[key] === (b as unknown as Record<string, unknown>)[key]);
}
