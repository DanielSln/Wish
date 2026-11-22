import { AccountCoordinator } from './worker.ts';
import { read, response, failure } from './boundary.ts';
import { PersonalAuth, equal, hash, object, type PersonalEnvironment } from './personal-auth.ts';
import type { State } from './runtime.ts';
import { GatewayError } from '../search-gateway/contracts.ts';
const paths = ['/auth/pair/start', '/auth/pair/complete', '/auth/device/challenge', '/auth/device/complete', '/auth/challenge', '/auth/renew', '/v1/identify', '/v1/compare', '/v1/cancel'];
export default {
    async fetch(request: Request, env: PersonalEnvironment) {
        try {
            const url = new URL(request.url);
            if (env.LOCAL_TEST_ONLY !== 'yes' || url.hostname !== '127.0.0.1' || request.headers.has('origin') || request.method !== 'POST' || url.search || !paths.includes(url.pathname))
                throw new GatewayError('INVALID_REQUEST');
            const input = await read(request);
            const headers = new Headers(request.headers);
            headers.set('x-internal', env.INTERNAL_TOKEN);
            headers.delete('x-operator');
            return await env.COORDINATOR.get(env.COORDINATOR.idFromName('simulated-serpapi-account-global-v1')).fetch(new Request('http://coordinator' + url.pathname, { method: 'POST', headers, body: JSON.stringify(input) }));
        }
        catch (e) {
            return failure(e);
        }
    },
};
export class PersonalCoordinator extends AccountCoordinator {
    auth: PersonalAuth;
    tail: Promise<void> = Promise.resolve();
    queued = 0;
    constructor(state: State, env: PersonalEnvironment) { super(state, env); this.auth = new PersonalAuth(this.store, env); }
    requestLimit() { return 4096; }
    async fetch(request: Request): Promise<Response> {
        // All auth transitions and search operations are serialized; SQL alone cannot fence across awaits.
        if (this.queued >= 16)
            return failure(new GatewayError('RATE_LIMITED'));
        this.queued++;
        const previous = this.tail;
        let release!: () => void;
        this.tail = new Promise<void>(r => { release = r; });
        await previous;
        let entered = false;
        try {
            if (!equal(request.headers.get('x-internal') ?? '', this.env.INTERNAL_TOKEN))
                throw new GatewayError('UNAUTHORIZED');
            const path = new URL(request.url).pathname, input = await read(request);
            const operator = path.startsWith('/operator/');
            if (operator)
                this.auth.operator(request);
            else if (!['/auth/pair/start', '/auth/pair/complete', '/auth/device/challenge', '/auth/device/complete'].includes(path))
                this.auth.session(request);
            // No provider call, session issue or sensitive response without independent local witness.
            await this.auth.fence('begin');
            entered = true;
            this.auth.compact();
            let result: unknown;
            switch (path) {
                case '/auth/pair/start':
                    result = await this.auth.start(input);
                    break;
                case '/auth/pair/complete':
                    result = await this.auth.pair(input);
                    break;
                case '/auth/device/challenge':
                    result = this.auth.deviceChallenge(input);
                    break;
                case '/auth/device/complete':
                    result = await this.auth.deviceComplete(input);
                    break;
                case '/auth/challenge':
                    result = this.auth.challenge(request, input);
                    break;
                case '/auth/renew': {
                    object(input, []);
                    const session = await this.auth.proof(request, input, path);
                    this.store.q('UPDATE a_session SET revoked=1 WHERE id=?', session.id);
                    result = this.auth.issue(String(session.device));
                    break;
                }
                case '/operator/approve':
                    result = this.auth.approve(input);
                    break;
                case '/operator/revoke':
                    result = this.auth.revoke(input);
                    break;
                case '/operator/recover':
                    result = this.auth.recover(input);
                    break;
                case '/operator/reconcile': {
                    object(input, []);
                    result = { decision: 'retained-no-retry', release: false, externalEvidenceRequired: true, uncertain: this.store.q("SELECT id,state FROM c_reservation WHERE state='uncertain'") };
                    break;
                }
                case '/operator/status': {
                    object(input, []);
                    result = { ...this.store.stats(), sequence: Number(this.auth.meta('sequence')), retainedResults: Number(this.store.q("SELECT count(*) n FROM c_request WHERE state='done'")[0].n), tombstones: Number(this.store.q("SELECT count(*) n FROM c_request WHERE state='tombstone'")[0].n) };
                    break;
                }
                case '/operator/test': {
                    const x = object(input, ['action']);
                    if (x.action === 'expire-pairs')
                        this.store.q('UPDATE a_device SET expires=0');
                    else if (x.action === 'expire-nonces')
                        this.store.q('UPDATE a_nonce SET expires=0');
                    else if (x.action === 'cap-requests')
                        this.store.q("WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<4095) INSERT OR IGNORE INTO c_request SELECT 'fixture-'||x,'fixture-key','tombstone',NULL FROM n");
                    else if (x.action === 'expire-sessions')
                        this.store.q('UPDATE a_session SET expires=0');
                    else if (x.action === 'age-results')
                        this.store.q("UPDATE c_request SET data=json_set(data,'$.queriedAt',?) WHERE state='done'", new Date(Date.now() - 900001).toISOString());
                    else if (x.action === 'fault')
                        this.store.fault = 'sync';
                    else
                        throw new GatewayError('INVALID_REQUEST');
                    result = { ok: true };
                    break;
                }
                default: {
                    if (!['/v1/identify', '/v1/compare', '/v1/cancel'].includes(path))
                        throw new GatewayError('INVALID_REQUEST');
                    await this.auth.proof(request, input, path);
                    // Legacy authorization is private internal adaptation, never accepted from a device.
                    this.env.SESSIONS = JSON.stringify([{ hash: hash(this.env.INTERNAL_TOKEN), owner: 'personal-owner', expires: Date.now() + 300000 }]);
                    const forwarded = new Request('http://coordinator' + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-internal': this.env.INTERNAL_TOKEN, authorization: 'Bearer ' + this.env.INTERNAL_TOKEN }, body: JSON.stringify(input) });
                    const out = await super.fetch(forwarded);
                    this.auth.compact();
                    await this.store.barrier();
                    await this.auth.fence('end');
                    entered = false;
                    return out;
                }
            }
            await this.store.barrier();
            await this.auth.fence('end');
            entered = false;
            return response(result);
        }
        catch (e) {
            if (entered) {
                try {
                    await this.auth.fence('end');
                }
                catch {
                    return failure(new GatewayError('UNAVAILABLE'));
                }
            }
            return failure(e);
        }
        finally {
            this.queued--;
            release();
        }
    }
}
