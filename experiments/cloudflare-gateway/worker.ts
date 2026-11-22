import { createHash } from 'node:crypto';
import { SearchGateway } from '../search-gateway/gateway.ts';
import { MockProvider } from '../search-gateway/provider.ts';
import { fingerprint, validate } from '../search-gateway/validation.ts';
import { GatewayError, STATUS, type Snapshot, type GatewayResponse, type ErrorCode } from '../search-gateway/contracts.ts';
import { DurableStore } from './store.ts';
import type { Environment, State, Session } from './runtime.ts';
const ACCOUNT_COORDINATOR = 'simulated-serpapi-account-global-v1';
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
function constant(a: string, b: string) {
    if (a.length !== b.length)
        return false;
    let n = 0;
    for (let i = 0; i < a.length; i++)
        n |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return n === 0;
}
function authorized(request: Request, env: Environment): string {
    if (env.LOCAL_TEST_ONLY !== 'yes' || !/^[a-f0-9]{64}$/u.test(env.INTERNAL_TOKEN))
        throw new GatewayError('UNAVAILABLE');
    const header = request.headers.get('authorization');
    if (!header || !/^Bearer [a-f0-9]{64}$/u.test(header))
        throw new GatewayError('UNAUTHORIZED');
    const hash = digest(header.slice(7));
    const sessions = JSON.parse(env.SESSIONS) as Session[];
    const s = sessions.find(s => constant(s.hash, hash) && !s.revoked && s.expires > Date.now() && s.expires <= Date.now() + 3600000 && /^[a-zA-Z0-9_-]{1,64}$/u.test(s.owner));
    if (!s)
        throw new GatewayError('UNAUTHORIZED');
    return s.owner;
}
function response(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } }); }
function failure(e: unknown) { const code = e instanceof GatewayError ? e.code : 'UNAVAILABLE'; return response({ error: code, simulation: true }, STATUS[code]); }
async function read(request: Request): Promise<unknown> {
    if (request.headers.get('content-type') !== 'application/json')
        throw new GatewayError('INVALID_REQUEST');
    if (Number(request.headers.get('content-length') ?? 0) > 32768)
        throw new GatewayError('TOO_LARGE');
    const reader = request.body?.getReader();
    if (!reader)
        throw new GatewayError('INVALID_REQUEST');
    const parts: Uint8Array[] = [];
    let bytes = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([(async () => {
                for (;;) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    bytes += value.length;
                    if (bytes > 32768)
                        throw new GatewayError('TOO_LARGE');
                    parts.push(value);
                }
                const all = new Uint8Array(bytes);
                let at = 0;
                for (const p of parts) {
                    all.set(p, at);
                    at += p.length;
                }
                try {
                    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(all)) as unknown;
                }
                catch {
                    throw new GatewayError('INVALID_REQUEST');
                }
            })(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new GatewayError('TIMEOUT')), 2000); })]);
    }
    finally {
        clearTimeout(timer);
        void reader.cancel().catch(() => { });
    }
}
/** No deployment manifest. Ingress is meaningful only in the isolated harness. */
export default {
    async fetch(request: Request, env: Environment): Promise<Response> {
        try {
            const url = new URL(request.url);
            if (url.hostname !== '127.0.0.1' || request.headers.has('origin') || request.method !== 'POST' || !['/v1/identify', '/v1/compare', '/v1/cancel'].includes(url.pathname) || url.search)
                throw new GatewayError('INVALID_REQUEST');
            authorized(request, env);
            const data = await read(request);
            const forwarded = new Request('http://coordinator' + url.pathname, { method: 'POST', headers: { 'content-type': 'application/json', authorization: request.headers.get('authorization')!, 'x-internal': env.INTERNAL_TOKEN }, body: JSON.stringify(data) });
            return await env.COORDINATOR.get(env.COORDINATOR.idFromName(ACCOUNT_COORDINATOR)).fetch(forwarded);
        }
        catch (e) {
            return failure(e);
        }
    },
};
export class AccountCoordinator {
    env: Environment;
    store: DurableStore;
    gateway: SearchGateway;
    releaseGate: () => void;
    constructor(state: State, env: Environment) {
        if (env.LOCAL_TEST_ONLY !== 'yes')
            throw new GatewayError('UNAVAILABLE');
        this.env = env;
        this.store = new DurableStore(state.storage, JSON.parse(env.SNAPSHOT) as Snapshot);
        const mock = new MockProvider({ mode: env.MOCK_MODE, delayMs: env.MOCK_MODE === 'slow' ? 100 : 1, ...(env.MOCK_PAYLOADS ? { payloads: JSON.parse(env.MOCK_PAYLOADS) } : {}) });
        const store = this.store;
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        this.releaseGate = release;
        this.gateway = new SearchGateway(store, {
            kind: 'simulated',
            async search(engine, query, signal) {
                // SQL transaction alone is insufficient: flush the reservation before the simulated side effect.
                await store.barrier();
                if (signal.aborted)
                    throw new GatewayError('CANCELLED');
                const pending = store.q("SELECT r.id FROM c_reservation r LEFT JOIN c_calls c ON c.id=r.id WHERE r.state='pending' AND c.id IS NULL ORDER BY r.at,r.id LIMIT 1")[0];
                if (!pending)
                    throw new GatewayError('UNAVAILABLE');
                store.q('INSERT INTO c_calls VALUES(?,?)', pending.id, 1);
                if (env.MOCK_WAIT_GATE === 'yes') {
                    await new Promise<void>((resolve, reject) => {
                        const abort = () => reject(new GatewayError('CANCELLED'));
                        signal.addEventListener('abort', abort, { once: true });
                        gate.then(() => { signal.removeEventListener('abort', abort); if (signal.aborted)
                            abort();
                        else
                            resolve(); });
                    });
                }
                if (env.MOCK_DETAILS_FAILURE === 'yes' && engine === 'google_immersive_product')
                    throw new GatewayError('UNAVAILABLE');
                return mock.search(engine, query, signal);
            },
        }, { callMs: env.MOCK_MODE === 'timeout' ? 50 : 2000 });
    }
    async fetch(request: Request): Promise<Response> {
        try {
            if (!constant(request.headers.get('x-internal') ?? '', this.env.INTERNAL_TOKEN))
                throw new GatewayError('UNAUTHORIZED');
            const path = new URL(request.url).pathname;
            if (path === '/__egress-probe') {
                const blocked = await fetch('https://outbound-denied.invalid');
                return response({ status: blocked.status });
            }
            // Test controls are not routed by the Worker; only accessible via local harness binding.
            if (path === '/__test')
                return this.control(await read(request));
            const owner = authorized(request, this.env);
            const input = await read(request);
            if (path === '/v1/cancel') {
                if (!input || typeof input !== 'object' || Object.keys(input).length !== 1 || !('requestId' in input) || typeof input.requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/u.test(input.requestId))
                    throw new GatewayError('INVALID_REQUEST');
                return response({ cancelled: this.gateway.cancel(owner, input.requestId) });
            }
            if (!['/v1/identify', '/v1/compare'].includes(path))
                throw new GatewayError('INVALID_REQUEST');
            const op = path === '/v1/identify' ? 'identify' : 'compare';
            const validated = validate(input, op), key = fingerprint(validated, owner), id = digest(owner + ':' + validated.requestId);
            const previous = this.store.q('SELECT * FROM c_request WHERE id=?', id)[0];
            if (previous) {
                if (previous.k !== key)
                    throw new GatewayError('REQUEST_CONFLICT');
                if (previous.state === 'done') {
                    const saved = JSON.parse(String(previous.data)) as GatewayResponse;
                    const age = Date.now() - Date.parse(saved.queriedAt);
                    if (!Number.isFinite(age) || age < 0 || age >= 900000)
                        throw new GatewayError('BUDGET_STALE');
                    return response(saved);
                }
                if (previous.state === 'failed')
                    throw new GatewayError(String(previous.data) as ErrorCode);
                // Never reissue an in-flight/uncertain request after crashes. Another client can use a new id for cache/singleflight.
                throw new GatewayError(previous.state === 'uncertain' ? 'BUDGET_INCONSISTENT' : 'REQUEST_CONFLICT');
            }
            if (Number(this.store.q('SELECT count(*) n FROM c_request')[0].n) >= 256)
                throw new GatewayError('RATE_LIMITED');
            this.store.q("INSERT INTO c_request VALUES(?,?,'pending',NULL)", id, key);
            try {
                const result: GatewayResponse = await this.gateway.execute(owner, op, input);
                const json = JSON.stringify(result);
                if (new TextEncoder().encode(json).length > 200000)
                    throw new GatewayError('INVALID_PROVIDER_DATA');
                this.store.q("UPDATE c_request SET state='done',data=? WHERE id=?", json, id);
                await this.store.barrier();
                return response(result);
            }
            catch (e) {
                if (!this.store.failed) {
                    this.store.q("UPDATE c_request SET state='failed',data=? WHERE id=?", e instanceof GatewayError ? e.code : 'UNAVAILABLE', id);
                    await this.store.barrier();
                }
                throw e;
            }
        }
        catch (e) {
            return failure(e);
        }
    }
    control(input: unknown): Response {
        if (!input || typeof input !== 'object' || !('action' in input))
            throw new GatewayError('INVALID_REQUEST');
        switch (input.action) {
            case 'release':
                this.releaseGate();
                return response({ ok: true });
            case 'stats': return response(this.store.stats());
            case 'snapshot':
                if ('value' in input)
                    this.store.reconcile(input.value as Snapshot, Date.now());
                return response({ ok: true });
            case 'stale':
                this.store.q('UPDATE c_cycle SET observed=?', Date.now() - 3600001);
                return response({ ok: true });
            case 'fault':
                if ('value' in input && ['reserve', 'sync', 'finish'].includes(String(input.value)))
                    this.store.fault = input.value as 'reserve' | 'sync' | 'finish';
                return response({ ok: true });
            case 'revoke':
                this.env.SESSIONS = JSON.stringify([]);
                return response({ ok: true });
            case 'age-replay':
                this.store.q("UPDATE c_request SET data=json_set(data,'$.queriedAt',?) WHERE state='done'", new Date(Date.now() - 900001).toISOString());
                return response({ ok: true });
            case 'seed-cycle-count':
                this.store.storage.transactionSync(() => {
                    for (let i = 0; i < 199; i++)
                        this.store.q("INSERT INTO c_reservation VALUES(?,?,?,?,'settled')", 'fixture-' + i, this.store.cycle()!.id, 'fixture-key-' + i, Date.now() - 3600001);
                });
                return response({ ok: true });
            case 'seed-cache':
                for (let i = 0; i < 129; i++)
                    this.store.cachePut('cache-fixture-' + i, 'fixture-owner', { text: 'x'.repeat(16000) }, Date.now());
                return response({ ok: true });
            case 'corrupt':
                this.store.q('DROP TABLE c_reservation');
                return response({ ok: true });
            case 'seed-pending': {
                const key = 'test-uncertain-key';
                this.store.reserve(key, Date.now());
                this.store.q("INSERT INTO c_request VALUES('test-pending',?,'pending',NULL)", key);
                return response({ ok: true });
            }
            default: throw new GatewayError('INVALID_REQUEST');
        }
    }
}
