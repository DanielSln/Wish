import type { Evidence, Field, Identifier, Match, Origin, Policy, Product, Provenance } from './contracts.ts';
export const LIMITS = Object.freeze({ bytes: 128000, string: 4096, nodes: 6000, depth: 14, array: 100, candidates: 30 });
export const CURRENCIES: readonly string[] = Object.freeze(['BRL', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'CNY', 'JPY']);
const fields: Field[] = ['name', 'brand', 'model', 'color', 'variant', 'generation', 'capacity', 'size', 'quantity', 'store', 'seller', 'condition', 'originalUrl', 'role', 'connectivity', 'category', 'description', 'image'];
export const FIELDS: readonly Field[] = Object.freeze(fields);
const origins: Origin[] = ['store_page', 'search_index', 'manual', 'cache', 'insufficient'];
const utf8 = new TextEncoder();
export function text(value: string): string { return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US'); }
export function namespace(value: string): string { return text(value).replace(/^www\./, ''); }
export function attribute(field: Field, value: string | number): string {
    const normalized = text(String(value));
    const aliases: Partial<Record<Field, Record<string, string>>> = {
        color: { preto: 'black', negra: 'black', negro: 'black', vermelho: 'red', vermelha: 'red', branco: 'white', branca: 'white', azul: 'blue' },
        condition: { novo: 'new', nova: 'new', usado: 'used', usada: 'used', recondicionado: 'refurbished', recondicionada: 'refurbished' },
        connectivity: { 'com fio': 'wired', 'sem fio': 'wireless' },
        role: { principal: 'product', acessorio: 'accessory', 'acessório': 'accessory' },
    };
    if (field === 'capacity')
        return normalized.replace(/(\d)\s*(gb|tb|mb|gib|tib|mib)\b/gu, '$1 $2');
    return aliases[field]?.[normalized] ?? normalized;
}
/** Accept data, not executable objects. Inspect descriptors without invoking getters. */
export function plainData(input: unknown): unknown {
    let count = 0;
    let bytes = 0;
    function clone(value: unknown, depth: number): unknown {
        if (++count > LIMITS.nodes || depth > LIMITS.depth)
            throw new Error('INPUT_LIMIT');
        if (value === null || typeof value === 'boolean')
            return value;
        if (typeof value === 'string') {
            bytes += utf8.encode(value).byteLength;
            if (value.length > LIMITS.string || bytes > LIMITS.bytes)
                throw new Error('INPUT_LIMIT');
            return value;
        }
        if (typeof value === 'number' && Number.isFinite(value))
            return value;
        if (typeof value !== 'object')
            throw new Error('NON_DATA_INPUT');
        if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null && !Array.isArray(value))
            throw new Error('NON_PLAIN_INPUT');
        if (Array.isArray(value) && value.length > LIMITS.array)
            throw new Error('INPUT_LIMIT');
        const out: Record<string, unknown> | unknown[] = Array.isArray(value) ? [] : Object.create(null);
        const descriptors = Object.getOwnPropertyDescriptors(value);
        if (Object.keys(descriptors).length > 150)
            throw new Error('INPUT_LIMIT');
        for (const [key, descriptor] of Object.entries(descriptors)) {
            if (Array.isArray(value) && key === 'length')
                continue;
            if (['__proto__', 'constructor', 'prototype'].includes(key) || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable)
                throw new Error('NON_DATA_INPUT');
            bytes += utf8.encode(key).byteLength;
            if (key.length > 100 || bytes > LIMITS.bytes || (Array.isArray(value) && !/^(0|[1-9]\d*)$/u.test(key)))
                throw new Error('INPUT_LIMIT');
            Object.defineProperty(out, key, { value: clone(descriptor.value, depth + 1), enumerable: true, writable: true, configurable: true });
        }
        if (Array.isArray(value) && Object.keys(out).length !== value.length)
            throw new Error('SPARSE_ARRAY');
        return out;
    }
    return clone(input, 0);
}
export function record(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v); }
export function validDate(v: unknown): v is string { return typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/u.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v.slice(0, 10); }
export function provenance(v: unknown): v is Provenance { return record(v) && origins.includes(v.kind as Origin) && typeof v.sourceId === 'string' && !!v.sourceId.trim() && validDate(v.observedAt) && (v.url === undefined || typeof v.url === 'string') && (v.timePrecision === undefined || ['instant', 'day'].includes(v.timePrecision as string)) && (v.cachedFrom === undefined || origins.filter(x => x !== 'cache').includes(v.cachedFrom as Exclude<Origin, 'cache'>)); }
export function evidence(v: unknown): v is Evidence<unknown> { return record(v) && Object.hasOwn(v, 'value') && typeof v.explicit === 'boolean' && provenance(v.provenance); }
export function usable(v: Evidence<unknown> | undefined, policy: Policy, age: number): boolean {
    if (!v || !v.explicit || v.provenance.timePrecision === 'day' || !validDate(v.provenance.observedAt))
        return false;
    const delta = Date.parse(policy.now) - Date.parse(v.provenance.observedAt);
    return delta >= 0 && delta <= age && ['store_page', 'manual'].includes(v.provenance.kind) && (v.provenance.kind !== 'store_page' || (!!v.provenance.url && commercialLink(v.provenance.url).kind === 'direct'));
}
export function policyValid(p: unknown): p is Policy { return record(p) && validDate(p.now) && typeof p.currency === 'string' && CURRENCIES.includes(p.currency) && [p.maxPriceAgeMs, p.maxIdentityAgeMs].every(x => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 && x <= 31536000000) && typeof p.purpose === 'string' && ['original_listing', 'comparison'].includes(p.purpose); }
export function productValid(p: unknown): p is Product {
    if (!record(p) || !record(p.fields) || !Array.isArray(p.identifiers) || p.identifiers.length > 30)
        return false;
    if (!Object.entries(p.fields).every(([k, v]) => fields.includes(k as Field) && evidence(v) && (k === 'quantity' ? typeof v.value === 'number' && Number.isSafeInteger(v.value) && v.value > 0 && v.value <= 10000 : typeof v.value === 'string' && !!v.value.trim())))
        return false;
    return p.identifiers.every((i: unknown) => record(i) && typeof i.scheme === 'string' && ['gtin', 'mpn', 'sku', 'asin', 'catalog', 'listing'].includes(i.scheme) && evidence(i.evidence) && typeof i.evidence.value === 'string' && !!i.evidence.value.trim() && i.evidence.value.length <= 100 && (i.scheme === 'gtin' || (typeof i.namespace === 'string' && !!i.namespace.trim() && i.namespace.length <= 100)));
}
export function gtin(value: string): string | null {
    const digits = value.replace(/[ -]/gu, '');
    if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/u.test(digits) || /^0+$/u.test(digits))
        return null;
    const body = digits.slice(0, -1);
    let sum = 0;
    for (let i = body.length - 1, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3)
        sum += Number(body[i]) * weight;
    return (10 - sum % 10) % 10 === Number(digits.at(-1)) ? digits.padStart(14, '0') : null;
}
export function identifier(i: Identifier): {
    key: string;
    value: string;
} | null {
    const value = i.scheme === 'gtin' ? gtin(i.evidence.value) : text(i.evidence.value);
    if (!value || (i.scheme === 'asin' && !/^[a-z0-9]{10}$/u.test(value)))
        return null;
    return { key: `${i.scheme}:${i.scheme === 'gtin' ? 'global' : namespace(i.namespace!)}`, value };
}
export function commercialLink(raw: string): {
    kind: 'direct' | 'indirect' | 'invalid';
    host?: string;
} {
    try {
        const u = new URL(raw);
        const host = u.hostname.toLowerCase();
        if (u.protocol !== 'https:' || u.username || u.password || u.port || !host.includes('.') || /[:\[\]]/u.test(host) || /^\d+(?:\.\d+){3}$/u.test(host) || /(?:^|\.)(?:localhost|local|internal|test)$/u.test(host) || host.endsWith('.'))
            return { kind: 'invalid' };
        const h = host.replace(/^www\./, '');
        return { kind: /(?:^|\.)google\.[a-z]{2,3}(?:\.[a-z]{2})?$/u.test(h) || ['serpapi.com', 'a.co', 'amzn.to', 'meli.la', 'shope.ee', 's.shopee.com.br', 's.click.aliexpress.com', 'bit.ly', 't.co'].includes(h) ? 'indirect' : 'direct', host: h };
    }
    catch {
        return { kind: 'invalid' };
    }
}
export function emptyIdentity(): {
    product: Match;
    listing: Match;
    reasons: {
        code: string;
    }[];
    conflicts: [
    ];
    anchors: [
    ];
    requiresReview: boolean;
} { return { product: 'unconfirmed', listing: 'unconfirmed', reasons: [{ code: 'INVALID_INPUT' }], conflicts: [], anchors: [], requiresReview: true }; }
