import { request as rawHttpRequest } from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import { GatewayStore } from './store.ts';
import { SearchGateway } from './gateway.ts';
import { MockProvider, serpDescriptor } from './provider.ts';
import { localServer } from './http.ts';
import { adapt, cachedCandidates } from './adapters.ts';
import { validate, fingerprint } from './validation.ts';
import { safeUrl, redact } from './validation.ts';
test('signed credential URLs are refused without stripping essential listing parameters', () => {
    for (const key of ['apiKey', 'X-Amz-Signature', 'X-Amz-Credential', 'X-Amz-Security-Token', 'password', 'access_token']) {
        assert.equal(safeUrl(`https://shop.example/product?${key}=fake-private`), undefined);
        assert.equal(redact(`https://shop.example/product?${key}=fake-private`).includes('fake-private'), false);
    }
    const url = 'https://www.mercadolivre.com.br/product?pdp_filters=item_id%3AMLB5097782981&seller_id=123';
    assert.equal(safeUrl(url), url);
});
import { fixtures } from './fixtures.ts';
const NOW = Date.parse('2026-11-21T19:00:00Z');
const snap = (changes = {}) => ({ simulation: true, free: true, cycleId: 'mock-cycle-1', startsAt: NOW - 1000, renewsAt: NOW + 30 * 86400000, observedAt: NOW, remaining: 236, used: 14, monthlyLimit: 250, ...changes });
const identify = (changes = {}) => ({ version: 1, requestId: randomUUID(), product: { name: 'HyperX Cloud Earbuds III vermelho', identifiers: [{ scheme: 'asin', namespace: 'amazon.com.br', value: 'B0GRWJ9QBR' }] }, ...changes });
const compare = (changes = {}) => ({ version: 1, requestId: randomUUID(), confirmedByOwner: true, product: { name: 'HyperX Cloud Earbuds II', brand: 'HyperX', model: '70N24AA', identifiers: [{ scheme: 'mpn', namespace: 'hyperx', value: '70N24AA' }] }, ...changes });
function setup(t, options = {}, storeOptions) { const store = new GatewayStore(':memory:', storeOptions); store.reconcile(snap(), NOW); const provider = new MockProvider({ clock: () => NOW, ...options.provider }); const gateway = new SearchGateway(store, provider, { clock: () => NOW, ...options.gateway }); t.after(() => store.close()); return { store, provider, gateway }; }
const failed = code => e => e?.code === code;
const delay = ms => new Promise(r => setTimeout(r, ms));
const wrapped = (engine, payload) => ({ engine, payload, simulation: true, observedAt: new Date(NOW).toISOString() });
test('identify runs mock only, returns versioned evidence and no live confirmation', async (t) => { const { gateway, provider, store } = setup(t); const r = await gateway.execute('owner', 'identify', identify()); assert.equal(r.provider, 'simulated'); assert.equal(r.version, 1); assert.equal(r.assessment.candidates[0].identity.product, 'probable'); assert.equal(r.assessment.eligibleOffers.length, 0); assert.equal(provider.calls, 1); assert.equal(store.stats().reserved, 1); });
test('compare requires an established scoped identifier and explicit owner confirmation', () => {
    for (const req of [compare({ confirmedByOwner: false }), compare({ product: { name: 'generic headphones' } }), compare({ confirmedByOwner: true, product: { identifiers: [{ scheme: 'sku', namespace: 'shop', value: 'X' }] } })])
        assert.throws(() => validate(req, 'compare'), failed('INVALID_REQUEST'));
});
test('comparison uses bounded Shopping plus Immersive and preserves indexed installments', async (t) => { const { gateway, provider } = setup(t); const r = await gateway.execute('owner', 'compare', compare()); assert.equal(provider.calls, 2); assert.equal(r.assessment.eligibleOffers.length, 0); const prices = r.assessment.candidates.flatMap(c => c.offers.flatMap(o => o.prices)); assert.ok(prices.some(p => p.role === 'installment' && p.amount?.value.minorUnits === 2739)); assert.ok(prices.some(p => p.role === 'reported_total' && p.amount?.value.minorUnits === 27999 && p.basis === 'unknown')); assert.ok(r.assessment.rejectedOffers.some(o => o.reasons.some(r => r.code === 'OUT_OF_STOCK'))); });
test('operation call cap prevents a second mock call', async (t) => { const { gateway, provider } = setup(t, { gateway: { maxCompareCalls: 1 } }); await gateway.execute('owner', 'compare', compare()); assert.equal(provider.calls, 1); });
test('request parameter injection and unrecognized endpoint fields fail closed', () => {
    for (const req of [identify({ endpoint: 'https://evil.example' }), identify({ api_key: 'fake-secret' }), identify({ product: { name: 'x', engine: 'google' } }), identify({ product: { name: 'x', provenance: { kind: 'store_page' } } })])
        assert.throws(() => validate(req, 'identify'), failed('INVALID_REQUEST'));
});
for (const originalUrl of ['https://127.0.0.1/x', 'http://shop.example', 'javascript:alert(1)', 'https://u:p@shop.example/x', 'https://shop.example:444/x', 'https://shop.example/?api_key=fake'])
    test(`input URL rejected without fetch: ${originalUrl.split(':')[0]}`, () => { assert.throws(() => validate(identify({ product: { originalUrl } }), 'identify'), failed('INVALID_REQUEST')); });
