import { imageExtension, isLocalImage, MAX_IMAGE_BYTES, localImagePattern } from '../domain/image-management.ts';
import type { Product } from '../domain/product.ts';
import type { Offer } from '../domain/offers.ts';
export const LIMITS = { total: 128 * 1024 * 1024, header: 256 * 1024, catalog: 8 * 1024 * 1024, photos: 512, products: 10000, categories: 1000, offers: 20000, chunk: 256 * 1024 } as const;
export const categoryColumns = ['id', 'name', 'created_at', 'updated_at', 'deleted_at'] as const;
export const productColumns = ['id', 'name', 'description', 'category_id', 'priority', 'image_url', 'price_cents', 'desired_price_cents', 'store', 'original_url', 'notes', 'personal_notes', 'offer_details', 'status', 'created_at', 'updated_at', 'deleted_at'] as const;
export const offerColumns = ['id', 'product_id', 'store', 'price_cents', 'url', 'condition', 'conditional', 'recorded_at', 'created_at', 'updated_at', 'deleted_at'] as const;
export type BackupCategory = {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
};
export type Catalog = {
    categories: BackupCategory[];
    products: Omit<Product, 'category_name'>[];
    offers: Offer[];
    settings: {
        key: 'appearance';
        value: 'system' | 'light' | 'dark';
    }[];
};
export type Manifest = {
    format: 'wish-local-backup';
    version: 1;
    schemaVersion: 5;
    createdAt: string;
    catalog: {
        bytes: number;
        sha256: string;
    };
    photos: {
        reference: string;
        bytes: number;
        sha256: string;
    }[];
};
export type Hash = (bytes: Uint8Array) => Promise<string>;
export interface Reader {
    size: number;
    read(length: number): Promise<Uint8Array>;
    close(): void | Promise<void>;
}
export interface Writer {
    write(bytes: Uint8Array): Promise<void>;
    close(): void | Promise<void>;
}
export type Operation = {
    signal?: AbortSignal;
    progress?: (message: string) => void;
};
const magic = new TextEncoder().encode('WISHBK01');
function fail(message = 'Backup inválido, incompleto ou incompatível.'): never { throw new Error(message); }
const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : fail();
function keys(v: Record<string, unknown>, allowed: readonly string[]) { if (Object.keys(v).length !== allowed.length || allowed.some(k => !Object.hasOwn(v, k)))
    fail(); }
const string = (v: unknown, max: number, min = 0): v is string => typeof v === 'string' && v.length >= min && v.length <= max;
const uuid = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === (v.includes('.') ? v : v.replace('Z', '.000Z'));
const cents = (v: unknown, nullable = true, positive = false) => nullable && v === null || typeof v === 'number' && Number.isSafeInteger(v) && v >= (positive ? 1 : 0) && v <= 99999999999;
function address(v: unknown, max: number) { if (!string(v, max))
    return false; if (!v)
    return true; try {
    const u = new URL(v);
    return ['http:', 'https:'].includes(u.protocol) && !!u.hostname && !u.username && !u.password;
}
catch {
    return false;
} }
export function checkCancelled(op: Operation) { if (op.signal?.aborted)
    throw new Error('Operação cancelada. Seus dados foram preservados.'); }
export const yieldWork = () => new Promise<void>(resolve => setTimeout(resolve, 0));
function rows(value: unknown, max: number) { if (!Array.isArray(value) || value.length > max)
    fail('Quantidade de registros acima do limite ou estrutura inválida.'); return value.map(object); }
function base(row: Record<string, unknown>, columns: readonly string[], ids: Set<string>) { keys(row, columns); if (!uuid(row.id) || ids.has(String(row.id)) || !date(row.created_at) || !date(row.updated_at) || (row.deleted_at !== null && !date(row.deleted_at)))
    fail('Identificador ou data inválida no backup.'); ids.add(String(row.id)); }
