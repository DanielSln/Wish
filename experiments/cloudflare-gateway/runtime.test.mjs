import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { runtime, identify, compare, hash } from './harness.mjs';
const timings = [];
async function setup(t, opts = {}) {
    const r = await runtime(opts);
    timings.push(r.startupMs);
    t.after(async () => { assert.equal(r.outbound(), 0, 'No attempted outbound HTTP'); await r.close(); });
    return r;
}
const stats = async (r) => (await r.control('stats')).data;
const expected = async (p, status, error) => {
    const r = await p;
    assert.equal(r.status, status, JSON.stringify(r.data));
    if (error)
        assert.equal(r.data.error, error);
    return r;
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
test('Worker -> same account SQLite DO -> real adapters and confidence, reservation before mock', async (t) => {
    const r = await setup(t);
    const out = await expected(r.call(identify()), 200);
    assert.equal(out.data.provider, 'simulated');
    assert.equal(out.data.assessment.eligibleOffers.length, 0);
    assert.equal(out.headers.get('cache-control'), 'no-store');
    const s = await stats(r);
    assert.equal(s.reserved, 1);
    assert.equal(s.calls, 1);
    assert.equal(s.unreservedCalls, 0);
    assert.equal(s.pending, 0);
    assert.ok(s.reads > 0 && s.writes > 0);
});
test('experimental bearer absent or wrong is refused before SQLite calls', async (t) => {
    const r = await setup(t);
    await expected(r.call(identify(), undefined, 'bad'), 401, 'UNAUTHORIZED');
    assert.equal((await stats(r)).calls, 0);
});
for (const kind of ['expired', 'revoked'])
    test('session ' + kind + ' denied', async (t) => {
        const token = randomBytes(32).toString('hex');
        const r = await setup(t, { token, sessions: [{ hash: hash(token), owner: 'owner', expires: kind === 'expired' ? Date.now() - 1 : Date.now() + 100000, revoked: kind === 'revoked' }] });
        await expected(r.call(identify()), 401, 'UNAUTHORIZED');
    });
test('local revocation denies an otherwise valid session', async (t) => { const r = await setup(t); await expected(r.call(identify()), 200); await r.control('revoke'); await expected(r.call(identify('next')), 401, 'UNAUTHORIZED'); });
for (const data of [null, [], { version: 2, requestId: 'bad', product: { name: 'x' } }, { version: 1, requestId: 'bad', product: { name: 'x', engine: 'google' } }, { version: 1, requestId: 'bad', product: { name: 'x' }, endpoint: 'https://evil.example' }, { version: 1, requestId: 'bad', product: { name: 'x'.repeat(513) } }])
    test('invalid input ' + JSON.stringify(data).slice(0, 75), async (t) => { const r = await setup(t); await expected(r.call(data), 400, 'INVALID_REQUEST'); assert.equal((await stats(r)).calls, 0); });
for (const url of ['https://127.0.0.1/private', 'http://store.example/x', 'https://user:password@store.example/x', 'https://store.example/?api_key=not-real', 'https://169.254.169.254/latest'])
    test('SSRF data validation ' + url.split('/')[2], async (t) => { const r = await setup(t); await expected(r.call({ version: 1, requestId: 'ssrf', product: { originalUrl: url } }), 400, 'INVALID_REQUEST'); });
test('public original URL is text only; no external request', async (t) => { const r = await setup(t); await expected(r.call({ version: 1, requestId: 'text-url', product: { originalUrl: 'https://www.amazon.com.br/dp/B0GRWJ9QBR' } }), 200); assert.equal(r.outbound(), 0); });
test('fixed endpoints, origins, content-type and body size', async (t) => {
    const r = await setup(t);
    await expected(r.call(identify(), '/__test'), 400, 'INVALID_REQUEST');
    await expected(r.call(identify(), '/v1/identify?target=https://evil.example'), 400, 'INVALID_REQUEST');
    await expected(r.call(identify(), undefined, undefined, { origin: 'https://evil.example' }), 400, 'INVALID_REQUEST');
    await expected(r.call(identify(), undefined, undefined, { 'content-type': 'text/plain' }), 400, 'INVALID_REQUEST');
    await expected(r.call('x'.repeat(40000)), 413, 'TOO_LARGE');
    await expected(r.call('{'), 400, 'INVALID_REQUEST');
    assert.equal((await stats(r)).calls, 0);
});
test('concurrent devices same owner and different request IDs deduplicate to one reservation', async (t) => {
    const r = await setup(t, { mode: 'slow' });
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => r.call(identify('dedup-' + i))));
    assert.ok(results.every(x => x.status === 200));
    assert.equal((await stats(r)).calls, 1);
    assert.equal((await stats(r)).reserved, 1);
});
test('private caches and shared account budget across distinct owners', async (t) => {
    const r = await setup(t);
    await expected(r.call(identify('owner-a')), 200);
    await expected(r.call(identify('owner-b'), undefined, r.otherToken), 200);
    assert.equal((await stats(r)).reserved, 2);
    assert.equal((await stats(r)).calls, 2);
    const hit = await expected(r.call(identify('owner-a-again')), 200);
    assert.equal(hit.data.cache, 'hit');
    assert.equal((await stats(r)).calls, 2);
});
test('replay returns persisted result, conflicting same ID rejected', async (t) => {
    const r = await setup(t);
    const first = await expected(r.call(identify('same')), 200);
    const replay = await expected(r.call(identify('same')), 200);
    assert.deepEqual(replay.data, first.data);
    await expected(r.call(identify('same', 'Different item')), 409, 'REQUEST_CONFLICT');
    assert.equal((await stats(r)).calls, 1);
});
test('stale snapshot blocks fresh calls, without refreshing calendar locally', async (t) => { const r = await setup(t); await r.control('stale'); await expected(r.call(identify()), 503, 'BUDGET_STALE'); assert.equal((await stats(r)).calls, 0); });
test('snapshot replay persistently blocks account', async (t) => { const r = await setup(t); await expected(r.control('snapshot', r.snapshot), 503, 'BUDGET_INCONSISTENT'); await expected(r.call(identify()), 503, 'BUDGET_INCONSISTENT'); assert.equal((await stats(r)).calls, 0); });
test('inconsistent new provider usage blocks, consistent new snapshot permitted', async (t) => {
    const r = await setup(t);
    await expected(r.call(identify()), 200);
    await pause(10);
    await expected(r.control('snapshot', { ...r.snapshot, observedAt: Date.now(), used: 15, remaining: 235 }), 200);
    await pause(10);
    await expected(r.control('snapshot', { ...r.snapshot, observedAt: Date.now(), used: 16, remaining: 234 }), 503, 'BUDGET_INCONSISTENT');
    await expected(r.call(identify('other', 'Another item')), 503, 'BUDGET_INCONSISTENT');
    assert.equal((await stats(r)).calls, 1);
});
test('concurrent distinct clients cannot spend fifty retained credits', async (t) => {
    const now = Date.now();
    const r = await setup(t, { mode: 'slow', snapshot: { simulation: true, free: true, cycleId: 'mock-small', startsAt: now - 1000, renewsAt: now + 86400000, observedAt: now, remaining: 52, used: 198, monthlyLimit: 250 } });
    const out = await Promise.all(Array.from({ length: 8 }, (_, i) => r.call(identify('budget-' + i, 'Different product ' + i), undefined, i % 2 ? r.otherToken : r.token)));
    assert.equal(out.filter(x => x.status === 200).length, 2);
    assert.equal(out.filter(x => x.data.error === 'BUDGET_EXHAUSTED').length, 6);
    assert.equal((await stats(r)).calls, 2);
});
test('global 40/hour remains shared across five owners', async (t) => {
    const tokens = Array.from({ length: 5 }, () => randomBytes(32).toString('hex'));
    const sessions = tokens.map((token, i) => ({ hash: hash(token), owner: 'owner-' + i, expires: Date.now() + 3000000 }));
    const r = await setup(t, { sessions });
    for (let i = 0; i < 40; i++)
        await expected(r.call(identify('hour-' + i, 'Item ' + i), undefined, tokens[i % 5]), 200);
    await expected(r.call(identify('hour-41', 'Item 41'), undefined, tokens[0]), 429, 'RATE_LIMITED');
    assert.equal((await stats(r)).reserved, 40);
});
for (const fault of ['reserve', 'sync', 'finish'])
    test('storage ' + fault + ' fault fails closed and never releases reservations', async (t) => {
        const r = await runtime();
        let closed = false;
        t.after(async () => {
            if (!closed)
                await r.close();
        });
        await r.control('fault', fault);
        await expected(r.call(identify('failure')), 503, 'UNAVAILABLE');
        await expected(r.call(identify('failure2', 'Different')), 503, 'UNAVAILABLE');
        await r.close();
        closed = true;
        const reopened = await setup(t, { persist: r.persist, token: r.token, otherToken: r.otherToken, internal: r.internal, snapshot: r.snapshot });
        const s = await stats(reopened);
        assert.equal(s.calls, fault === 'finish' ? 1 : 0);
        assert.equal(s.reserved, fault === 'reserve' ? 0 : 1);
        assert.equal(s.uncertain, fault === 'reserve' ? 0 : 1);
        await expected(reopened.call(identify('failure')), 503, 'BUDGET_INCONSISTENT');
    });