test('arbitrary public product URL is data only; no host is selected for network', () => { const req = validate(identify({ product: { originalUrl: 'https://unknown-shop.example/product' } }), 'identify'); assert.equal(req.product.originalUrl, 'https://unknown-shop.example/product'); const descriptor = serpDescriptor('google', 'x&api_key=attacker'); const u = new URL(descriptor.url); assert.equal(u.hostname, 'serpapi.com'); assert.equal(u.searchParams.get('api_key'), null); assert.equal(u.searchParams.get('q'), 'x&api_key=attacker'); assert.equal(descriptor.enabled, false); assert.equal(descriptor.redirect, 'error'); });
test('unsupported engine cannot create a network descriptor', () => assert.throws(() => serpDescriptor('https://evil.example', 'x'), failed('INVALID_REQUEST')));
test('contract rejects malformed data, oversized strings, polluted keys and invalid GTIN', () => {
    for (const data of [null, [], identify({ version: 2 }), identify({ product: { name: 'a'.repeat(513) } }), identify({ product: { identifiers: [{ scheme: 'gtin', value: '4006381333932' }] } }), JSON.parse('{"version":1,"requestId":"r","product":{"__proto__":{"x":1}}}')])
        assert.throws(() => validate(data, 'identify'), failed('INVALID_REQUEST'));
});
test('getters are never executed during request validation', () => { let touched = false; const req = {}; Object.defineProperty(req, 'product', { enumerable: true, get() { touched = true; throw Error('bad'); } }); assert.throws(() => validate(req, 'identify')); assert.equal(touched, false); });
test('cache fingerprint separates operation, owner, variant, essential URL parameters and confirmation', () => {
    const a = validate(compare(), 'compare');
    const key = fingerprint(a, 'owner');
    for (const b of [{ ...a, operation: 'identify' }, { ...a, product: { ...a.product, color: 'red' } }, { ...a, product: { ...a.product, quantity: 2 } }, { ...a, product: { ...a.product, originalUrl: 'https://shop.example/?seller_id=2' } }])
        assert.notEqual(fingerprint(b, 'owner'), key);
    assert.notEqual(fingerprint(a, 'other'), key);
    const changedId = { ...a, requestId: 'another' };
    assert.equal(fingerprint(changedId, 'owner'), key);
});
for (const engine of ['google', 'google_shopping', 'google_immersive_product'])
    test(`adapter ${engine} preserves search-index provenance`, () => { const r = adapt(wrapped(engine, fixtures[engine])); assert.ok(r.length); const json = JSON.stringify(r); assert.equal(json.includes('store_page'), false); assert.equal(json.includes('synthetic-fixture-token'), false); assert.ok(json.includes('search_index')); });
