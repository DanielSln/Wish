import { createHash } from 'node:crypto';
import { plainData, record, commercialLink, identifier, attribute } from '../product-confidence/normalize.ts';
import type { Evidence, Field, Product, Scheme } from '../product-confidence/contracts.ts';
import { GatewayError, type InputProduct, type Operation, type SearchRequest } from './contracts.ts';
const fields = ['name', 'brand', 'model', 'category', 'color', 'variant', 'generation', 'capacity', 'size', 'quantity', 'condition', 'role', 'connectivity', 'originalUrl'];
export function cleanText(v: string) { return v.normalize('NFKC').trim().replace(/\s+/gu, ' '); }
export function redact(text: string, secrets: readonly string[] = []): string {
    let result = text;
    for (const secret of secrets)
        if (secret)
            result = result.split(secret).join('[REDACTED]');
    return result.replace(/(?:Bearer\s+)[A-Za-z0-9._-]+/giu, '[REDACTED]').replace(/([?&](?:api[_-]?key|access[_-]?token|token|secret|authorization|password|signature|auth|session|x-amz-(?:credential|signature|security-token)|x-goog-(?:credential|signature))=)[^&\s"<>]*/giu, '$1[REDACTED]');
}
export function safeUrl(v: unknown): string | undefined {
    if (typeof v !== 'string' || v.length > 4096 || commercialLink(v).kind === 'invalid')
        return undefined;
    try {
        const url = new URL(v);
        for (const key of url.searchParams.keys())
            if (/^(?:api[_-]?key|access[_-]?token|token|secret|authorization|password|signature|auth|session|x-amz-(?:credential|signature|security-token)|x-goog-(?:credential|signature))$/iu.test(key))
                return undefined;
        return url.href;
    }
    catch {
        return undefined;
    }
}
export function ev<T>(value: T, now: number, kind: 'manual' | 'search_index' = 'manual', url?: string): Evidence<T> { return { value, explicit: true, provenance: { kind, sourceId: kind === 'manual' ? 'authenticated-owner-input' : 'simulated-index-fixture', observedAt: new Date(now).toISOString(), ...(url ? { url } : {}) } }; }
export function reference(p: InputProduct, now: number): Product {
    const result: Product = { fields: {}, identifiers: [] };
    for (const field of fields) {
        const value = p[field as keyof InputProduct];
        if (typeof value === 'string' || typeof value === 'number')
            result.fields[field as Field] = ev(value, now);
    }
    for (const id of p.identifiers ?? [])
        result.identifiers.push({ scheme: id.scheme as Scheme, ...(id.namespace ? { namespace: id.namespace } : {}), evidence: ev(id.value, now) });
    return result;
}
export function validate(input: unknown, operation: Operation): SearchRequest {
    let x: unknown;
    try {
        x = plainData(input);
    }
    catch {
        throw new GatewayError('INVALID_REQUEST');
    }
    if (!record(x) || Object.keys(x).some(k => !['version', 'requestId', 'product', 'confirmedByOwner'].includes(k)) || x.version !== 1 || typeof x.requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/u.test(x.requestId) || !record(x.product) || Object.keys(x.product).some(k => !fields.includes(k) && k !== 'identifiers'))
        throw new GatewayError('INVALID_REQUEST');
    const p = x.product;
    for (const [k, v] of Object.entries(p)) {
        if (k === 'identifiers')
            continue;
        if (k === 'quantity') {
            if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 1 || v > 10000)
                throw new GatewayError('INVALID_REQUEST');
        }
        else if (typeof v !== 'string' || !v.trim() || v.length > (k === 'originalUrl' ? 4096 : 512) || /[\u0000-\u001f]/u.test(v))
            throw new GatewayError('INVALID_REQUEST');
    }
    if (p.originalUrl && !safeUrl(p.originalUrl))
        throw new GatewayError('INVALID_REQUEST');
    if (p.identifiers !== undefined && (!Array.isArray(p.identifiers) || p.identifiers.length > 12 || !p.identifiers.every(i => record(i) && Object.keys(i).every(k => ['scheme', 'namespace', 'value'].includes(k)) && typeof i.scheme === 'string' && ['gtin', 'mpn', 'sku', 'asin', 'catalog', 'listing'].includes(i.scheme) && typeof i.value === 'string' && i.value.length > 0 && i.value.length <= 100 && (i.scheme === 'gtin' || (typeof i.namespace === 'string' && i.namespace.length > 0 && i.namespace.length <= 100)))))
        throw new GatewayError('INVALID_REQUEST');
    if (x.confirmedByOwner !== undefined && typeof x.confirmedByOwner !== 'boolean')
        throw new GatewayError('INVALID_REQUEST');
    const product = p as unknown as InputProduct;
    const r = reference(product, 0);
    if (r.identifiers.some(i => !identifier(i)))
        throw new GatewayError('INVALID_REQUEST');
    if (operation === 'compare' && (x.confirmedByOwner !== true || !r.identifiers.some(i => ['gtin', 'mpn', 'asin'].includes(i.scheme) && identifier(i))))
        throw new GatewayError('INVALID_REQUEST');
    if (!product.name && !product.originalUrl && !product.identifiers?.length)
        throw new GatewayError('INVALID_REQUEST');
    return { version: 1, requestId: x.requestId, operation, product, confirmedByOwner: x.confirmedByOwner as boolean | undefined };
}
export function fingerprint(request: SearchRequest, owner: string): string {
    const p = request.product;
    const canonical = Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'identifiers').sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, typeof v === 'string' && k !== 'originalUrl' ? attribute(k as Field, v) : v]));
    const ids = (p.identifiers ?? []).map(i => [i.scheme, i.namespace?.toLowerCase() ?? '', cleanText(i.value).toLowerCase()]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return createHash('sha256').update(JSON.stringify({ schema: 1, adapter: 1, owner, operation: request.operation, locale: 'pt-BR', region: 'BR', confirmed: request.confirmedByOwner === true, product: canonical, ids })).digest('hex');
}
export function queryFor(p: InputProduct): string { const preferred = (p.identifiers ?? []).find(i => ['gtin', 'mpn', 'asin'].includes(i.scheme)); return [p.brand, preferred?.value ?? p.model ?? p.name ?? p.originalUrl].filter(Boolean).join(' ').slice(0, 1024); }
