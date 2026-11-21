import type { Assessment, CandidateAssessment, Evidence, Field, Offer, OfferAssessment, Policy, Product, Reason } from './contracts.ts';
import { compareProducts } from './identity.ts';
import { FIELDS, attribute, commercialLink, evidence, namespace, plainData, policyValid, productValid, record, text, usable } from './normalize.ts';
import { interpretPrices, priceValid, provenanceReasons } from './prices.ts';
interface Candidate {
    id: string;
    product: Product;
    offers: Offer[];
}
function offerValid(v: unknown): v is Offer {
    return record(v) && typeof v.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/u.test(v.id) && productValid(v.product) && Array.isArray(v.prices) && v.prices.length <= 40 && v.prices.every(priceValid) && (v.availability === undefined || (evidence(v.availability) && typeof v.availability.value === 'string' && ['in_stock', 'out_of_stock', 'unknown'].includes(v.availability.value))) && (v.commercialUrl === undefined || (evidence(v.commercialUrl) && typeof v.commercialUrl.value === 'string'));
}
export function assessOffer(reference: Product, offer: Offer, policy: Policy): OfferAssessment {
    const identity = compareProducts(reference, offer.product, policy);
    const reasons: Reason[] = [];
    let rejected = false;
    if (identity.product === 'incompatible') {
        rejected = true;
        reasons.push({ code: 'PRODUCT_INCOMPATIBLE' });
    }
    else if (identity.product !== 'exact')
        reasons.push({ code: 'PRODUCT_IDENTITY_REQUIRES_REVIEW' });
    if (policy.purpose === 'original_listing' && identity.listing !== 'exact') {
        reasons.push({ code: 'ORIGINAL_LISTING_NOT_EXACT' });
        if (identity.listing === 'incompatible')
            rejected = true;
    }
    if (offer.availability?.value === 'out_of_stock') {
        rejected = true;
        reasons.push({ code: 'OUT_OF_STOCK' });
    }
    else if (offer.availability?.value !== 'in_stock')
        reasons.push({ code: 'AVAILABILITY_UNKNOWN' });
    const link = offer.commercialUrl ? commercialLink(offer.commercialUrl.value) : { kind: 'invalid' as const, host: undefined };
    if (link.kind !== 'direct')
        reasons.push({ code: link.kind === 'indirect' ? 'INDIRECT_COMMERCIAL_LINK' : 'INVALID_COMMERCIAL_LINK' });
    reasons.push(...provenanceReasons(offer.commercialUrl, policy, 'commercialUrl', link.host));
    reasons.push(...provenanceReasons(offer.availability, policy, 'availability', link.host));
    for (const field of ['store', 'seller'] as const) {
        const value = offer.product.fields[field];
        reasons.push(...provenanceReasons(value, policy, field, link.host));
        if (field === 'store' && value && namespace(String(value.value)) !== link.host)
            reasons.push({ code: 'STORE_URL_MISMATCH' });
        if (field === 'seller' && value && /^(?:unknown|desconhecido|n\/a|não informado|nao informado|seller|vendedor|amazon\.com\.br - seller)$/u.test(text(String(value.value))))
            reasons.push({ code: 'SELLER_UNKNOWN' });
    }
    for (const field of ['quantity', 'condition', 'role'] as const)
        reasons.push(...provenanceReasons(offer.product.fields[field], policy, field, link.host));
    const condition = offer.product.fields.condition;
    if (condition && !['new', 'used', 'refurbished', 'open_box'].includes(attribute('condition', condition.value)))
        reasons.push({ code: 'CONDITION_UNKNOWN' });
    const role = offer.product.fields.role;
    if (role && !['product', 'accessory'].includes(attribute('role', role.value)))
        reasons.push({ code: 'PRODUCT_ROLE_UNKNOWN' });
    // Shipping/additional charges are never silently folded into a product price.
    const costs = offer.prices.filter(p => ['shipping', 'additional_cost'].includes(p.role));
    const interpreted = interpretPrices(offer, policy);
    reasons.push(...interpreted.reasons);
    for (const quote of interpreted.quotes) {
        if (quote.basis === 'product_total' && !costs.some(c => c.role === 'shipping' && c.amount))
            quote.reasons.push({ code: 'SHIPPING_UNKNOWN' });
        for (const cost of costs) {
            if (!cost.amount)
                quote.reasons.push({ code: 'ADDITIONAL_COST_UNKNOWN' });
            else {
                quote.reasons.push(...provenanceReasons(cost.amount, policy, cost.role, link.host));
                if (cost.amount.value.currency !== quote.amount.value.currency)
                    quote.reasons.push({ code: 'COST_CURRENCY_CONFLICT' });
            }
        }
        // Preserve explicit totals without assuming they include shipping/PIX.
        if (reasons.some(r => !['INSTALLMENT_NOT_PRODUCT_PRICE', 'COUPON_WITHOUT_EXPLICIT_FINAL'].includes(r.code)) || quote.reasons.length || rejected)
            quote.status = 'review';
    }
    const common = interpreted.quotes.some(q => q.status === 'eligible');
    const conditional = interpreted.quotes.some(q => q.status === 'conditional');
    return { offerId: offer.id, inputEvidence: offer.product, identity, status: rejected ? 'rejected' : common ? 'eligible' : conditional ? 'conditional' : 'review', reasons, quotes: interpreted.quotes, prices: offer.prices };
}
function suggestions(p: Product, identity: ReturnType<typeof compareProducts>, policy: Policy): CandidateAssessment['fields'] {
    const suggest: Partial<Record<Field, Evidence<string | number>>> = {};
    const review: Field[] = [];
    const empty: Field[] = [];
    for (const field of FIELDS) {
        const value = p.fields[field];
        if (!value || identity.product === 'incompatible' || (['image', 'originalUrl'].includes(field) && commercialLink(String(value.value)).kind === 'invalid')) {
            empty.push(field);
            continue;
        }
        if (identity.product === 'exact' && usable(value, policy, policy.maxIdentityAgeMs) && !['store', 'seller', 'originalUrl'].includes(field) && (!['image', 'originalUrl'].includes(field) || commercialLink(String(value.value)).kind === 'direct'))
            suggest[field] = value;
        else
            review.push(field);
    }
    return { suggest, review, empty };
}
/** Public untrusted-data boundary. No getters, eval, fetch, filesystem or global clock. */
export function assess(input: unknown): Assessment {
    const fail = (code: string): Assessment => ({ candidates: [], eligibleOffers: [], conditionalOffers: [], reviewOffers: [], rejectedOffers: [], manualRequired: true, errors: [{ code }] });
    let value: unknown;
    try {
        value = plainData(input);
    }
    catch {
        return fail('INVALID_OR_OVERSIZED_INPUT');
    }
    if (!record(value) || !productValid(value.reference) || !policyValid(value.policy) || !Array.isArray(value.candidates) || value.candidates.length > 30)
        return fail('INVALID_CONTRACT');
    if (!value.candidates.every((c: unknown) => record(c) && typeof c.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/u.test(c.id) && productValid(c.product) && Array.isArray(c.offers) && c.offers.length <= 30 && c.offers.every(offerValid)))
        return fail('INVALID_CONTRACT');
    const reference = value.reference, policy = value.policy, candidates = value.candidates as Candidate[];
    if (new Set(candidates.map(c => c.id)).size !== candidates.length)
        return fail('DUPLICATE_CANDIDATE_ID');
    const results: CandidateAssessment[] = candidates.map(c => { const identity = compareProducts(reference, c.product, policy); return { id: c.id, inputEvidence: c.product, identity, fields: suggestions(c.product, identity, policy), offers: c.offers.map(o => assessOffer(reference, o, policy)) }; });
    const evaluated = results.flatMap(c => c.offers);
    const all = candidates.flatMap(c => c.offers);
    const duplicateKey = (offer: Offer) => JSON.stringify([offer.commercialUrl?.value.replace(/#.*$/u, ''), text(String(offer.product.fields.store?.value ?? '')), text(String(offer.product.fields.seller?.value ?? ''))]);
    const seen = new Map<string, number>();
    for (let i = 0; i < all.length; i++) {
        const key = duplicateKey(all[i]);
        const previous = seen.get(key);
        if (previous === undefined) {
            seen.set(key, i);
            continue;
        }
        const a = evaluated[previous], b = evaluated[i];
        const signature = (o: Offer) => JSON.stringify({ product: o.product, prices: o.prices, availability: o.availability, commercialUrl: o.commercialUrl });
        if (signature(all[previous]) === signature(all[i]) && a.identity.product === b.identity.product) {
            b.status = 'rejected';
            b.reasons.push({ code: 'DUPLICATE_OFFER' });
            for (const q of b.quotes)
                q.status = 'review';
        }
        else
            for (const o of [a, b]) {
                if (o.status !== 'rejected')
                    o.status = 'review';
                o.reasons.push({ code: 'DUPLICATE_SOURCE_CONFLICT' });
                for (const q of o.quotes)
                    q.status = 'review';
            }
    }
    const duplicates = new Set(all.filter((o, i) => all.findIndex(x => x.id === o.id) !== i).map(o => o.id));
    for (const o of evaluated)
        if (duplicates.has(o.offerId)) {
            if (o.status !== 'rejected')
                o.status = 'review';
            o.reasons.push({ code: 'DUPLICATE_OFFER_ID' });
            for (const q of o.quotes)
                q.status = 'review';
        }
    const eligibleOffers = evaluated.filter(o => o.status !== 'rejected').flatMap(o => o.quotes.filter(q => q.status === 'eligible'));
    const conditionalOffers = evaluated.filter(o => o.status !== 'rejected').flatMap(o => o.quotes.filter(q => q.status === 'conditional'));
    return { candidates: results, eligibleOffers, conditionalOffers, reviewOffers: evaluated.filter(o => o.status === 'review'), rejectedOffers: evaluated.filter(o => o.status === 'rejected'), manualRequired: !results.some(c => c.identity.product === 'exact' && c.fields.suggest.name), errors: [] };
}
export { compareProducts } from './identity.ts';
export { interpretPrices } from './prices.ts';
