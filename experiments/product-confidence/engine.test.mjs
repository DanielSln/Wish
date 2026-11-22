import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assess } from './engine.ts';
import { parseMinorUnits } from './prices.ts';
import { gtin } from './normalize.ts';
import { fact, id, product, offer, amount, batch, real, originalMercadoReference } from './fixtures.mjs';
const candidateResult = x => assess(x).candidates[0];
const productClass = x => candidateResult(x)?.identity.product;
const quote = x => assess(x).eligibleOffers;
test('synthetic: fresh explicit manufacturer anchor supports exact product, independent of missing original listing', () => {
    const r = assess(batch());
    assert.equal(r.candidates[0].identity.product, 'exact');
    assert.equal(r.candidates[0].identity.listing, 'unconfirmed');
    assert.equal(r.eligibleOffers.length, 1);
    assert.equal(r.manualRequired, false);
});
for (const [field, value] of Object.entries({ brand: 'other', model: 'A2', color: 'red', generation: 'III', capacity: '256 GB', size: 'L', quantity: 2, condition: 'used', role: 'accessory', connectivity: 'wireless', category: 'clothes' })) {
    test(`synthetic: explicit ${field} conflict overrides the same identifier`, () => {
        const ref = product({ [field]: fact(({ color: 'black', generation: 'II', capacity: '128 GB', size: 'M', connectivity: 'wired', category: 'technology' })[field] ?? product().fields[field].value) });
        const cand = product({ [field]: fact(value) });
        assert.equal(productClass(batch(cand, [], ref)), 'incompatible');
    });
}
test('synthetic: missing variant does not confirm it', () => { const p = product(); delete p.fields.model; assert.equal(productClass(batch(p)), 'ambiguous'); });
test('synthetic: no evidence is unconfirmed, exact names alone remain ambiguous', () => {
    assert.equal(productClass(batch({ fields: {}, identifiers: [] }, [], { fields: {}, identifiers: [] })), 'unconfirmed');
    const p = { fields: { name: fact('Same name') }, identifiers: [] };
    assert.equal(productClass(batch(p, [], p)), 'ambiguous');
});
test('synthetic: brand/model agreement is probable, not a probability score', () => { const p = product(); p.identifiers = []; const r = candidateResult(batch(p, [], p)); assert.equal(r.identity.product, 'probable'); assert.equal('score' in r.identity, false); });
test('synthetic: ASIN is scoped and never confirms seller/listing', () => { const p = product(); p.identifiers = [id('asin', 'b0grwj9qbr', 'amazon.com.br')]; const ref = structuredClone(p); ref.identifiers[0].evidence.value = 'B0GRWJ9QBR'; const r = candidateResult(batch(p, [], ref)); assert.equal(r.identity.product, 'exact'); assert.notEqual(r.identity.listing, 'exact'); });
test('synthetic: store SKUs never become global product anchors', () => {
    const a = product(), b = product();
    a.identifiers = [id('sku', 'same', 'store-a')];
    b.identifiers = [id('sku', 'same', 'store-b')];
    delete a.fields.model;
    delete b.fields.model;
    assert.equal(productClass(batch(b, [], a)), 'ambiguous');
});
test('synthetic: conflicting MPN is incompatible even with the same product name', () => { const p = product(); p.identifiers = [id('mpn', 'A2')]; assert.equal(productClass(batch(p)), 'incompatible'); });
test('synthetic: GTIN checksum and padded equivalents', () => { assert.equal(gtin('4006381333931'), gtin('04006381333931')); assert.equal(gtin('4006381333932'), null); assert.equal(gtin('00000000'), null); const a = product(), b = product(); a.identifiers = [id('gtin', '4006381333931')]; b.identifiers = [id('gtin', '04006381333931')]; assert.equal(productClass(batch(b, [], a)), 'exact'); });
test('synthetic: invalid identifier cannot be rescued by another good anchor', () => { const p = product(); p.identifiers.push(id('gtin', 'invalid')); assert.equal(productClass(batch(p)), 'ambiguous'); });
test('synthetic: multiple contradictory identifier values require review', () => { const p = product(); p.identifiers.push(id('mpn', 'A2')); assert.equal(productClass(batch(p)), 'ambiguous'); });
test('synthetic: brand/model conflicts remain incompatible despite shared GTIN', () => { const p = product({ model: fact('B2') }); p.identifiers.push(id('gtin', '4006381333931')); assert.equal(productClass(batch(p)), 'incompatible'); });
test('synthetic: formatting aliases preserve meaningful differences', () => { const a = product({ color: fact('preto'), capacity: fact('128GB') }), b = product({ color: fact('BLACK'), capacity: fact('128 gb') }); assert.equal(productClass(batch(b, [], a)), 'exact'); b.fields.capacity = fact('128 GiB'); assert.equal(productClass(batch(b, [], a)), 'incompatible'); });
for (const kind of ['search_index', 'cache', 'insufficient'])
    test(`synthetic: ${kind} anchor does not become exact live identity`, () => { const p = product(); p.identifiers[0].evidence.provenance.kind = kind; assert.equal(productClass(batch(p)), 'probable'); });
