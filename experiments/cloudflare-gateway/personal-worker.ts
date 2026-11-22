import { ControlQueue } from './control-queue.ts';
import { operatorFixture } from './operator-fixtures.ts';
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
    queue = new ControlQueue();
    denied = new Set<string>();
    usedInterrupts = new Set<string>();
    preflights = 0;
    adminPreflights = 0;
    controlPreflights = 0;
    active?: {
        device: string;
        id: string;
        request: Request;
        cancelled: boolean;
    };
    constructor(state: State, env: PersonalEnvironment) { super(state, env); this.auth = new PersonalAuth(this.store, env); }
    requestLimit() { return 4096; }
    beforeProviderCall() {
        if (!this.active || this.active.cancelled)
            throw new GatewayError('CANCELLED');
        if (this.denied.has(this.active.device))
            throw new GatewayError('UNAUTHORIZED');
        this.auth.session(this.active.request);
    }
    interrupt(device: string, id?: string) {
        const current = this.active;
        if (!current || current.device !== device || (id !== undefined && current.id !== id))
            return false;
        current.cancelled = true;
        this.gateway.cancel('personal-owner', current.id);
        return true;
    }
    async fetch(request: Request): Promise<Response> {
        let admin = false, counted = false, control = false, claimedNonce = false, nonce: string | undefined;
        try {
            if (!equal(request.headers.get('x-internal') ?? '', this.env.INTERNAL_TOKEN))
                throw new GatewayError('UNAUTHORIZED');
            const url = new URL(request.url), path = url.pathname;
            if (request.method !== 'POST' || url.hostname !== 'coordinator' || url.search || request.headers.has('origin') || ![...paths, '/operator/approve', '/operator/revoke', '/operator/recover', '/operator/reconcile', '/operator/status', '/operator/test'].includes(path))
                throw new GatewayError('INVALID_REQUEST');
            control = path === '/v1/cancel';
            admin = path.startsWith('/operator/');
            if (admin)
                this.auth.operator(request);
            if ((admin ? this.adminPreflights : control ? this.controlPreflights : this.preflights) >= (admin ? 2 : control ? 4 : 16))
                throw new GatewayError('RATE_LIMITED');
            if (admin)
                this.adminPreflights++;
            else if (control)
                this.controlPreflights++;
            else
                this.preflights++;
            counted = true;
            const input = await read(request);
            if (path === '/operator/test') {
                if (this.env.TEST_CONTROLS !== 'yes')
                    throw new GatewayError('INVALID_REQUEST');
                const fixture = object(input, ['action']);
                // Deliberate lab-only diagnostics/release; no authorization transition or provider call.
                if (fixture.action === 'peek')
                    return response({ active: this.active ? { device: this.active.device, id: this.active.id, cancelled: this.active.cancelled } : null, waiting: this.queue.normal.length, controlWaiting: this.queue.control.length, stats: this.store.stats() });
                if (fixture.action === 'release') {
                    this.releaseGate();
                    return response({ ok: true });
                }
            }
            let urgent = false, advisory = false;
            if (path === '/operator/revoke') {
                const x = object(input, ['deviceId']);
                if (typeof x.deviceId !== 'string' || !this.store.q('SELECT 1 FROM a_device WHERE id=?', x.deviceId).length)
                    throw new GatewayError('INVALID_REQUEST');
                this.denied.add(x.deviceId);
                this.interrupt(x.deviceId);
                urgent = true;
            }
            else if (path === '/v1/cancel') {
                const x = object(input, ['requestId']);
                if (typeof x.requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/u.test(x.requestId))
                    throw new GatewayError('INVALID_REQUEST');
                const session = await this.auth.inspectProof(request, input, path);
                if (this.denied.has(String(session.device)))
                    throw new GatewayError('UNAUTHORIZED');
                nonce = request.headers.get('x-wish-nonce')!;
                if (this.usedInterrupts.has(nonce) || this.usedInterrupts.size >= 4)
                    throw new GatewayError('RATE_LIMITED');
                this.usedInterrupts.add(nonce);
                claimedNonce = true;
                advisory = this.interrupt(String(session.device), x.requestId);
                urgent = true;
            }
            return await this.queue.submit(() => this.perform(request, path, input, advisory), urgent);
        }
        catch (e) {
            return failure(e);
        }
        finally {
            if (nonce && claimedNonce)
                this.usedInterrupts.delete(nonce);
            if (counted) {
                if (admin)
                    this.adminPreflights--;
                else if (control)
                    this.controlPreflights--;
                else
                    this.preflights--;
            }
        }
    }
    async perform(request: Request, path: string, input: unknown, advisory: boolean): Promise<Response> {
        let entered = false;
        try {
            if (!equal(request.headers.get('x-internal') ?? '', this.env.INTERNAL_TOKEN))
                throw new GatewayError('UNAUTHORIZED');
            const operator = path.startsWith('/operator/');
            if (operator)
                this.auth.operator(request);
            else if (!['/auth/pair/start', '/auth/pair/complete', '/auth/device/challenge', '/auth/device/complete'].includes(path)) {
                const s = this.auth.session(request);
                if (this.denied.has(String(s.device)))
                    throw new GatewayError('UNAUTHORIZED');
            }
            // No provider call, session issue or sensitive response without independent local witness.
            await this.auth.fence('begin');
            entered = true;
            this.auth.compact();
            if (['/auth/pair/complete', '/auth/device/challenge', '/auth/device/complete'].includes(path) && input && typeof input === 'object' && 'deviceId' in input && typeof input.deviceId === 'string' && this.denied.has(input.deviceId))
                throw new GatewayError('UNAUTHORIZED');
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
                    if (this.env.TEST_CONTROLS !== 'yes')
                        throw new GatewayError('INVALID_REQUEST');
                    result = operatorFixture(this.store, object(input, ['action']).action);
                    break;
                }
                default: {
                    if (!['/v1/identify', '/v1/compare', '/v1/cancel'].includes(path))
                        throw new GatewayError('INVALID_REQUEST');
                    const session = await this.auth.proof(request, input, path);
                    if (this.denied.has(String(session.device)))
                        throw new GatewayError('UNAUTHORIZED');
                    if (path === '/v1/cancel') {
                        result = { cancelled: advisory };
                        break;
                    }
                    const requestId = (input as {
                        requestId?: unknown;
                    }).requestId;
                    if (typeof requestId !== 'string')
                        throw new GatewayError('INVALID_REQUEST');
                    this.active = { device: String(session.device), id: requestId, request, cancelled: false };
                    let drained = false;
                    try {
                        // Legacy authorization is private internal adaptation, never accepted from a device.
                        this.env.SESSIONS = JSON.stringify([{ hash: hash(this.env.INTERNAL_TOKEN), owner: 'personal-owner', expires: Date.now() + 300000 }]);
                        const forwarded = new Request('http://coordinator' + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-internal': this.env.INTERNAL_TOKEN, authorization: 'Bearer ' + this.env.INTERNAL_TOKEN }, body: JSON.stringify(input) });
                        const out = await super.fetch(forwarded);
                        await this.gateway.drain();
                        drained = true;
                        if (this.denied.has(String(session.device)))
                            throw new GatewayError('UNAUTHORIZED');
                        if (this.active.cancelled)
                            throw new GatewayError('CANCELLED');
                        this.auth.session(request);
                        this.auth.compact();
                        await this.store.barrier();
                        await this.auth.fence('end');
                        entered = false;
                        if (this.denied.has(String(session.device)))
                            throw new GatewayError('UNAUTHORIZED');
                        if (this.active.cancelled)
                            throw new GatewayError('CANCELLED');
                        this.auth.session(request);
                        return out;
                    }
                    finally {
                        if (!drained)
                            await this.gateway.drain();
                        this.active = undefined;
                    }
                }
            }
            await this.store.barrier();
            await this.auth.fence('end');
            entered = false;
            if (result && typeof result === 'object' && 'sessionId' in result && typeof result.sessionId === 'string') {
                const issued = this.store.q('SELECT device FROM a_session WHERE id=?', result.sessionId)[0];
                if (!issued || this.denied.has(String(issued.device)))
                    throw new GatewayError('UNAUTHORIZED');
            }
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
    }
}