export async function validateCatalog(value: unknown, op: Operation = {}): Promise<Catalog> {
    const v = object(value);
    keys(v, ['categories', 'products', 'offers', 'settings']);
    const categories = rows(v.categories, LIMITS.categories), products = rows(v.products, LIMITS.products), offers = rows(v.offers, LIMITS.offers), settings = rows(v.settings, 1);
    const categoryIds = new Set<string>(), names = new Set<string>(), productIds = new Set<string>(), offerIds = new Set<string>();
    let n = 0;
    for (const c of categories) {
        base(c, categoryColumns, categoryIds);
        if (!string(c.name, 60, 1) || !c.name.trim())
            fail();
        const name = c.name.replace(/[A-Z]/g, x => x.toLowerCase());
        if (names.has(name))
            fail('Categorias duplicadas.');
        names.add(name);
    }
    for (const p of products) {
        checkCancelled(op);
        base(p, productColumns, productIds);
        if (typeof p.category_id !== 'string' || !categoryIds.has(p.category_id) || !string(p.name, 160, 1) || !p.name.trim() || typeof p.priority !== 'string' || !['low', 'medium', 'high'].includes(p.priority) || typeof p.status !== 'string' || !['pending', 'purchased'].includes(p.status) || !cents(p.price_cents) || !cents(p.desired_price_cents))
            fail('Produto ou referência inválida no backup.');
        for (const k of ['description', 'notes', 'personal_notes', 'offer_details'])
            if (!string(p[k], 10000))
                fail();
        if (!string(p.store, 160) || !address(p.original_url, 8192) || !string(p.image_url, 2048) || p.image_url && !isLocalImage(p.image_url) && !address(p.image_url, 2048))
            fail('Imagem ou endereço inválido no backup.');
        if (++n % 100 === 0)
            await yieldWork();
    }
    for (const o of offers) {
        checkCancelled(op);
        base(o, offerColumns, offerIds);
        if (typeof o.product_id !== 'string' || !productIds.has(o.product_id) || !string(o.store, 160, 1) || !o.store.trim() || !cents(o.price_cents, false, true) || !address(o.url, 2048) || !o.url || !string(o.condition, 1000) || ![0, 1].includes(o.conditional as number) || !date(o.recorded_at))
            fail('Oferta ou referência inválida no backup.');
        if (++n % 100 === 0)
            await yieldWork();
    }
    for (const s of settings) {
        keys(s, ['key', 'value']);
        if (s.key !== 'appearance' || typeof s.value !== 'string' || !['system', 'light', 'dark'].includes(s.value))
            fail('Preferência incompatível.');
    }
    checkCancelled(op);
    return v as unknown as Catalog;
}
export function canonicalCatalog(c: Catalog) { return JSON.stringify({ categories: [...c.categories].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(r => Object.fromEntries(categoryColumns.map(k => [k, r[k]]))), products: [...c.products].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(r => Object.fromEntries(productColumns.map(k => [k, r[k]]))), offers: [...c.offers].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(r => Object.fromEntries(offerColumns.map(k => [k, r[k]]))), settings: c.settings.map(s => ({ key: s.key, value: s.value })) }); }
export function photoReferences(c: Catalog) { return [...new Set(c.products.map(p => p.image_url).filter(isLocalImage))].sort(); }
export function summary(c: Catalog) { return { pending: c.products.filter(p => !p.deleted_at && p.status === 'pending').length, purchased: c.products.filter(p => !p.deleted_at && p.status === 'purchased').length, categories: c.categories.filter(c => !c.deleted_at).length, offers: c.offers.filter(o => !o.deleted_at).length, photos: photoReferences(c).length, deleted: c.products.filter(p => !!p.deleted_at).length, appearance: c.settings[0]?.value ?? 'system' }; }
export async function validatePhoto(reference: string, bytes: Uint8Array, hash: Hash) { const match = localImagePattern.exec(reference); if (!match || bytes.length > MAX_IMAGE_BYTES || imageExtension(bytes) !== match[2] || await hash(bytes) !== match[1])
    fail('Foto ausente, corrompida ou incompatível com a referência.'); }