test('Search adapter extracts scoped ASIN and keeps name-only partial data', () => { const r = adapt(wrapped('google', fixtures.google)); assert.equal(r[0].product.identifiers[0].scheme, 'asin'); assert.equal(r[0].product.identifiers[0].evidence.value, 'B0GRWJ9QBR'); const p = adapt(wrapped('google', { organic_results: [{ title: 'Partial' }] })); assert.equal(p[0].product.fields.image, undefined); });
test('Shopping adapter handles inline and categorized layouts without copying wanted model', () => { const r = adapt(wrapped('google_shopping', { inline_shopping_results: [{ title: 'Shirt', extensions: ['Cor: Preto', 'Tamanho: BR:M', 'Quantidade: 2'], price: 'R$ 99,90 no PIX' }], categorized_shopping_results: [{ shopping_results: [{ title: 'Unknown variant' }] }] })); assert.equal(r.length, 2); assert.equal(r[0].product.fields.size.value, 'BR:M'); assert.equal(r[0].product.fields.quantity.value, 2); assert.equal(r[0].offers[0].prices[0].role, 'pix'); assert.equal(r[0].offers[0].prices[0].amount.value.minorUnits, 9990); assert.equal(r[1].product.fields.model, undefined); });
test('Immersive adapter preserves original-listing distinction and never turns total into cash', () => { const r = adapt(wrapped('google_immersive_product', fixtures.google_immersive_product)); const ml = r[0].offers[0]; assert.ok(ml.product.identifiers.some(i => i.scheme === 'listing' && i.evidence.value === 'MLB3923893355')); assert.equal(ml.prices.find(p => p.role === 'reported_total').basis, 'unknown'); assert.equal(ml.prices.some(p => p.role === 'cash'), false); assert.equal(ml.product.fields.seller, undefined); });
test('adapters preserve coupon and percentage text without computing a final price', () => { const r = adapt(wrapped('google_shopping', { shopping_results: [{ title: 'Product', price: 'R$ 100,00', coupon: 'SAVE15', discount: '15%' }] })); const p = r[0].offers[0].prices[0]; assert.equal(p.amount.value.minorUnits, 10000); assert.equal(p.couponCode.value, 'SAVE15'); assert.equal(p.basis, 'unknown'); assert.equal(p.role, 'advertised'); });
test('adapters do not infer BRL from region or numeric extracted_price', () => { const r = adapt(wrapped('google_shopping', { shopping_results: [{ title: 'Foreign product', price: '$ 10.00', extracted_price: 10 }] })); assert.equal(r[0].offers[0].prices[0].amount, undefined); });
test('adapter drops raw metadata/keys, redacts known test secrets and unsafe token URLs', () => { const r = adapt(wrapped('google', { api_key: 'fake-secret', search_metadata: { json_endpoint: 'https://secret.example/?api_key=fake-secret' }, organic_results: [{ title: 'Product fake-secret', link: 'https://shop.example/?api_key=fake-secret' }] }), ['fake-secret']); const s = JSON.stringify(r); assert.equal(s.includes('fake-secret'), false); assert.equal(s.includes('api_key'), false); assert.equal(r[0].product.fields.originalUrl, undefined); });
for (const bad of [{ organic_results: {} }, { organic_results: [null] }, { organic_results: [{ title: {} }] }, { organic_results: [{ title: 'x'.repeat(4097) }] }])
    test('invalid Search provider structure fails closed', () => assert.throws(() => adapt(wrapped('google', bad)), failed('INVALID_PROVIDER_DATA')));
