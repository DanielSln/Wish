import type { Identity, Policy, Product, Reason, Field } from './contracts.ts';
import { attribute, identifier, namespace, text, usable } from './normalize.ts';
const essential: Field[] = ['brand', 'model', 'color', 'variant', 'generation', 'capacity', 'size', 'quantity', 'condition', 'role', 'connectivity', 'category'];
function attributes(p: Product): Partial<Record<Field, string>> {
    const out: Partial<Record<Field, string>> = {};
    for (const f of essential)
        if (p.fields[f])
            out[f] = attribute(f, p.fields[f]!.value);
    const name = text(String(p.fields.name?.value ?? ''));
    if (!out.connectivity) {
        if (/\b(?:sem fio|wireless)\b/u.test(name))
            out.connectivity = 'wireless';
        else if (/\b(?:com fio|wired)\b/u.test(name))
            out.connectivity = 'wired';
    }
    if (!out.role && /^(?:case|capa|estojo|almofada|ponteira|replacement|acess[oó]rio)\b/u.test(name))
        out.role = 'accessory';
    return out;
}
function nameGeneration(p: Product): {
    base: string;
    generation: string;
} | null {
    const name = text(String(p.fields.name?.value ?? ''));
    const tokens = name.split(' ');
    const roman = tokens.filter(t => /^(?:ii|iii|iv|vi|vii|viii|ix)$/u.test(t));
    return roman.length === 1 ? { base: tokens.filter(t => t !== roman[0]).join(' '), generation: roman[0] } : null;
}
function groups(p: Product) {
    const map = new Map<string, {
        values: Set<string>;
        trusted: boolean;
    }>();
    let invalid = false;
    for (const id of p.identifiers) {
        const n = identifier(id);
        if (!n) {
            invalid = true;
            continue;
        }
        const g = map.get(n.key) ?? { values: new Set<string>(), trusted: false };
        g.values.add(n.value);
        map.set(n.key, g);
    }
    return { map, invalid };
}
export function compareProducts(reference: Product, candidate: Product, policy: Policy): Identity {
    const reasons: Reason[] = [];
    const conflicts: Reason[] = [];
    const anchors: string[] = [];
    const a = groups(reference);
    const b = groups(candidate);
    const attrsA = attributes(reference);
    const attrsB = attributes(candidate);
    let unresolved = false;
    let trustedAnchor = false;
    let supporting = false;
    if (a.invalid || b.invalid) {
        unresolved = true;
        reasons.push({ code: 'INVALID_IDENTIFIER' });
    }
    for (const field of essential) {
        const x = attrsA[field], y = attrsB[field];
        if (x !== undefined && y !== undefined && x !== y)
            conflicts.push({ code: 'ATTRIBUTE_CONFLICT', field, detail: JSON.stringify({ reference: x, candidate: y }) });
        else if ((x === undefined) !== (y === undefined)) {
            unresolved = true;
            reasons.push({ code: 'ATTRIBUTE_MISSING', field });
        }
    }
    const ga = nameGeneration(reference), gb = nameGeneration(candidate);
    if (ga && gb && ga.base === gb.base && ga.generation !== gb.generation)
        conflicts.push({ code: 'NAME_GENERATION_CONFLICT', field: 'generation' });
    for (const [key, x] of a.map) {
        const y = b.map.get(key);
        if (!y)
            continue;
        if (key.startsWith('listing:'))
            continue;
        if (key.startsWith('catalog:')) {
            if ([...x.values].some(v => y.values.has(v))) {
                supporting = true;
                reasons.push({ code: 'CATALOG_MATCH_NOT_VARIANT_CONFIRMATION', field: key });
            }
            continue;
        }
        if (x.values.size > 1 || y.values.size > 1) {
            unresolved = true;
            reasons.push({ code: 'MULTIPLE_IDENTIFIER_VALUES', field: key });
        }
        const overlap = [...x.values].some(v => y.values.has(v));
        if (!overlap) {
            conflicts.push({ code: 'IDENTIFIER_CONFLICT', field: key, detail: JSON.stringify({ reference: [...x.values], candidate: [...y.values] }) });
            continue;
        }
        supporting = true;
        if (!key.startsWith('sku:')) {
            anchors.push(key);
            const verified = (p: Product) => p.identifiers.some(i => identifier(i)?.key === key && x.values.has(identifier(i)!.value) && usable(i.evidence, policy, policy.maxIdentityAgeMs));
            trustedAnchor ||= verified(reference) && verified(candidate);
        }
    }
    // Conflicting values inside one input must not be rescued by a matching value.
    for (const [key, g] of b.map)
        if (g.values.size > 1 && !key.startsWith('listing:') && !key.startsWith('catalog:')) {
            unresolved = true;
            reasons.push({ code: 'MULTIPLE_IDENTIFIER_VALUES', field: key });
        }
    let listing: Identity['listing'] = 'unconfirmed';
    const refListings = reference.identifiers.filter(i => i.scheme === 'listing');
    const candListings = candidate.identifiers.filter(i => i.scheme === 'listing');
    const listingConflicts: Reason[] = [];
    for (const ref of refListings) {
        const r = identifier(ref);
        const comparable = candListings.filter(i => identifier(i)?.key === r?.key);
        if (!r || !comparable.length)
            continue;
        if (comparable.some(i => identifier(i)?.value !== r.value)) {
            listing = 'incompatible';
            listingConflicts.push({ code: 'ORIGINAL_LISTING_DIFFERENT', field: r.key });
            break;
        }
        listing = 'probable';
        const sameSeller = reference.fields.seller && candidate.fields.seller && text(String(reference.fields.seller.value)) === text(String(candidate.fields.seller.value));
        const sameStore = reference.fields.store && candidate.fields.store && text(String(reference.fields.store.value)) === text(String(candidate.fields.store.value));
        const context = [reference.fields.seller, candidate.fields.seller, reference.fields.store, candidate.fields.store];
        if (sameSeller && sameStore && context.every(v => usable(v, policy, policy.maxIdentityAgeMs)) && namespace(String(candidate.fields.store!.value)) === namespace(ref.namespace!) && usable(comparable[0].evidence, policy, policy.maxIdentityAgeMs) && usable(ref.evidence, policy, policy.maxIdentityAgeMs))
            listing = 'exact';
    }
    for (const f of ['store', 'seller'] as const)
        if (reference.fields[f] && candidate.fields[f] && text(String(reference.fields[f]!.value)) !== text(String(candidate.fields[f]!.value))) {
            listing = 'incompatible';
            listingConflicts.push({ code: 'ORIGINAL_LISTING_CONTEXT_CONFLICT', field: f });
        }
    if (!refListings.length)
        reasons.push({ code: 'ORIGINAL_LISTING_NOT_SPECIFIED' });
    else if (listing === 'unconfirmed')
        reasons.push({ code: 'ORIGINAL_LISTING_NOT_CONFIRMED' });
    reasons.push(...listingConflicts);
    let product: Identity['product'] = 'unconfirmed';
    if (conflicts.length)
        product = 'incompatible';
    else if (unresolved)
        product = 'ambiguous';
    else if (anchors.length)
        product = trustedAnchor && essential.every(f => !candidate.fields[f] || usable(candidate.fields[f], policy, policy.maxIdentityAgeMs)) ? 'exact' : 'probable';
    else if (supporting || (reference.fields.brand && candidate.fields.brand && reference.fields.model && candidate.fields.model))
        product = 'probable';
    else if (reference.fields.name && candidate.fields.name && text(String(reference.fields.name.value)) === text(String(candidate.fields.name.value)))
        product = 'ambiguous';
    reasons.push({ code: product === 'exact' ? 'EXPLICIT_SCOPED_IDENTIFIER_MATCH' : product === 'probable' ? 'IDENTITY_REQUIRES_REVIEW' : product === 'incompatible' ? 'IDENTITY_CONFLICT' : product === 'ambiguous' ? 'IDENTITY_AMBIGUOUS' : 'INSUFFICIENT_IDENTITY' });
    if (candidate.identifiers.some(i => i.evidence.provenance.kind === 'search_index'))
        reasons.push({ code: 'INDEXED_IDENTIFIER_NOT_LIVE_CONFIRMATION' });
    return { product, listing, reasons, conflicts: [...conflicts, ...listingConflicts], anchors, requiresReview: product !== 'exact' || listing !== 'exact' };
}
