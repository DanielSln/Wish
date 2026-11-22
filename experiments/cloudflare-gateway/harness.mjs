import { Miniflare, Log, LogLevel } from './.tools/node_modules/miniflare/dist/src/index.js';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
export const ACCOUNT = 'simulated-serpapi-account-global-v1';
export const hash = s => createHash('sha256').update(s).digest('hex');
export async function runtime(options = {}) {
    const token = options.token ?? randomBytes(32).toString('hex');
    const otherToken = options.otherToken ?? randomBytes(32).toString('hex');
    const internal = options.internal ?? randomBytes(32).toString('hex');
    const now = Date.now();
    const snapshot = options.snapshot ?? { simulation: true, free: true, cycleId: 'mock-local', startsAt: now - 1000, renewsAt: now + 86400000, observedAt: now, remaining: 236, used: 14, monthlyLimit: 250 };
    const sessions = options.sessions ?? [{ hash: hash(token), owner: 'owner', expires: now + 3500000 }, { hash: hash(otherToken), owner: 'other-owner', expires: now + 3500000 }];
    const persist = options.persist ?? fileURLToPath(new URL('./.local/state/' + randomBytes(12).toString('hex'), import.meta.url));
    await mkdir(persist, { recursive: true });
    let outbound = 0;
    const started = performance.now();
    const mf = new Miniflare({
        name: 'wish-local-only', host: '127.0.0.1', port: 0, cf: false, log: new Log(LogLevel.ERROR), ...(options.inspect ? { inspectorPort: 0, inspectorHost: '127.0.0.1' } : {}),
        compatibilityDate: '2026-07-30', compatibilityFlags: ['nodejs_compat'], modules: true,
        script: await readFile(new URL(options.personal ? './.local/personal.mjs' : './.local/worker.mjs', import.meta.url), 'utf8'),
        durableObjects: { COORDINATOR: { className: options.personal ? 'PersonalCoordinator' : 'AccountCoordinator', useSQLite: true } }, durableObjectsPersist: persist,
        serviceBindings: options.serviceBindings,
        bindings: { ...options.bindings, LOCAL_TEST_ONLY: 'yes', INTERNAL_TOKEN: internal, SESSIONS: JSON.stringify(sessions), SNAPSHOT: JSON.stringify(snapshot), MOCK_MODE: options.mode ?? 'fast', ...(options.gate ? { MOCK_WAIT_GATE: 'yes' } : {}), ...(options.payloads ? { MOCK_PAYLOADS: JSON.stringify(options.payloads) } : {}), ...(options.detailsFailure ? { MOCK_DETAILS_FAILURE: 'yes' } : {}) },
        outboundService: () => { outbound++; return new Response('OUTBOUND_DISABLED', { status: 403 }); },
    });
    try {
        await mf.ready;
    }
    catch (e) {
        await mf.dispose();
        throw e;
    }
    const startupMs = performance.now() - started;
    const namespace = await mf.getDurableObjectNamespace('COORDINATOR');
    const stub = namespace.get(namespace.idFromName(ACCOUNT));
    const call = async (body, path = '/v1/identify', credential = token, headers = {}) => {
        const res = await mf.dispatchFetch('http://127.0.0.1' + path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + credential, ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
        return { status: res.status, headers: res.headers, data: await res.json() };
    };
    const control = async (action, value) => {
        const res = await stub.fetch('http://coordinator/__test', { method: 'POST', headers: { 'content-type': 'application/json', 'x-internal': internal }, body: JSON.stringify({ action, ...(value === undefined ? {} : { value }) }) });
        return { status: res.status, data: await res.json() };
    };
    return { mf, call, control, token, otherToken, internal, snapshot, persist, startupMs, outbound: () => outbound, close: () => mf.dispose() };
}
export function identify(id = 'req', name = 'HyperX Cloud Earbuds II') { return { version: 1, requestId: id, product: { name } }; }
export function compare(id = 'req') { return { version: 1, requestId: id, confirmedByOwner: true, product: { name: 'HyperX Cloud Earbuds II', brand: 'HyperX', model: '70N24AA', identifiers: [{ scheme: 'mpn', namespace: 'hyperx', value: '70N24AA' }] } }; }