test('synthetic: an indexed color does not inherit trust from a direct identifier', () => { const p = product({ color: fact('red', 'search_index') }), r = product({ color: fact('red') }); assert.equal(productClass(batch(p, [], r)), 'probable'); });
test('synthetic: same listing requires seller/store context and trusted evidence', () => { const r = product(); r.identifiers.push(id('listing', 'L1', 'shop.example')); const p = structuredClone(r); assert.equal(candidateResult(batch(p, [], r)).identity.listing, 'exact'); p.fields.seller = fact('other'); const result = candidateResult(batch(p, [], r)); assert.equal(result.identity.product, 'exact'); assert.equal(result.identity.listing, 'incompatible'); });
test('synthetic: original-listing purpose rejects a different listing while comparison can retain another seller', () => { const r = product(); r.identifiers.push(id('listing', 'L1', 'shop.example')); const p = structuredClone(r); p.identifiers[1].evidence.value = 'L2'; const o = offer({ product: p }); assert.equal(assess(batch(p, [o], r, { purpose: 'original_listing' })).rejectedOffers.length, 1); assert.equal(assess(batch(p, [o], r)).eligibleOffers.length, 1); });
test('real-sanitized Amazon candidate + synthetic wrong generation: ASIN cannot erase III versus II', () => { const reference = structuredClone(real.amazon); reference.fields.name.value = 'HyperX Cloud Earbuds II vermelho'; assert.equal(productClass(batch(real.amazon, [], reference)), 'incompatible'); });
test('real-sanitized: same Amazon ASIN is indexed evidence, not a live verified price', () => { const r = assess(batch(real.amazon, [], real.amazon)); assert.equal(r.candidates[0].identity.product, 'probable'); assert.equal(r.eligibleOffers.length, 0); });
test('real-sanitized: Mercado Livre original catalog/listing cannot be replaced by another listing', () => { const r = assess(batch(real.mercado.product, [real.mercado], originalMercadoReference, { purpose: 'original_listing' })); assert.equal(r.candidates[0].identity.listing, 'incompatible'); assert.equal(r.eligibleOffers.length, 0); assert.equal(r.rejectedOffers.length, 1); assert.equal(r.rejectedOffers[0].prices[1].amount.value.minorUnits, 27999); assert.equal(r.rejectedOffers[0].prices[0].amount.value.minorUnits, 2739); });
test('real-sanitized KaBuM variant + synthetic low price: reject 727A8AA for requested 727A9AA', () => { const ref = structuredClone(real.kabumWrong); ref.fields.model.value = '727A9AA'; ref.fields.color.value = 'preto e vermelho'; ref.identifiers[0].evidence.value = '727A9AA'; const r = assess(batch(real.kabumWrong, [offer({ product: real.kabumWrong, prices: [amount(1)] })], ref)); assert.equal(r.rejectedOffers.length, 1); assert.equal(r.eligibleOffers.length, 0); });
test('real-sanitized: Magalu catalog is a useful indexed candidate, not original-listing evidence', () => { const r = candidateResult(batch(real.magalu, [], real.magalu)); assert.notEqual(r.identity.product, 'exact'); assert.equal(r.identity.listing, 'unconfirmed'); assert.ok(r.fields.review.includes('model')); });
test('real-sanitized: another Magalu catalog/seller cannot supply the original price', () => { const r = assess(batch(real.magalu, [real.magaluAlternative], real.magalu, { purpose: 'original_listing' })); assert.equal(r.eligibleOffers.length, 0); assert.equal(r.conditionalOffers.length, 0); assert.equal(r.candidates[0].offers[0].prices[1].amount.value.minorUnits, 34265); assert.notEqual(r.candidates[0].offers[0].identity.listing, 'exact'); });
test('synthetic using documented Shopee IDs: same 70N24AA model does not confirm original listing', () => { const ref = product({ brand: fact('HyperX'), model: fact('70N24AA'), name: fact('HyperX Cloud Earbuds II') }); ref.identifiers = [id('mpn', '70N24AA', 'hyperx'), id('listing', '301983687.20699569312', 'shopee.com.br')]; const p = structuredClone(ref); p.identifiers = p.identifiers.filter(i => i.scheme !== 'listing'); const r = assess(batch(p, [offer({ product: p })], ref, { purpose: 'original_listing' })); assert.equal(r.candidates[0].identity.product, 'exact'); assert.equal(r.candidates[0].identity.listing, 'unconfirmed'); assert.equal(r.eligibleOffers.length, 0); assert.equal(r.reviewOffers.length, 1); });
for (const role of ['installment', 'previous'])
    test(`synthetic: ${role} alone never supplies a product price`, () => { assert.equal(quote(batch(product(), [offer({ prices: [amount(2739, role)] })])).length, 0); });