function validateManifest(v: unknown): Manifest {
    const m = object(v);
    keys(m, ['format', 'version', 'schemaVersion', 'createdAt', 'catalog', 'photos']);
    if (m.format !== 'wish-local-backup' || m.version !== 1 || m.schemaVersion !== 5)
        fail('Versão de backup incompatível. Use um backup Wish formato 1 / SQLite v5.');
    if (!date(m.createdAt))
        fail();
    const c = object(m.catalog);
    keys(c, ['bytes', 'sha256']);
    const hash = (s: unknown) => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
    if (!Number.isSafeInteger(c.bytes) || Number(c.bytes) < 2 || Number(c.bytes) > LIMITS.catalog || !hash(c.sha256) || !Array.isArray(m.photos) || m.photos.length > LIMITS.photos)
        fail();
    const refs = new Set();
    for (const photo of m.photos) {
        const p = object(photo);
        keys(p, ['reference', 'bytes', 'sha256']);
        if (!isLocalImage(String(p.reference)) || refs.has(p.reference) || !Number.isSafeInteger(p.bytes) || Number(p.bytes) < 1 || Number(p.bytes) > MAX_IMAGE_BYTES || !hash(p.sha256) || localImagePattern.exec(String(p.reference))?.[1] !== p.sha256)
            fail('Lista de fotos inválida.');
        refs.add(p.reference);
    }
    return m as unknown as Manifest;
}
async function exact(reader: Reader, size: number, op: Operation) { const data = new Uint8Array(size); let offset = 0; while (offset < size) {
    checkCancelled(op);
    const next = await reader.read(Math.min(LIMITS.chunk, size - offset));
    if (!next.length || next.length > Math.min(LIMITS.chunk, size - offset))
        fail();
    data.set(next, offset);
    offset += next.length;
} return data; }
async function write(writer: Writer, bytes: Uint8Array, op: Operation) { for (let i = 0; i < bytes.length; i += LIMITS.chunk) {
    checkCancelled(op);
    await writer.write(bytes.subarray(i, i + LIMITS.chunk));
} }
export async function planBackup(catalog: Catalog, readPhoto: (ref: string) => Promise<Uint8Array>, hash: Hash, op: Operation = {}) {
    await validateCatalog(catalog, op);
    const bytes = new TextEncoder().encode(canonicalCatalog(catalog));
    if (bytes.length > LIMITS.catalog)
        fail('Catálogo maior que o limite de 8 MB.');
    const references = photoReferences(catalog);
    if (references.length > LIMITS.photos)
        fail('Use até 512 fotos locais por backup.');
    const photos: Manifest['photos'] = [];
    for (const reference of references) {
        checkCancelled(op);
        op.progress?.('Conferindo fotos…');
        const image = await readPhoto(reference);
        await validatePhoto(reference, image, hash);
        photos.push({ reference, bytes: image.length, sha256: await hash(image) });
        await yieldWork();
    }
    const manifest: Manifest = { format: 'wish-local-backup', version: 1, schemaVersion: 5, createdAt: new Date().toISOString(), catalog: { bytes: bytes.length, sha256: await hash(bytes) }, photos };
    const header = new TextEncoder().encode(JSON.stringify(manifest));
    const size = 12 + header.length + 32 + bytes.length + photos.reduce((n, p) => n + p.bytes, 0);
    if (header.length > LIMITS.header || size > LIMITS.total)
        fail('O backup ultrapassa o limite de 128 MB.');
    return { manifest, header, bytes, size };
}
export async function writeBackup(plan: Awaited<ReturnType<typeof planBackup>>, writer: Writer, readPhoto: (ref: string) => Promise<Uint8Array>, hash: Hash, op: Operation = {}) {
    const prefix = new Uint8Array(12);
    prefix.set(magic);
    new DataView(prefix.buffer).setUint32(8, plan.header.length, true);
    await write(writer, prefix, op);
    await write(writer, plan.header, op);
    await write(writer, Uint8Array.from((await hash(plan.header)).match(/../g)!.map(h => parseInt(h, 16))), op);
    await write(writer, plan.bytes, op);
    let i = 0;
    for (const p of plan.manifest.photos) {
        op.progress?.(`Salvando fotos (${++i}/${plan.manifest.photos.length})…`);
        const image = await readPhoto(p.reference);
        if (image.length !== p.bytes)
            fail('Uma foto mudou durante a exportação.');
        await validatePhoto(p.reference, image, hash);
        await write(writer, image, op);
        await yieldWork();
    }
    checkCancelled(op);
}
export async function readBackup(reader: Reader, hash: Hash, onPhoto: (ref: string, bytes: Uint8Array) => Promise<void> = async () => { }, op: Operation = {}) {
    if (!Number.isSafeInteger(reader.size) || reader.size < 46 || reader.size > LIMITS.total)
        fail('Arquivo vazio, sem tamanho verificável ou maior que 128 MB.');
    const prefix = await exact(reader, 12, op);
    if (!magic.every((v, i) => prefix[i] === v))
        fail('Este arquivo não é um backup Wish.');
    const size = new DataView(prefix.buffer).getUint32(8, true);
    if (size < 2 || size > LIMITS.header || size + 44 > reader.size)
        fail();
    const header = await exact(reader, size, op), checksum = await exact(reader, 32, op);
    if (await hash(header) !== Array.from(checksum, b => b.toString(16).padStart(2, '0')).join(''))
        fail('Manifesto corrompido.');
    let raw: unknown;
    try {
        raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(header));
    }
    catch {
        fail();
    }
    const manifest = validateManifest(raw);
    if (44 + size + manifest.catalog.bytes + manifest.photos.reduce((n, p) => n + p.bytes, 0) !== reader.size)
        fail('Backup incompleto ou com conteúdo adicional.');
    const data = await exact(reader, manifest.catalog.bytes, op);
    if (await hash(data) !== manifest.catalog.sha256)
        fail('Catálogo corrompido.');
    let value: unknown;
    try {
        value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data));
    }
    catch {
        fail();
    }
    const catalog = await validateCatalog(value, op);
    const refs = photoReferences(catalog);
    if (refs.length !== manifest.photos.length || refs.some(r => !manifest.photos.some(p => p.reference === r)))
        fail('Referências de fotos incompletas.');
    let i = 0;
    for (const p of manifest.photos) {
        op.progress?.(`Validando fotos (${++i}/${manifest.photos.length})…`);
        const image = await exact(reader, p.bytes, op);
        await validatePhoto(p.reference, image, hash);
        await onPhoto(p.reference, image);
        await yieldWork();
    }
    if ((await reader.read(1)).length)
        fail('Dados adicionais no backup.');
    checkCancelled(op);
    return { manifest, catalog };
}
