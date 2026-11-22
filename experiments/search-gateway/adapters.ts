import { createHash } from 'node:crypto';
import { plainData, record, validDate, commercialLink } from '../product-confidence/normalize.ts';
import { parseMinorUnits } from '../product-confidence/prices.ts';
import type { Product, Offer, PriceFact, Field } from '../product-confidence/contracts.ts';
import { GatewayError, type NormalizedCandidate, type ProviderResult, type Engine } from './contracts.ts';
import { ev, redact, safeUrl } from './validation.ts';
type Row = Record<string, unknown>;
function optional(row: Row, key: string): string | undefined {
    const v = row[key];
    if (v === undefined)
        return undefined;
    if (typeof v !== 'string' || v.length > 4096)
        throw new GatewayError('INVALID_PROVIDER_DATA');
    return v;
}
function array(row: Row, key: string): unknown[] {
    const v = row[key];
    if (v === undefined)
        return [];
    if (!Array.isArray(v) || v.length > 30)
        throw new GatewayError('INVALID_PROVIDER_DATA');
    return v;
}
function entry(v: unknown): Row {
    if (!record(v))
        throw new GatewayError('INVALID_PROVIDER_DATA');
    return v;
}
function nonempty(v: string | undefined) { return v?.trim() || undefined; }
export function adapt(result: ProviderResult, secrets: readonly string[] = []): NormalizedCandidate[] {
    if (result.simulation !== true || !validDate(result.observedAt))
        throw new GatewayError('INVALID_PROVIDER_DATA');
    let data: unknown;
    try {
        data = plainData(result.payload);
    }
    catch {
        throw new GatewayError('INVALID_PROVIDER_DATA');
    }
    const root = entry(data), now = Date.parse(result.observedAt);
    const clean = (s: string) => redact(s, secrets);
    const indexed = <T>(value: T, url?: string) => {
        const evidence = ev(value, now, 'search_index', url);
        if (result.timePrecision)
            evidence.provenance.timePrecision = result.timePrecision;
        return evidence;
    };
    const product = (row: Row): Product => {
        const p: Product = { fields: {}, identifiers: [] };
        const title = nonempty(optional(row, 'title'));
        const link = safeUrl(optional(row, 'link') ?? optional(row, 'product_link'));
        if (!title && !link)
            throw new GatewayError('INVALID_PROVIDER_DATA');
        if (title)
            p.fields.name = indexed(clean(title));
        if (link) {
            p.fields.originalUrl = indexed(link, link);
            const url = new URL(link), host = url.hostname.replace(/^www\./u, '');
            if (commercialLink(link).kind === 'direct')
                p.fields.store = indexed(host, link);
            const add = (scheme: 'asin' | 'listing' | 'catalog' | 'sku', value: string, namespace: string) => p.identifiers.push({ scheme, namespace, evidence: indexed(value, link) });
            if (host === 'amazon.com.br') {
                const asin = url.pathname.match(/\/(?:dp|gp\/product)\/([a-zA-Z0-9]{10})(?:\/|$)/u)?.[1];
                if (asin)
                    add('asin', asin, 'amazon.com.br');
                const seller = url.searchParams.get('smid');
                if (seller)
                    p.fields.seller = indexed(seller, link);
            }
            if (['mercadolivre.com.br', 'produto.mercadolivre.com.br'].includes(host)) {
                const catalog = url.pathname.match(/\/(?:p|up)\/(MLBU?\d+)/u)?.[1];
                if (catalog)
                    add('catalog', catalog, 'mercadolivre.com.br');
                const listing = url.searchParams.get('pdp_filters')?.match(/(?:^|\|)item_id:(MLB\d+)(?:$|\|)/u)?.[1] ?? url.pathname.match(/\/(MLB-?\d+)(?:-|\/|$)/u)?.[1]?.replace('-', '');
                if (listing)
                    add('listing', listing, 'mercadolivre.com.br');
            }
            if (host === 'shopee.com.br') {
                const item = url.pathname.match(/-i\.(\d+)\.(\d+)(?:\/|$)/u);
                if (item) {
                    add('listing', `${item[1]}.${item[2]}`, host);
                    p.fields.seller = indexed(item[1], link);
                }
            }
            if (host === 'kabum.com.br') {
                const sku = url.pathname.match(/\/produto\/(\d+)(?:\/|$)/u)?.[1];
                if (sku)
                    add('sku', sku, host);
            }
            if (host === 'magazineluiza.com.br') {
                const catalog = url.pathname.match(/\/p\/([a-zA-Z0-9]+)(?:\/|$)/u)?.[1];
                if (catalog)
                    add('catalog', catalog, host);
                const seller = url.searchParams.get('seller_id');
                if (seller)
                    p.fields.seller = indexed(seller, link);
            }
        }
        const brand = nonempty(optional(row, 'brand'));
        if (brand)
            p.fields.brand = indexed(clean(brand));
        const description = optional(row, 'snippet') ?? optional(row, 'description');
        if (description)
            p.fields.description = indexed(clean(description));
        const extensions = array(row, 'extensions').map(v => {
            if (typeof v !== 'string')
                throw new GatewayError('INVALID_PROVIDER_DATA');
            return v;
        });
        const labeled = [title, description, ...extensions].filter(Boolean).join(' ');
        const labels: Record<string, Field> = { cor: 'color', color: 'color', tamanho: 'size', size: 'size', capacidade: 'capacity', capacity: 'capacity', geração: 'generation', generation: 'generation', condição: 'condition', condition: 'condition', conectividade: 'connectivity', connectivity: 'connectivity' };
        for (const extension of extensions) {
            const globalId = extension.match(/^(?:GTIN|EAN):\s*([\d -]{8,30})$/iu);
            if (globalId)
                p.identifiers.push({ scheme: 'gtin', evidence: indexed(globalId[1].trim(), link) });
            const sku = extension.match(/^SKU:\s*([a-zA-Z0-9_-]{1,100})$/iu);
            if (sku && link && commercialLink(link).kind === 'direct')
                p.identifiers.push({ scheme: 'sku', namespace: new URL(link).hostname.replace(/^www\./u, ''), evidence: indexed(sku[1], link) });
            const pair = extension.match(/^([^:]{1,25}):\s*(.{1,100})$/u);
            if (!pair)
                continue;
            const field = labels[pair[1].trim().toLowerCase()];
            if (field)
                p.fields[field] = indexed(clean(pair[2]));
            if (/^(?:quantidade|quantity)$/iu.test(pair[1].trim()) && /^[1-9]\d{0,3}$/u.test(pair[2].trim()))
                p.fields.quantity = indexed(Number(pair[2]));
        }
        const model = labeled.match(/\b(?:modelo|model|mpn)\s*:\s*([a-zA-Z0-9-]{2,40})\b/iu)?.[1];
        if (model) {
            p.fields.model = indexed(model);
            if (brand)
                p.identifiers.push({ scheme: 'mpn', namespace: clean(brand).toLowerCase(), evidence: indexed(model) });
        }
        const image = safeUrl(optional(row, 'thumbnail')) ?? array(row, 'thumbnails').map(v => safeUrl(v)).find(Boolean);
        if (image)
            p.fields.image = indexed(image);
        const seller = nonempty(optional(row, 'seller'));
        if (seller)
            p.fields.seller = indexed(clean(seller));
        const source = nonempty(optional(row, 'source') ?? optional(row, 'name'));
        if (source && !p.fields.store)
            p.fields.store = indexed(clean(source));
        const productId = optional(row, 'product_id');
        if (productId)
            p.identifiers.push({ scheme: 'catalog', namespace: 'google-shopping', evidence: indexed(clean(productId)) });
        return p;
    };
    const offer = (row: Row, p: Product, id: string): Offer => {
        const prices: PriceFact[] = [];
        const link = safeUrl(optional(row, 'link') ?? optional(row, 'product_link'));
        const installment = optional(row, 'installments_description');
        const number = row.monthly_payment_duration;
        if (number !== undefined && (typeof number !== 'number' || !Number.isSafeInteger(number) || number <= 0 || number > 360))
            throw new GatewayError('INVALID_PROVIDER_DATA');
        const conditionText = [installment, optional(row, 'payment_methods'), optional(row, 'coupon'), optional(row, 'discount')].filter((value): value is string => typeof value === "string" && !!value).map(clean).join('; ');
        for (const [field, role] of [['price', installment || number ? 'installment' : 'advertised'], ['total', 'reported_total'], ['original_price', 'previous'], ['old_price', 'previous'], ['shipping', 'shipping']] as const) {
            const raw = optional(row, field);
            if (!raw)
                continue;
            // R$ is explicit BRL in these fixtures. No inferred currency from gl=br.
            const literal = raw.trim().match(/^(R\$\s*(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{2})?)(?:\s+(?:agora|no PIX|via PIX|à vista|à vista no PIX))?$/iu)?.[1];
            const money = literal ? parseMinorUnits(literal, 'BRL', 'pt-BR') : null;
            const amount = money ? indexed(money, link) : undefined;
            const extractedField = ({ price: 'extracted_price', total: 'extracted_total', original_price: 'extracted_original_price', old_price: 'extracted_old_price', shipping: 'shipping_extracted' } as const)[field];
            const extracted = row[extractedField];
            if (extracted !== undefined) {
                if (typeof extracted !== 'number' || !Number.isFinite(extracted) || extracted < 0 || !/^\d+(?:\.\d{1,2})?$/u.test(String(extracted)))
                    throw new GatewayError('INVALID_PROVIDER_DATA');
                const numeric = money ? parseMinorUnits(String(extracted), 'BRL', 'en-US') : null;
                if (numeric && numeric.minorUnits !== money!.minorUnits)
                    prices.push({ role, basis: 'unknown', amount: indexed(numeric, link), rawText: indexed(`${extractedField}: ${extracted}`, link) });
            }
            const rawCondition = /\bPIX\b/iu.test(raw) ? 'PIX' : /à vista/iu.test(raw) ? 'À vista' : undefined;
            prices.push({ role: field === 'price' && role !== 'installment' && rawCondition === 'PIX' ? 'pix' : role, basis: 'unknown', rawText: indexed(clean(raw), link), ...(amount ? { amount } : {}), ...(conditionText || rawCondition ? { condition: indexed([conditionText, rawCondition].filter(Boolean).join('; '), link) } : {}), ...(field === 'price' && number ? { installmentCount: indexed(number as number, link) } : {}), ...(row.coupon ? { couponCode: indexed(clean(String(row.coupon)), link) } : {}) });
        }
        for (const field of ['extracted_price', 'extracted_total', 'extracted_original_price', 'extracted_old_price', 'shipping_extracted'])
            if (row[field] !== undefined && (typeof row[field] !== 'number' || !Number.isFinite(row[field]) || Number(row[field]) < 0))
                throw new GatewayError('INVALID_PROVIDER_DATA');
        // Keep additional charges explicitly unknown; do not infer zero from absence.
        const extra = optional(row, 'additional_costs');
        if (extra)
            prices.push({ role: 'additional_cost', basis: 'unknown', rawText: indexed(clean(extra), link) });
        const details = array(row, 'details_and_offers');
        if (details.some(v => typeof v !== 'string'))
            throw new GatewayError('INVALID_PROVIDER_DATA');
        const stock = details.filter(v => /^(?:Em estoque on-line|Esgotado on-line|In stock online|Out of stock online)$/iu.test(String(v)));
        const inStock = stock.some(v => /^(?:Em estoque|In stock)/iu.test(String(v))), outStock = stock.some(v => /^(?:Esgotado|Out of stock)/iu.test(String(v)));
        return { id, product: p, prices, ...(link ? { commercialUrl: indexed(link, link) } : {}), ...(inStock !== outStock ? { availability: indexed(outStock ? 'out_of_stock' : 'in_stock', link) } : {}) };
    };
    const rows = (engine: Engine): Row[] => {
        if (engine === 'google')
            return array(root, 'organic_results').map(entry);
        if (engine === 'google_shopping')
            return [...array(root, 'shopping_results'), ...array(root, 'inline_shopping_results'), ...array(root, 'categorized_shopping_results').flatMap(v => array(entry(v), 'shopping_results'))].map(entry);
        if (!record(root.product_results))
            throw new GatewayError('INVALID_PROVIDER_DATA');
        return [root.product_results];
    };
    const results = rows(result.engine);
    if (results.length > 30)
        throw new GatewayError('INVALID_PROVIDER_DATA');
    return results.map((row, i) => {
        const p = product(row);
        const id = `${result.engine}-${i}-${createHash('sha256').update(JSON.stringify(p)).digest('hex').slice(0, 12)}`;
        if (result.engine === 'google_immersive_product') {
            const about = row.about_the_product;
            if (about !== undefined) {
                const desc = optional(entry(about), 'description');
                if (desc)
                    p.fields.description = indexed(clean(desc));
            }
            return { id, product: p, offers: array(row, 'stores').map((v, n) => { const store = entry(v); return offer(store, product(store), `${id}-s${n}`); }) };
        }
        return { id, product: p, offers: result.engine === 'google_shopping' ? [offer(row, p, `${id}-offer`)] : [] };
    });
}
/** Cache never changes the observation time or upgrades index evidence. */
export function cachedCandidates(input: unknown): NormalizedCandidate[] {
    const data = plainData(input);
    if (!Array.isArray(data))
        throw new GatewayError('UNAVAILABLE');
    function mark(v: unknown): void {
        if (!v || typeof v !== 'object')
            return;
        if (record(v) && record(v.provenance)) {
            const p = v.provenance;
            if (p.kind !== 'cache') {
                p.cachedFrom = p.kind;
                p.kind = 'cache';
            }
        }
        for (const child of Object.values(v))
            mark(child);
    }
    mark(data);
    return data as NormalizedCandidate[];
}