test('synthetic: reported total with unknown basis is preserved but never called cash/delivered', () => { const r = assess(batch(product(), [offer({ prices: [amount(27999, 'reported_total', 'BRL', 'unknown')] })])); assert.equal(r.eligibleOffers.length, 0); assert.equal(r.reviewOffers[0].prices[0].amount.value.minorUnits, 27999); assert.equal(r.reviewOffers[0].quotes.length, 0); });
test('synthetic: explicit integral total survives a separate installment without calculating it', () => { const r = assess(batch(product(), [offer({ prices: [amount(2739, 'installment'), amount(27999, 'reported_total'), amount(0, 'shipping')] })])); assert.equal(r.eligibleOffers[0].amount.value.minorUnits, 27999); });
test('synthetic: explicit PIX and coupon remain separate from common price', () => { const pix = { ...amount(9000, 'pix'), condition: fact('PIX') }; const coupon = { ...amount(8500, 'coupon_final'), condition: fact('PIX + coupon'), couponCode: fact('SAVE') }; const r = assess(batch(product(), [offer({ prices: [amount(10000), pix, coupon, amount(0, 'shipping')] })])); assert.equal(r.eligibleOffers[0].amount.value.minorUnits, 10000); assert.deepEqual(r.conditionalOffers.map(q => q.amount.value.minorUnits), [9000, 8500]); });
test('synthetic: coupon without explicit final never creates a discounted value', () => { const r = assess(batch(product(), [offer({ prices: [amount(10000), { role: 'coupon_final', basis: 'unknown', couponCode: fact('SAVE15') }, amount(0, 'shipping')] })])); assert.equal(r.eligibleOffers[0].amount.value.minorUnits, 10000); assert.equal(r.conditionalOffers.length, 0); });
test('synthetic: conditional price without conditions requires review', () => { assert.equal(assess(batch(product(), [offer({ prices: [amount(9000, 'pix'), amount(0, 'shipping')] })])).conditionalOffers.length, 0); });
test('synthetic: conflicting full prices are not resolved with min()', () => { const r = assess(batch(product(), [offer({ prices: [amount(10000), amount(9000, 'reported_total'), amount(0, 'shipping')] })])); assert.equal(r.eligibleOffers.length, 0); assert.ok(r.reviewOffers[0].quotes.every(q => q.reasons.some(r => r.code === 'CONFLICTING_FULL_PRICES'))); });
for (const value of ['out_of_stock', 'unknown'])
    test(`synthetic: ${value} is not ranked`, () => { assert.equal(quote(batch(product(), [offer({ availability: fact(value) })])).length, 0); });