test('invalid Shopping numeric field and contradictory stock do not become trusted', () => { assert.throws(() => adapt(wrapped('google_shopping', { shopping_results: [{ title: 'x', extracted_price: '9' }] })), failed('INVALID_PROVIDER_DATA')); const r = adapt(wrapped('google_immersive_product', { product_results: { title: 'x', stores: [{ title: 'x', details_and_offers: ['Em estoque on-line', 'Esgotado on-line'] }] } })); assert.equal(r[0].offers[0].availability, undefined); });
test('cache marks every evidence as cache without changing observed time', () => { const r = adapt(wrapped('google', fixtures.google)); const before = r[0].product.fields.name.provenance.observedAt; const c = cachedCandidates(r); assert.equal(c[0].product.fields.name.provenance.kind, 'cache'); assert.equal(c[0].product.fields.name.provenance.cachedFrom, 'search_index'); assert.equal(c[0].product.fields.name.provenance.observedAt, before); assert.equal(r[0].product.fields.name.provenance.kind, 'search_index'); });
test('budget starts fail-closed until a simulated free snapshot is provided', t => { const s = new GatewayStore(); t.after(() => s.close()); assert.throws(() => s.reserve('x', NOW), failed('BUDGET_STALE')); assert.throws(() => s.reconcile(snap({ free: false }), NOW), failed('BUDGET_STALE')); });
test('fifty-credit reserve and lower operation ceiling stop spending', t => { const s = new GatewayStore(); t.after(() => s.close()); s.reconcile(snap({ remaining: 51, used: 199 }), NOW); const id = s.reserve('one', NOW); s.finish(id, 'settled'); assert.throws(() => s.reserve('two', NOW), failed('BUDGET_EXHAUSTED')); });
test('cycle cap remains after failure/timeout/cancellation reservations', t => { const { store } = setup(t, {}, { cycle: 2, hour: 40, entries: 128, cacheBytes: 2000000 }); store.finish(store.reserve('one', NOW), 'uncertain'); store.finish(store.reserve('two', NOW), 'settled'); assert.throws(() => store.reserve('three', NOW), failed('BUDGET_EXHAUSTED')); assert.equal(store.stats().reserved, 2); });
test('hourly ceiling is global and cannot reset by changing query', t => {
    const { store } = setup(t);
    for (let i = 0; i < 40; i++)
        store.finish(store.reserve(`k${i}`, NOW), 'settled');
    assert.throws(() => store.reserve('new', NOW), failed('RATE_LIMITED'));
});
test('stale snapshot and local calendar cannot renew a cycle', t => { const { store } = setup(t); assert.throws(() => store.reserve('late', NOW + 3600001), failed('BUDGET_STALE')); assert.throws(() => store.reconcile(snap({ cycleId: 'mock-fake-renew' }), NOW), failed('BUDGET_INCONSISTENT')); });
test('unexpected outside usage blocks until explicitly acknowledged by operator', t => { const { store } = setup(t); assert.throws(() => store.reconcile(snap({ used: 16, remaining: 234 }), NOW), failed('BUDGET_INCONSISTENT')); assert.throws(() => store.reserve('blocked', NOW), failed('BUDGET_INCONSISTENT')); store.reconcile(snap({ used: 16, remaining: 234 }), NOW, 2); assert.equal(store.stats().blocked, false); });
test('provider cycle changes only with a fresh new-period snapshot after old end', t => { const { store } = setup(t); const later = NOW + 31 * 86400000; store.reconcile(snap({ cycleId: 'mock-new-cycle', startsAt: later - 1000, renewsAt: later + 30 * 86400000, observedAt: later, used: 0, remaining: 250 }), later); assert.equal(store.stats().reserved, 0); store.reserve('new', later); });
test('equivalent concurrent requests reserve one execution and share the result', async (t) => { const { gateway, provider, store } = setup(t, { provider: { delayMs: 20 } }); const requests = Array.from({ length: 8 }, () => gateway.execute('owner', 'identify', identify())); const results = await Promise.all(requests); assert.equal(results.length, 8); assert.equal(provider.calls, 1); assert.equal(store.stats().reserved, 1); });
test('cache hit avoids provider and preserves cache/index distinction', async (t) => { const { gateway, provider } = setup(t); await gateway.execute('owner', 'identify', identify()); const r = await gateway.execute('owner', 'identify', identify()); assert.equal(r.cache, 'hit'); assert.equal(provider.calls, 1); assert.equal(r.assessment.candidates[0].inputEvidence.fields.name.provenance.kind, 'cache'); });
test('different authenticated owners cannot share private cache or flight', async (t) => { const { gateway, provider } = setup(t); await gateway.execute('owner', 'identify', identify()); await gateway.execute('other-owner', 'identify', identify()); assert.equal(provider.calls, 2); });
test('same request id with conflicting content is rejected while running', async (t) => { const { gateway } = setup(t, { provider: { delayMs: 25 } }); const request = identify({ requestId: 'same' }); const first = gateway.execute('owner', 'identify', request); await assert.rejects(gateway.execute('owner', 'identify', identify({ requestId: 'same', product: { name: 'different' } })), failed('REQUEST_CONFLICT')); await first; });
test('one cancelled subscriber does not cancel the other waiter', async (t) => { const { gateway, provider, store } = setup(t, { provider: { delayMs: 30 } }); const a = new AbortController(); const first = gateway.execute('owner', 'identify', identify(), a.signal); const second = gateway.execute('owner', 'identify', identify()); a.abort(); await assert.rejects(first, failed('CANCELLED')); await second; assert.equal(provider.calls, 1); assert.equal(store.stats().reserved, 1); });
test('last cancellation keeps reserved credit and releases in-flight state', async (t) => { const { gateway, provider, store } = setup(t, { provider: { delayMs: 50 } }); const controller = new AbortController(); const pending = gateway.execute('owner', 'identify', identify(), controller.signal); await delay(10); controller.abort(); await assert.rejects(pending, failed('CANCELLED')); await delay(5); assert.equal(store.stats().reserved, 1); await gateway.execute('owner', 'identify', identify()); assert.equal(provider.calls, 2); });
for (const mode of ['failure', 'timeout'])
    test(`mock ${mode} retains reservation and returns sanitized structured error`, async (t) => { const { gateway, store } = setup(t, { provider: { mode }, gateway: { callMs: 15 } }); await assert.rejects(gateway.execute('owner', 'identify', identify()), failed(mode === 'timeout' ? 'TIMEOUT' : 'UNAVAILABLE')); assert.equal(store.stats().reserved, 1); assert.equal(store.stats().uncertain, 1); });
