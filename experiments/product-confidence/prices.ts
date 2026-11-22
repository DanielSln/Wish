import type { Evidence, Money, Offer, Policy, PriceFact, Quote, Reason } from './contracts.ts';
import { CURRENCIES, commercialLink, evidence, record, usable } from './normalize.ts';
const roles = ['advertised', 'reported_total', 'installment', 'cash', 'pix', 'coupon_final', 'conditional', 'previous', 'shipping', 'additional_cost'];
/** Locale must be explicit. This parses currency units; it never interprets a discount. */
export function parseMinorUnits(input: unknown, currency: string, locale: 'pt-BR' | 'en-US'): Money | null {
    if (typeof input !== 'string' || input.length > 80 || !['BRL', 'USD', 'EUR', 'GBP'].includes(currency) || !['pt-BR', 'en-US'].includes(locale))
        return null;
    let value = input.normalize('NFKC').trim();
    if (currency === 'BRL')
        value = value.replace(/^R\$\s*/u, '');
    if (currency === 'USD')
        value = value.replace(/^\$\s*/u, '');
    value = value.replace(new RegExp(`^${currency}\\s+`, 'u'), '');
    const pattern = locale === 'pt-BR' ? /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/u : /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/u;
    if (!pattern.test(value))
        return null;
    const [whole, fraction = ''] = value.split(locale === 'pt-BR' ? ',' : '.');
    const digits = whole.replace(locale === 'pt-BR' ? /\./gu : /,/gu, '');
    const minorUnits = Number(digits) * 100 + Number(fraction.padEnd(2, '0'));
    const money = { minorUnits, currency };
    return moneyValid(money) ? money : null;
}
export function moneyValid(v: unknown): v is Money { return record(v) && typeof v.minorUnits === 'number' && Number.isSafeInteger(v.minorUnits) && v.minorUnits >= 0 && v.minorUnits <= 1000000000000 && typeof v.currency === 'string' && CURRENCIES.includes(v.currency); }
export function priceValid(p: unknown): p is PriceFact {
    return record(p) && typeof p.role === 'string' && roles.includes(p.role) && typeof p.basis === 'string' && ['product_total', 'delivered_total', 'unknown'].includes(p.basis) && (p.amount === undefined || (evidence(p.amount) && moneyValid(p.amount.value))) && ['condition', 'couponCode', 'rawText'].every(k => p[k] === undefined || (evidence(p[k]) && typeof p[k].value === 'string' && !!p[k].value.trim())) && (p.installmentCount === undefined || (evidence(p.installmentCount) && typeof p.installmentCount.value === 'number' && Number.isSafeInteger(p.installmentCount.value) && p.installmentCount.value > 0 && p.installmentCount.value <= 360));
}
export function provenanceReasons(value: Evidence<unknown> | undefined, policy: Policy, field: string, merchantHost?: string): Reason[] {
    if (!value)
        return [{ code: 'FIELD_MISSING', field }];
    const reasons: Reason[] = [];
    if (!usable(value, policy, policy.maxPriceAgeMs))
        reasons.push({ code: value.provenance.kind === 'cache' ? 'CACHED_INFORMATION' : value.provenance.kind === 'search_index' ? 'INDEXED_NOT_STORE_CONFIRMED' : 'UNVERIFIED_OR_STALE_INFORMATION', field });
    if (value.provenance.kind !== 'store_page')
        reasons.push({ code: 'DIRECT_STORE_EVIDENCE_REQUIRED', field });
    else if (!value.provenance.url || commercialLink(value.provenance.url).kind !== 'direct' || (merchantHost && commercialLink(value.provenance.url).host !== merchantHost))
        reasons.push({ code: 'SOURCE_HOST_NOT_CONFIRMED', field });
    return reasons;
}
export function interpretPrices(offer: Offer, policy: Policy): {
    quotes: Quote[];
    reasons: Reason[];
} {
    const quotes: Quote[] = [];
    const reasons: Reason[] = [];
    const host = offer.commercialUrl ? commercialLink(offer.commercialUrl.value).host : undefined;
    for (const fact of offer.prices) {
        if (['previous', 'shipping', 'additional_cost'].includes(fact.role))
            continue;
        if (fact.role === 'installment') {
            reasons.push({ code: 'INSTALLMENT_NOT_PRODUCT_PRICE' });
            continue;
        }
        if (!fact.amount || fact.basis === 'unknown') {
            reasons.push({ code: fact.role === 'coupon_final' ? 'COUPON_WITHOUT_EXPLICIT_FINAL' : 'UNINTERPRETABLE_PRICE' });
            continue;
        }
        if (fact.amount.value.minorUnits === 0) {
            reasons.push({ code: 'ZERO_PRODUCT_PRICE_REQUIRES_REVIEW' });
            continue;
        }
        const conditional = ['pix', 'coupon_final', 'conditional'].includes(fact.role) || !!fact.condition || !!fact.couponCode;
        const qr = provenanceReasons(fact.amount, policy, 'price', host);
        if (fact.amount.value.currency !== policy.currency)
            qr.push({ code: 'CURRENCY_NOT_COMPARABLE', field: 'price' });
        if (conditional && !fact.condition)
            qr.push({ code: 'CONDITION_NOT_EXPLICIT' });
        if (fact.role === 'coupon_final' && !fact.couponCode)
            qr.push({ code: 'COUPON_NOT_IDENTIFIED' });
        for (const f of ['condition', 'couponCode'] as const)
            if (fact[f])
                qr.push(...provenanceReasons(fact[f], policy, f, host));
        const condition = fact.condition?.value ?? '';
        const group = JSON.stringify([fact.amount.value.currency, fact.basis, conditional ? fact.role : 'common', condition, fact.couponCode?.value ?? '', offer.product.fields.quantity?.value ?? 'unknown']);
        quotes.push({ offerId: offer.id, role: fact.role, amount: fact.amount, basis: fact.basis, condition: fact.condition, couponCode: fact.couponCode, group, status: qr.length ? 'review' : conditional ? 'conditional' : 'eligible', reasons: qr });
    }
    // Different full prices in the same commercial group are a conflict, not a min().
    for (const q of quotes)
        if (quotes.some(other => other.group === q.group && other.amount.value.minorUnits !== q.amount.value.minorUnits)) {
            q.status = 'review';
            q.reasons.push({ code: 'CONFLICTING_FULL_PRICES' });
        }
    const distinct = quotes.filter((q, i) => quotes.findIndex(x => x.group === q.group && x.amount.value.minorUnits === q.amount.value.minorUnits) === i);
    if (!distinct.length)
        reasons.push({ code: 'NO_INTERPRETABLE_FULL_PRICE' });
    return { quotes: distinct, reasons };
}