test('synthetic: foreign currency is not compared with BRL', () => { assert.equal(quote(batch(product(), [offer({ prices: [amount(100, 'cash', 'USD'), amount(0, 'shipping', 'USD')] })])).length, 0); });
test('synthetic: stale price/cache/manual/index evidence cannot enter automatic ranking', () => {
    for (const kind of ['search_index', 'manual', 'cache']) {
        const o = offer();
        o.prices[0].amount.provenance.kind = kind;
        assert.equal(quote(batch(product(), [o])).length, 0);
    }
    const o = offer();
    o.prices[0].amount.provenance.observedAt = '2026-11-20T18:00:00Z';
    assert.equal(quote(batch(product(), [o])).length, 0);
});
test('synthetic: future timestamps do not become trusted', () => { const o = offer(); o.availability.provenance.observedAt = '2026-12-01T00:00:00Z'; assert.equal(quote(batch(product(), [o])).length, 0); });
test('synthetic: unknown shipping or additional cost blocks delivery inference', () => { assert.equal(quote(batch(product(), [offer({ prices: [amount(10000)] })])).length, 0); const o = offer(); o.prices.push({ role: 'additional_cost', basis: 'unknown' }); assert.equal(quote(batch(product(), [o])).length, 0); });
test('synthetic: explicit delivery basis stays separate from base product price', () => { const o = offer({ prices: [amount(10000), amount(10500, 'reported_total', 'BRL', 'delivered_total'), amount(500, 'shipping')] }); const r = assess(batch(product(), [o])); assert.equal(r.eligibleOffers.length, 2); assert.notEqual(r.eligibleOffers[0].group, r.eligibleOffers[1].group); });
for (const url of ['https://www.google.com.br/search?q=x', 'https://shopping.google.com/product', 'https://serpapi.com/searches/example', 'https://a.co/d/x', '/goto?url=x', 'http://shop.example/p', 'https://127.0.0.1/p', 'https://user:pass@shop.example/p', 'javascript:alert(1)', 'https://shop.example:444/p'])
    test(`synthetic: unusable/indirect link ${url.split(':')[0]} is not ranked`, () => { assert.equal(quote(batch(product(), [offer({ commercialUrl: fact(url) })])).length, 0); });
test('synthetic: source and commercial host must agree; no store trust badge is produced', () => { const o = offer({ commercialUrl: fact('https://another.example/p') }); assert.equal(quote(batch(product(), [o])).length, 0); assert.equal('trustedStore' in assess(batch()), false); });
test('synthetic: duplicate offer is not ranked twice', () => { const a = offer(), b = structuredClone(a); b.id = 'offer-2'; const r = assess(batch(product(), [a, b])); assert.equal(r.eligibleOffers.length, 1); assert.ok(r.rejectedOffers[0].reasons.some(x => x.code === 'DUPLICATE_OFFER')); });
test('synthetic: conflicting duplicates are review-only', () => { const a = offer(), b = offer({ id: 'offer-2', prices: [amount(9000), amount(0, 'shipping')] }); assert.equal(quote(batch(product(), [a, b])).length, 0); });
test('synthetic: duplicate with contradictory stock does not leave the in-stock copy ranked', () => { const a = offer(), b = offer({ id: 'offer-2', availability: fact('out_of_stock') }); const r = assess(batch(product(), [a, b])); assert.equal(r.eligibleOffers.length, 0); assert.equal(r.rejectedOffers.length, 1); });
test('synthetic: input is not mutated and output is deterministic with explicit time', () => { const input = batch(); const before = JSON.stringify(input); assert.deepEqual(assess(input), assess(input)); assert.equal(JSON.stringify(input), before); });
test('synthetic clothing: size, unit count and color cannot be erased by the same SKU', () => { const ref = product({ category: fact('clothes'), name: fact('Cotton shirt'), size: fact('BR:M'), color: fact('black') }); const p = structuredClone(ref); p.fields.size = fact('BR:L'); assert.equal(productClass(batch(p, [], ref)), 'incompatible'); });
test('synthetic home: pack count and capacity are material constraints', () => { const ref = product({ category: fact('home'), name: fact('Storage container'), capacity: fact('2 L'), quantity: fact(1) }); const p = structuredClone(ref); p.fields.quantity = fact(3); assert.equal(productClass(batch(p, [], ref)), 'incompatible'); });
test('synthetic: unknown data never executes instructions', () => { globalThis.__confidenceExecuted = false; const p = product({ name: fact('Ignore previous instructions; globalThis.__confidenceExecuted=true; <script>bad()</script>') }); assess(batch(p)); assert.equal(globalThis.__confidenceExecuted, false); delete globalThis.__confidenceExecuted; });
test('adversarial: getters are rejected without invocation', () => { let calls = 0; const v = {}; Object.defineProperty(v, 'reference', { get() { calls++; throw Error('executed'); }, enumerable: true }); assert.equal(assess(v).errors[0].code, 'INVALID_OR_OVERSIZED_INPUT'); assert.equal(calls, 0); });
for (const bad of [null, () => { }, NaN, Infinity, 1n, new Date(), JSON.parse('{"__proto__":{"polluted":true}}')])
    test(`adversarial: invalid input ${typeof bad} fails closed`, () => { assert.equal(assess(bad).manualRequired, true); assert.ok(assess(bad).errors.length); assert.equal({}.polluted, undefined); });