test('global deadline does not get extended by provider calls', async (t) => { const { gateway, store } = setup(t, { provider: { delayMs: 50 }, gateway: { compareMs: 15, callMs: 1000 } }); await assert.rejects(gateway.execute('owner', 'compare', compare()), failed('TIMEOUT')); assert.equal(store.stats().reserved, 1); });
test('partial mock data returns manual fallback without inventing missing facts', async (t) => { const { gateway } = setup(t, { provider: { mode: 'partial' } }); const r = await gateway.execute('owner', 'identify', identify()); assert.equal(r.partial, true); assert.equal(r.assessment.candidates[0].inputEvidence.fields.image, undefined); assert.equal(r.assessment.eligibleOffers.length, 0); });
test('store rejects paths that could open the Wish production database', () => { assert.throws(() => new GatewayStore('wish.db'), failed('UNAVAILABLE')); assert.throws(() => new GatewayStore('D:/Projetos/Wish/wish.gateway.sqlite'), failed('UNAVAILABLE')); });
test('persistent cache, budget and sessions survive restart without refunding pending work', async () => {
    const root = resolve('.expo/search-gateway/tests');
    mkdirSync(root, { recursive: true });
    const file = resolve(root, `${randomUUID()}.gateway.sqlite`);
    let store = new GatewayStore(file);
    store.reconcile(snap(), NOW);
    const token = store.issueSession('owner', NOW);
    const p = new MockProvider({ clock: () => NOW });
    let gateway = new SearchGateway(store, p, { clock: () => NOW });
    await gateway.execute('owner', 'identify', identify());
    store.reserve('crashed', NOW);
    store.close();
    store = new GatewayStore(file);
    try {
        store.recoverPending();
        gateway = new SearchGateway(store, new MockProvider({ clock: () => NOW }), { clock: () => NOW });
        const result = await gateway.execute('owner', 'identify', identify());
        assert.equal(result.cache, 'hit');
        assert.equal(store.stats().reserved, 2);
        assert.equal(store.stats().uncertain, 1);
        assert.equal(store.authenticate(`Bearer ${token}`, NOW), 'owner');
    }
    finally {
        store.close();
    }
});
test('SQLite transaction prevents two worker connections from overspending one slot', async () => {
    const root = resolve('.expo/search-gateway/tests');
    mkdirSync(root, { recursive: true });
    const file = resolve(root, `${randomUUID()}.gateway.sqlite`);
    const store = new GatewayStore(file, { cycle: 1, hour: 40, entries: 128, cacheBytes: 2000000 });
    store.reconcile(snap(), NOW);
    try {
        const run = () => new Promise((done, reject) => { const worker = new Worker(new URL('./budget-worker.mjs', import.meta.url), { workerData: { file, now: NOW } }); worker.once('message', done); worker.once('error', reject); });
        const values = await Promise.all([run(), run()]);
        assert.equal(values.filter(v => v === 'reserved').length, 1);
        assert.equal(store.stats().reserved, 1);
    }
    finally {
        store.close();
    }
});
test('cache expiration differs for identity and commercial data and invalidation is controlled', t => { const { store } = setup(t); store.cachePut('k', 'owner', [], NOW, 1000, 100); assert.ok(store.cacheGet('k', 'owner', NOW + 99, 'compare')); assert.equal(store.cacheGet('k', 'owner', NOW + 101, 'compare'), null); assert.equal(store.cacheGet('k', 'owner', NOW + 101, 'identify').commercialFresh, false); assert.equal(store.cacheGet('k', 'other', NOW, 'identify'), null); store.invalidate('k', 'other'); assert.ok(store.cacheGet('k', 'owner', NOW, 'identify')); store.invalidate('k', 'owner'); assert.equal(store.cacheGet('k', 'owner', NOW, 'identify'), null); store.cachePut('k', 'owner', [], NOW, 1000, 100); assert.equal(store.cacheGet('k', 'owner', NOW + 1001, 'identify'), null); });
test('cache storage count is bounded and oversized entries are refused', t => { const { store } = setup(t, {}, { cycle: 200, hour: 40, entries: 1, cacheBytes: 2000000 }); store.cachePut('first', 'owner', [], NOW); store.cachePut('second', 'owner', [], NOW + 1); assert.equal(store.cacheGet('first', 'owner', NOW + 2, 'identify'), null); assert.throws(() => store.cachePut('huge', 'owner', 'x'.repeat(200001), NOW), failed('INVALID_PROVIDER_DATA')); });
test('session expiry, revocation, malformed auth and excessive sessions are enforced', t => { const { store } = setup(t); const token = store.issueSession('owner', NOW, 100); assert.equal(store.authenticate(`Bearer ${token}`, NOW), 'owner'); assert.throws(() => store.authenticate(`Bearer ${token}`, NOW + 100), failed('UNAUTHORIZED')); store.revoke(token); assert.throws(() => store.authenticate(`Bearer ${token}`, NOW), failed('UNAUTHORIZED')); assert.throws(() => store.authenticate('Bearer fake', NOW), failed('UNAUTHORIZED')); });
test('request rate limiter is persistent and rejects bursts', t => { const { store } = setup(t); store.rate('owner', NOW, 2); store.rate('owner', NOW, 2); assert.throws(() => store.rate('owner', NOW, 2), failed('RATE_LIMITED')); store.rate('owner', NOW + 60001, 2); });
test('non-simulated provider cannot be enabled through dependency injection', t => { const { store } = setup(t); assert.throws(() => new SearchGateway(store, { kind: 'serpapi', search: async () => { throw Error('must not run'); } }), failed('UNAVAILABLE')); });
async function serve(t, options = {}) { const state = setup(t, options); const token = state.store.issueSession('owner', NOW); const events = []; const server = localServer(state.store, state.gateway, e => events.push(e)); await new Promise(resolve => server.listen({ host: '127.0.0.1', port: 0 }, resolve)); t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); })); const url = `http://127.0.0.1:${server.address().port}`; const post = async (path, data, headers = {}) => { const response = await fetch(url + path, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...headers }, body: typeof data === 'string' ? data : JSON.stringify(data) }); return { status: response.status, data: await response.json() }; }; return { ...state, server, url, token, post, events }; }
test('HTTP listens only on loopback and accepts authenticated versioned requests', async (t) => { const { server, post } = await serve(t); assert.equal(server.address().address, '127.0.0.1'); const r = await post('/v1/identify', identify()); assert.equal(r.status, 200); assert.equal(r.data.provider, 'simulated'); });
test('unauthorized HTTP cannot obtain cache or reserve credits', async (t) => { const { post, store } = await serve(t); await post('/v1/identify', identify()); const before = store.stats().reserved; const r = await post('/v1/identify', identify(), { authorization: 'Bearer invalid' }); assert.equal(r.status, 401); assert.equal(store.stats().reserved, before); assert.equal(r.data.assessment, undefined); });
test('HTTP rejects cross-origin, rebinding Host and arbitrary absolute request paths', async (t) => { const { post, url, token } = await serve(t); assert.equal((await post('/v1/identify', identify(), { origin: 'https://evil.example' })).status, 401); assert.equal(await new Promise((resolve, reject) => { const r = rawHttpRequest(url + '/v1/identify', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', host: 'evil.example' } }, response => { response.resume(); response.on('end', () => resolve(response.statusCode)); }); r.on('error', reject); r.end(JSON.stringify(identify())); }), 401); assert.equal((await post('/proxy?url=https://evil.example', identify())).status, 400); });
test('HTTP payload and malformed JSON limits produce structured errors', async (t) => { const { post } = await serve(t); const huge = await post('/v1/identify', 'x'.repeat(32769)); assert.equal(huge.status, 413); assert.equal(huge.data.error.code, 'TOO_LARGE'); assert.equal((await post('/v1/identify', '{bad')).status, 400); assert.equal((await post('/v1/identify', identify(), { 'content-type': 'text/plain' })).status, 400); });
test('HTTP provider failure and telemetry cannot expose tokens/internal errors', async (t) => { const { post, token, events } = await serve(t, { provider: { mode: 'failure' } }); const r = await post('/v1/identify', identify()); assert.equal(r.status, 503); const data = JSON.stringify({ body: r.data, events }); assert.equal(data.includes(token), false); assert.equal(data.includes('private provider'), false); assert.ok(events.every(e => Object.keys(e).sort().join(',') === 'elapsedMs,event,status')); });
test('HTTP cancellation affects only authorized request and retains budget', async (t) => { const { post, gateway, store } = await serve(t, { provider: { delayMs: 100 } }); const req = identify({ requestId: 'cancel-http' }); const pending = post('/v1/identify', req); await delay(25); assert.equal(gateway.cancel('different-owner', 'cancel-http'), false); const cancelled = await post('/v1/cancel', { version: 1, requestId: 'cancel-http' }); assert.equal(cancelled.data.cancelled, true); assert.equal((await pending).data.error.code, 'CANCELLED'); assert.equal(store.stats().reserved, 1); });
test('network test preloader denies external fetch without sending a packet', async () => { await assert.rejects(fetch('https://serpapi.com/search.json?engine=google&q=DO_NOT_SEND'), /OFFLINE_EXTERNAL_NETWORK_DENIED/u); });
test('numeric/textual price contradictions are retained as conflicting facts, never resolved by minimum', () => {
    const r = adapt(wrapped('google_shopping', { shopping_results: [{ title: 'Conflict fixture', price: 'R$ 100,00', extracted_price: 1 }] }));
    assert.deepEqual(r[0].offers[0].prices.map(p => p.amount.value.minorUnits), [100, 10000]);
    assert.ok(r[0].offers[0].prices.every(p => p.basis === 'unknown'));
});
test('Google catalog URL is not mislabeled as the merchant store', () => {
    const r = adapt(wrapped('google_shopping', { shopping_results: [{ title: 'Fixture', product_link: 'https://www.google.com.br/search?q=x', source: 'kalunga.com.br' }] }));
    assert.equal(r[0].product.fields.store.value, 'kalunga.com.br');
});
test('HTTP revoked session cannot retrieve a cached result', async (t) => {
    const { post, store, token } = await serve(t);
    await post('/v1/identify', identify());
    store.revoke(token);
    const r = await post('/v1/identify', identify());
    assert.equal(r.status, 401);
    assert.equal(r.data.assessment, undefined);
});
test('same logical id cancellation cancels every equivalent subscriber', async (t) => {
    const { gateway, provider } = setup(t, { provider: { delayMs: 100 } });
    const req = identify({ requestId: 'same-cancel' });
    const a = gateway.execute('owner', 'identify', req), b = gateway.execute('owner', 'identify', req);
    await delay(15);
    assert.equal(gateway.cancel('owner', 'same-cancel'), true);
    const values = await Promise.allSettled([a, b]);
    assert.ok(values.every(v => v.status === 'rejected' && v.reason.code === 'CANCELLED'));
    assert.equal(provider.calls, 1);
    await delay(5);
});
test('failure of details retains valid Shopping candidates and warns without a retry', async (t) => {
    const { store } = setup(t);
    const mock = new MockProvider({ clock: () => NOW });
    let calls = 0;
    const provider = { kind: 'simulated', async search(engine, query, signal) {
            calls++;
            if (engine === 'google_immersive_product')
                throw Error('private simulated failure');
            return mock.search(engine, query, signal);
        } };
    const gateway = new SearchGateway(store, provider, { clock: () => NOW });
    const r = await gateway.execute('owner', 'compare', compare());
    assert.ok(r.assessment.candidates.length);
    assert.equal(r.partial, true);
    assert.deepEqual(r.warnings, ['DETAILS_UNAVAILABLE']);
    assert.equal(calls, 2);
    assert.equal(store.stats().uncertain, 1);
    const cached = await gateway.execute('owner', 'compare', compare());
    assert.equal(cached.cache, 'hit');
    assert.deepEqual(cached.warnings, ['DETAILS_UNAVAILABLE']);
    assert.equal(calls, 2);
});
test('HTTP exhausted mock budget returns 429 and manual fallback without provider execution', async (t) => {
    const { post, store, provider } = await serve(t);
    store.reconcile(snap({ used: 200, remaining: 50 }), NOW, 186);
    const r = await post('/v1/identify', identify());
    assert.equal(r.status, 429);
    assert.equal(r.data.error.code, 'BUDGET_EXHAUSTED');
    assert.equal(r.data.error.manualAvailable, true);
    assert.equal(provider.calls, 0);
});
test('test guard blocks public binds, UDP, DNS and TLS without external access', async () => {
    const net = await import('node:net');
    const dns = await import('node:dns');
    const dgram = await import('node:dgram');
    const tls = await import('node:tls');
    assert.throws(() => net.createServer().listen({ port: 0, host: '0.0.0.0' }), /OFFLINE_EXTERNAL_NETWORK_DENIED/u);
    assert.throws(() => dgram.createSocket('udp4'), /OFFLINE_EXTERNAL_NETWORK_DENIED/u);
    assert.throws(() => dns.resolve4('example.com'), /OFFLINE_EXTERNAL_NETWORK_DENIED/u);
    assert.throws(() => tls.connect({ host: 'example.com', port: 443 }), /OFFLINE_EXTERNAL_NETWORK_DENIED/u);
});
test('explicit GTIN and store SKU labels retain separate namespaces', () => {
    const r = adapt(wrapped('google_shopping', { shopping_results: [{ title: 'Synthetic container', link: 'https://shop.example/product', extensions: ['GTIN: 4006381333931', 'SKU: ABC-1'] }] }));
    assert.ok(r[0].product.identifiers.some(i => i.scheme === 'gtin' && i.namespace === undefined));
    assert.ok(r[0].product.identifiers.some(i => i.scheme === 'sku' && i.namespace === 'shop.example'));
});
test('indexed incompatible model is rejected by the unchanged confidence engine', async (t) => {
    const { gateway } = setup(t, { provider: { payloads: { google_shopping: { shopping_results: [{ title: 'HyperX Cloud III', brand: 'HyperX', extensions: ['Modelo: 727A8AA'], price: 'R$ 1,00' }] } } } });
    const request = compare({ product: { brand: 'HyperX', model: '727A9AA', identifiers: [{ scheme: 'mpn', namespace: 'hyperx', value: '727A9AA' }] } });
    const r = await gateway.execute('owner', 'compare', request);
    assert.equal(r.assessment.candidates[0].identity.product, 'incompatible');
    assert.equal(r.assessment.rejectedOffers.length, 1);
    assert.equal(r.assessment.eligibleOffers.length, 0);
});
test('session issuance is bounded without publishing any session token', t => {
    const { store } = setup(t);
    for (let i = 0; i < 32; i++)
        store.issueSession('owner', NOW);
    assert.throws(() => store.issueSession('owner', NOW), failed('UNAVAILABLE'));
});
test('default documentary fixtures retain day precision instead of claiming a fresh store observation', async () => {
    const mock = new MockProvider({ clock: () => NOW + 1000000 });
    const r = await mock.search('google', 'fixture', new AbortController().signal);
    assert.equal(r.observedAt, '2026-11-21T00:00:00Z');
    const data = adapt(r);
    assert.equal(data[0].product.fields.name.provenance.timePrecision, 'day');
    assert.equal(data[0].product.fields.name.provenance.kind, 'search_index');
});