test('actual SQL table failure returns sanitized closed errors without calls', async (t) => { const r = await setup(t); await r.control('corrupt'); const out = await expected(r.call(identify()), 503, 'UNAVAILABLE'); assert.deepEqual(out.data, { error: 'UNAVAILABLE', simulation: true }); await expected(r.call(identify('new')), 503, 'UNAVAILABLE'); });
test('runtime restart persists result/cache/budget instead of reseeding', async (t) => {
    const r = await runtime();
    await expected(r.call(identify('before-restart')), 200);
    await r.close();
    const reopened = await setup(t, { persist: r.persist, token: r.token, otherToken: r.otherToken, internal: r.internal, snapshot: r.snapshot });
    await expected(reopened.call(identify('before-restart')), 200);
    const hit = await expected(reopened.call(identify('after-restart')), 200);
    assert.equal(hit.data.cache, 'hit');
    assert.equal((await stats(reopened)).calls, 1);
    assert.equal((await stats(reopened)).reserved, 1);
});
test('pending reservation becomes uncertain across actual simulator restart', async (t) => {
    const r = await runtime();
    await expected(r.control('seed-pending'), 200);
    assert.equal((await stats(r)).pending, 1);
    await r.close();
    const reopened = await setup(t, { persist: r.persist, snapshot: r.snapshot });
    assert.equal((await stats(reopened)).uncertain, 1);
    assert.equal((await stats(reopened)).pending, 0);
    assert.equal((await stats(reopened)).reserved, 1);
});
test('timeout is charged experimentally and persisted as uncertain; replay never retries', async (t) => {
    const r = await setup(t, { mode: 'timeout' });
    await expected(r.call(identify('timeout')), 504, 'TIMEOUT');
    await expected(r.call(identify('timeout')), 504, 'TIMEOUT');
    const s = await stats(r);
    assert.equal(s.calls, 1);
    assert.equal(s.reserved, 1);
    assert.equal(s.uncertain, 1);
});
test('explicit cancellation is scoped to authenticated owner', async (t) => {
    const r = await setup(t, { gate: true });
    const pending = r.call(identify('cancel-me'));
    for (let i = 0; i < 30; i++) {
        if ((await stats(r)).calls)
            break;
        await pause(2);
    }
    const denied = await expected(r.call({ requestId: 'cancel-me' }, '/v1/cancel', r.otherToken), 200);
    assert.equal(denied.data.cancelled, false);
    const cancelled = await expected(r.call({ requestId: 'cancel-me' }, '/v1/cancel'), 200);
    assert.equal(cancelled.data.cancelled, true);
    await expected(pending, 409, 'CANCELLED');
    await pause(10);
    assert.equal((await stats(r)).uncertain, 1);
});
test('comparison reuses both adapters, preserving installments and commercially inconsistent totals', async (t) => {
    const r = await setup(t);
    const out = await expected(r.call(compare(), '/v1/compare'), 200);
    assert.equal((await stats(r)).calls, 2);
    assert.equal(out.data.assessment.eligibleOffers.length, 0);
    const prices = out.data.assessment.candidates.flatMap(c => c.offers.flatMap(o => o.prices));
    assert.ok(prices.some(p => p.role === 'installment' && p.amount.value.minorUnits === 2739));
    assert.ok(prices.some(p => p.role === 'reported_total' && p.amount.value.minorUnits === 27999 && p.basis === 'unknown'));
    assert.ok(out.data.assessment.rejectedOffers.some(o => o.reasons.some(x => x.code === 'OUT_OF_STOCK')));
});
test('Immersive failure yields partial indexed result without retry or credit refund', async (t) => { const r = await setup(t, { detailsFailure: true }); const out = await expected(r.call(compare(), '/v1/compare'), 200); assert.equal(out.data.partial, true); assert.deepEqual(out.data.warnings, ['DETAILS_UNAVAILABLE']); const s = await stats(r); assert.equal(s.calls, 2); assert.equal(s.uncertain, 1); });
test('wrong explicit model is not adopted as an exact product', async (t) => {
    const r = await setup(t, { payloads: { google: { organic_results: [{ title: 'Different product', model: 'WRONG', link: 'https://www.amazon.com.br/dp/B012345678' }] } } });
    const input = identify();
    input.product.model = '70N24AA';
    input.product.identifiers = [{ scheme: 'asin', namespace: 'amazon.com.br', value: 'B0GRWJ9QBR' }];
    const out = await expected(r.call(input), 200);
    assert.notEqual(out.data.assessment.candidates[0].identity.product, 'exact');
    assert.equal(out.data.assessment.eligibleOffers.length, 0);
    assert.equal(out.data.assessment.manualRequired, true);
});
test('large provider payload is rejected after one reserved call, never cached', async (t) => { const r = await setup(t, { payloads: { google: { organic_results: [{ title: 'x'.repeat(200000) }] } } }); await expected(r.call(identify()), 502, 'INVALID_PROVIDER_DATA'); assert.equal((await stats(r)).reserved, 1); assert.equal((await stats(r)).uncertain, 1); });
test('large bounded normalized response either succeeds within cap or fails explicitly', async (t) => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ title: 'Headphones ' + i, link: 'https://www.amazon.com.br/dp/B012345678', snippet: 'Description '.repeat(50) }));
    const r = await setup(t, { payloads: { google: { organic_results: rows } } });
    const out = await expected(r.call(identify()), 200);
    assert.equal(out.data.assessment.candidates.length, 20);
    assert.ok(Buffer.byteLength(JSON.stringify(out.data)) < 200000);
});
test('write local startup summary (not Cloudflare CPU or isolate memory)', async () => {
    await writeFile(new URL('./.local/startup-measurements.json', import.meta.url), JSON.stringify({ runtimes: timings.length, startupMinMs: Math.min(...timings), startupMaxMs: Math.max(...timings), startupMeanMs: timings.reduce((a, b) => a + b, 0) / timings.length, nodeHarnessRssBytes: process.memoryUsage().rss, warning: 'Node RSS is not Worker/DO memory; startup includes Miniflare/IPC/SQLite, not isolate init CPU.' }, null, 2));
});
test('cycle-wide 200 cap remains enforced separately from retained balance and hour', async (t) => {
    const now = Date.now();
    const r = await setup(t, { snapshot: { simulation: true, free: true, cycleId: 'mock-cycle-cap', startsAt: now - 7200000, renewsAt: now + 86400000, observedAt: now, remaining: 250, used: 0, monthlyLimit: 250 } });
    await expected(r.control('seed-cycle-count'), 200);
    await expected(r.call(identify('last-allowed')), 200);
    await expected(r.call(identify('over-cycle', 'Another item')), 429, 'BUDGET_EXHAUSTED');
    assert.equal((await stats(r)).reserved, 200);
    assert.equal((await stats(r)).calls, 1);
});
test('cache storage evicts before its entry and byte caps', async (t) => { const r = await setup(t); await expected(r.control('seed-cache'), 200); const s = await stats(r); assert.ok(s.cacheEntries <= 128 && s.cacheEntries > 0); assert.ok(s.cacheBytes <= 2000000 && s.cacheBytes > 0); assert.equal(s.calls, 0); });
test('old persisted replay cannot claim a commercially fresh result or trigger a new query', async (t) => { const r = await setup(t); await expected(r.call(identify('old-replay')), 200); await expected(r.control('age-replay'), 200); await expected(r.call(identify('old-replay')), 503, 'BUDGET_STALE'); assert.equal((await stats(r)).calls, 1); });
test('corrupted persistent schema is refused after restart instead of recreating empty budget tables', async (t) => {
    const r = await runtime();
    await expected(r.call(identify('before-corruption')), 200);
    await expected(r.control('corrupt'), 200);
    await r.close();
    const reopened = await setup(t, { persist: r.persist, snapshot: r.snapshot });
    await expected(reopened.call(identify('after-corruption')), 503, 'UNAVAILABLE');
});
test('cancelling one deduplicated waiter preserves another consumer and its single reservation', async (t) => {
    const r = await setup(t, { gate: true });
    const first = r.call(identify('waiter-1'));
    const second = r.call(identify('waiter-2'));
    for (let i = 0; i < 30; i++) {
        if ((await stats(r)).requests === 2)
            break;
        await pause(2);
    }
    await expected(r.call({ requestId: 'waiter-1' }, '/v1/cancel'), 200);
    await expected(first, 409, 'CANCELLED');
    await expected(r.control('release'), 200);
    await expected(second, 200);
    assert.equal((await stats(r)).reserved, 1);
    assert.equal((await stats(r)).calls, 1);
    assert.equal((await stats(r)).uncertain, 0);
});
test('native Worker fetch is intercepted and denied before any external transport', async (t) => {
    const r = await runtime();
    t.after(() => r.close());
    const namespace = await r.mf.getDurableObjectNamespace('COORDINATOR');
    const stub = namespace.get(namespace.idFromName('simulated-serpapi-account-global-v1'));
    const out = await stub.fetch('http://coordinator/__egress-probe', { headers: { 'x-internal': r.internal } });
    assert.equal(out.status, 200);
    assert.equal((await out.json()).status, 403);
    assert.equal(r.outbound(), 1);
    assert.equal((await stats(r)).calls, 0);
});