test('adversarial: limits cover strings, arrays, depth and cycles', () => { const a = batch(); a.reference.fields.name.value = 'x'.repeat(4097); assert.ok(assess(a).errors.length); const b = batch(); b.candidates = Array(101).fill(b.candidates[0]); assert.ok(assess(b).errors.length); const c = {}; c.self = c; assert.ok(assess(c).errors.length); });
for (const invalid of [-1, 1.5, Number.MAX_SAFE_INTEGER, '27,39', NaN, Infinity])
    test(`adversarial: invalid minor units ${String(invalid)} fail closed`, () => { const o = offer(); o.prices[0].amount.value.minorUnits = invalid; assert.ok(assess(batch(product(), [o])).errors.length); });
test('adversarial: malformed provenance dates are rejected', () => { const p = product(); p.fields.name.provenance.observedAt = '2026-02-30T00:00:00Z'; assert.ok(assess(batch(p)).errors.length); });
for (const field of ['role', 'basis'])
    test(`adversarial: object in enum ${field} never invokes coercion or throws`, () => { const o = offer(); o.prices[0][field] = { payload: 'untrusted' }; assert.doesNotThrow(() => assess(batch(product(), [o]))); assert.ok(assess(batch(product(), [o])).errors.length); });
test('adversarial: identifier/availability/policy enum objects fail closed', () => {
    for (const variant of ['identifier', 'availability', 'policy']) {
        const b = batch();
        if (variant === 'identifier')
            b.reference.identifiers[0].scheme = {};
        if (variant === 'availability')
            b.candidates[0].offers[0].availability.value = {};
        if (variant === 'policy')
            b.policy.purpose = {};
        assert.doesNotThrow(() => assess(b));
        assert.ok(assess(b).errors.length);
    }
});
test('synthetic: malformed source URL does not verify an otherwise matching identifier', () => { const p = product(); p.identifiers[0].evidence.provenance.url = 'javascript:bad()'; assert.equal(productClass(batch(p)), 'probable'); });
test('synthetic: stale identity, cached availability and unknown seller remain review-only', () => { const p = product(); p.identifiers[0].evidence.provenance.observedAt = '2025-01-01T00:00:00Z'; assert.equal(productClass(batch(p)), 'probable'); const o = offer(); o.availability.provenance.kind = 'cache'; assert.equal(quote(batch(product(), [o])).length, 0); const noSeller = product(); delete noSeller.fields.seller; assert.equal(quote(batch(noSeller, [offer({ product: noSeller })])).length, 0); });
test('synthetic: unsafe image and missing fields stay empty; indexed fields need their own review', () => { const p = product({ image: fact('javascript:bad()'), description: fact('Indexed description', 'search_index') }); const r = candidateResult(batch(p)); assert.ok(r.fields.empty.includes('image')); assert.ok(r.fields.review.includes('description')); assert.equal(r.fields.suggest.description, undefined); });
test('adversarial: invalid policy, candidate cap, sparse arrays and nested size limit fail closed', () => { const b = batch(); b.policy.maxPriceAgeMs = -1; assert.ok(assess(b).errors.length); const c = batch(); c.candidates = Array.from({ length: 31 }, (_, i) => ({ ...c.candidates[0], id: `c${i}` })); assert.ok(assess(c).errors.length); const d = batch(); d.candidates = Array(2); assert.ok(assess(d).errors.length); const e = batch(); e.extra = Array.from({ length: 70 }, () => 'x'.repeat(2000)); assert.ok(assess(e).errors.length); });
test('synthetic: quantity, condition and regional clothing sizes remain distinct', () => { const p = product({ size: fact('EU:42') }); const r = product({ size: fact('BR:42') }); assert.equal(productClass(batch(p, [], r)), 'incompatible'); p.fields.size = fact('BR:42'); p.fields.condition = fact('refurbished'); assert.equal(productClass(batch(p, [], r)), 'incompatible'); });
test('synthetic: returned prices are detached from the caller data', () => { const b = batch(); const r = assess(b); r.eligibleOffers[0].amount.value.minorUnits = 7; assert.equal(b.candidates[0].offers[0].prices[0].amount.value.minorUnits, 10000); });
test('synthetic: listing context from search does not inherit a direct listing identifier confidence', () => { const ref = product(); ref.identifiers.push(id('listing', 'L1', 'shop.example')); const p = structuredClone(ref); p.fields.seller.provenance.kind = 'search_index'; assert.equal(candidateResult(batch(p, [], ref)).identity.listing, 'probable'); });
test('synthetic: unknown listing namespace cannot be treated as the known store context', () => { const ref = product(); ref.identifiers.push(id('listing', 'L1', 'other.example')); const p = structuredClone(ref); assert.notEqual(candidateResult(batch(p, [], ref)).identity.listing, 'exact'); });
test('adversarial: deterministic malformed enum corpus never executes conversion hooks', () => {
    for (const invalid of [{}, [], null, 0, true, { toString: 'payload' }]) {
        for (const key of ['role', 'basis']) {
            const b = batch();
            b.candidates[0].offers[0].prices[0][key] = invalid;
            assert.doesNotThrow(() => assess(b));
            assert.ok(assess(b).errors.length);
        }
    }
});
test('adversarial: unknown currency codes are not silently accepted as comparable money', () => { const b = batch(); b.policy.currency = 'ZZZ'; assert.ok(assess(b).errors.length); const o = offer({ prices: [amount(10000, 'cash', 'ZZZ')] }); assert.ok(assess(batch(product(), [o])).errors.length); });
test('synthetic: unknown quantity/condition/role must not be ranked despite exact identifiers', () => {
    for (const field of ['quantity', 'condition', 'role']) {
        const p = product();
        delete p.fields[field];
        assert.equal(quote(batch(p, [offer({ product: p })], p)).length, 0);
    }
});
test('synthetic: placeholder seller and condition are not evidence of known commercial context', () => {
    for (const field of ['seller', 'condition']) {
        const p = product({ [field]: fact('unknown') });
        assert.equal(quote(batch(p, [offer({ product: p })], p)).length, 0);
    }
});
test('synthetic: uninterpretable raw price text is retained without conversion', () => {
    const o = offer({ prices: [{ role: 'advertised', basis: 'unknown', rawText: fact('A partir de 12x R$ 27,39') }] });
    const r = assess(batch(product(), [o]));
    assert.equal(r.eligibleOffers.length, 0);
    assert.equal(r.reviewOffers[0].prices[0].rawText.value, 'A partir de 12x R$ 27,39');
});
test('synthetic: a date known only by day cannot certify fresh direct price', () => {
    const o = offer();
    o.prices[0].amount.provenance.timePrecision = 'day';
    assert.equal(quote(batch(product(), [o])).length, 0);
});
test('money parsing: explicit locale/currency and exact cents, no promotional arithmetic', () => {
    assert.deepEqual(parseMinorUnits('R$ 1.234,56', 'BRL', 'pt-BR'), { minorUnits: 123456, currency: 'BRL' });
    assert.deepEqual(parseMinorUnits('$1,234.56', 'USD', 'en-US'), { minorUnits: 123456, currency: 'USD' });
    for (const x of ['12x de R$ 27,39', '15% OFF', '1e3', '-10,00', '27,399', '1,234.56', 'NaN'])
        assert.equal(parseMinorUnits(x, 'BRL', 'pt-BR'), null);
});
