import { createHash, timingSafeEqual } from 'node:crypto';
import { GatewayError } from '../search-gateway/contracts.ts';
import type { DurableStore } from './store.ts';
import type { Environment, Stub } from './runtime.ts';
export interface PersonalEnvironment extends Environment {
    WITNESS: Stub;
    LINEAGE: string;
    OPERATOR_HASH: string;
    RECOVERY_HASH: string;
    AUTH_SESSION_MS?: string;
    RESTORE_DECLARED?: string;
}
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function equal(a: string, b: string) { return /^[a-f0-9]{64}$/u.test(a) && /^[a-f0-9]{64}$/u.test(b) && timingSafeEqual(new TextEncoder().encode(a), new TextEncoder().encode(b)); }
export function random() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join(''); }
export function object(v: unknown, keys: string[]): Record<string, unknown> {
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !keys.includes(k)))
        throw new GatewayError('INVALID_REQUEST');
    return v as Record<string, unknown>;
}
function text(v: unknown, pattern: RegExp) {
    if (typeof v !== 'string' || !pattern.test(v))
        throw new GatewayError('INVALID_REQUEST');
    return v;
}
const ID = /^[a-f0-9-]{36}$/u, HEX = /^[a-f0-9]{64}$/u;
export const message = (session: string, nonce: string, path: string, bodyHash: string) => ['wish-personal-v1', 'request', session, nonce, 'POST', path, bodyHash].join(String.fromCharCode(10));
export class PersonalAuth {
    store: DurableStore;
    env: PersonalEnvironment;
    constructor(store: DurableStore, env: PersonalEnvironment) {
        this.store = store;
        this.env = env;
        const q = store.q.bind(store);
        const tables = q("SELECT name FROM sqlite_master WHERE type='table' AND name GLOB 'a_*'").map(r => r.name);
        const expected = ['a_meta', 'a_device', 'a_session', 'a_nonce'];
        if (tables.length && (tables.length !== expected.length || expected.some(n => !tables.includes(n))))
            throw new GatewayError('UNAVAILABLE');
        store.storage.transactionSync(() => {
            q('CREATE TABLE IF NOT EXISTS a_meta(k TEXT PRIMARY KEY,v TEXT)');
            q('CREATE TABLE IF NOT EXISTS a_device(id TEXT PRIMARY KEY,jwk TEXT,fingerprint TEXT,status TEXT,challenge TEXT,expires INTEGER)');
            q('CREATE TABLE IF NOT EXISTS a_session(id TEXT PRIMARY KEY,device TEXT,hash TEXT,expires INTEGER,revoked INTEGER)');
            q('CREATE TABLE IF NOT EXISTS a_nonce(hash TEXT PRIMARY KEY,session TEXT,path TEXT,body_hash TEXT,expires INTEGER)');
            const schema = q("SELECT v FROM a_meta WHERE k='schema'")[0];
            if (!schema) {
                if (tables.length)
                    throw new GatewayError('UNAVAILABLE');
                for (const [k, v] of Object.entries({ schema: '1', sequence: '0', inflight: '0', lineage: env.LINEAGE, operator: env.OPERATOR_HASH, recovery: env.RECOVERY_HASH }))
                    q('INSERT INTO a_meta VALUES(?,?)', k, v);
            }
            else if (schema.v !== '1' || this.meta('lineage') !== env.LINEAGE || this.meta('operator') !== env.OPERATOR_HASH)
                throw new GatewayError('UNAVAILABLE');
        });
    }
    meta(k: string) {
        const v = this.store.q('SELECT v FROM a_meta WHERE k=?', k)[0]?.v;
        if (typeof v !== 'string')
            throw new GatewayError('UNAVAILABLE');
        return v;
    }
    operator(request: Request) {
        const token = request.headers.get('x-operator') ?? '';
        if (!HEX.test(token) || !equal(hash(token), this.meta('operator')))
            throw new GatewayError('UNAUTHORIZED');
    }
    /** Witness CAS is independent of the DO backup. Lost acknowledgement is intentionally blocking. */
    async fence(phase: 'begin' | 'end') {
        if (this.env.RESTORE_DECLARED === 'yes')
            throw new GatewayError('BUDGET_INCONSISTENT');
        if (this.meta('inflight') !== (phase === 'begin' ? '0' : '1'))
            throw new GatewayError('BUDGET_INCONSISTENT');
        const sequence = Number(this.meta('sequence'));
        if (!Number.isSafeInteger(sequence) || sequence < 0)
            throw new GatewayError('UNAVAILABLE');
        let res: Response;
        try {
            res = await this.env.WITNESS.fetch(new Request('http://local-witness/advance', { method: 'POST', body: JSON.stringify({ lineage: this.env.LINEAGE, expected: sequence }) }));
        }
        catch {
            throw new GatewayError('UNAVAILABLE');
        }
        if (res.status !== 200)
            throw new GatewayError('BUDGET_INCONSISTENT');
        const answer = await res.json() as {
            sequence?: number;
        };
        if (answer.sequence !== sequence + 1)
            throw new GatewayError('BUDGET_INCONSISTENT');
        this.store.storage.transactionSync(() => { this.store.q("UPDATE a_meta SET v=? WHERE k='sequence'", String(answer.sequence)); this.store.q("UPDATE a_meta SET v=? WHERE k='inflight'", phase === 'begin' ? '1' : '0'); });
        await this.store.barrier();
    }
    async verify(jwk: string, sig: unknown, payload: string) {
        if (typeof sig !== 'string' || !/^[a-f0-9]{128}$/u.test(sig))
            throw new GatewayError('UNAUTHORIZED');
        try {
            const key = await crypto.subtle.importKey('jwk', JSON.parse(jwk), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
            const bytes = new Uint8Array(sig.match(/../gu)!.map(h => parseInt(h, 16)));
            if (!await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, bytes, new TextEncoder().encode(payload)))
                throw Error('Invalid proof');
        }
        catch {
            throw new GatewayError('UNAUTHORIZED');
        }
    }
    async start(input: unknown) {
        const x = object(input, ['publicKey', 'label']);
        const key = object(x.publicKey, ['kty', 'crv', 'x', 'y']);
        if (key.kty !== 'EC' || key.crv !== 'P-256' || typeof x.label !== 'string' || !x.label.trim() || x.label.length > 64 || /[\u0000-\u001f]/u.test(x.label))
            throw new GatewayError('INVALID_REQUEST');
        for (const coordinate of [key.x, key.y])
            if (typeof coordinate !== 'string' || !/^[A-Za-z0-9_-]{43}$/u.test(coordinate))
                throw new GatewayError('INVALID_REQUEST');
        try {
            await crypto.subtle.importKey('jwk', key as JsonWebKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
        }
        catch {
            throw new GatewayError('INVALID_REQUEST');
        }
        this.store.rate('personal-pair-global', Date.now(), 10);
        if (Number(this.store.q('SELECT count(*) n FROM a_device')[0].n) >= 32)
            throw new GatewayError('RATE_LIMITED');
        const jwk = JSON.stringify({ kty: 'EC', crv: 'P-256', x: key.x, y: key.y });
        const id = crypto.randomUUID(), challenge = random(), fingerprint = hash(jwk);
        this.store.q("INSERT INTO a_device VALUES(?,?,?,'pending',?,?)", id, jwk, fingerprint, hash(challenge), Date.now() + 120000);
        return { deviceId: id, challenge, fingerprint, expiresInSeconds: 120, label: x.label };
    }
    async pair(input: unknown) {
        this.store.rate('personal-complete-global', Date.now(), 20);
        const x = object(input, ['deviceId', 'challenge', 'signature']), id = text(x.deviceId, ID), challenge = text(x.challenge, HEX);
        const d = this.store.q('SELECT * FROM a_device WHERE id=?', id)[0];
        if (!d || d.status !== 'approved' || Number(d.expires) <= Date.now() || !equal(String(d.challenge), hash(challenge)))
            throw new GatewayError('UNAUTHORIZED');
        await this.verify(String(d.jwk), x.signature, ['wish-personal-v1', 'pair', id, challenge].join(String.fromCharCode(10)));
        this.store.q("UPDATE a_device SET challenge='',expires=0 WHERE id=?", id);
        return this.issue(id);
    }
    deviceChallenge(input: unknown) {
        const x = object(input, ['deviceId']), id = text(x.deviceId, ID);
        const d = this.store.q('SELECT * FROM a_device WHERE id=?', id)[0];
        if (!d || d.status !== 'approved' || d.challenge !== '')
            throw new GatewayError('UNAUTHORIZED');
        this.store.rate('device-challenge:' + id, Date.now(), 20);
        this.store.q('DELETE FROM a_nonce WHERE expires<=?', Date.now());
        if (Number(this.store.q('SELECT count(*) n FROM a_nonce')[0].n) >= 128)
            throw new GatewayError('RATE_LIMITED');
        const nonce = random();
        this.store.q('INSERT INTO a_nonce VALUES(?,?,?,?,?)', hash(nonce), 'device:' + id, '/auth/device/complete', hash(id), Date.now() + 60000);
        return { nonce, expiresInSeconds: 60 };
    }
    async deviceComplete(input: unknown) {
        const x = object(input, ['deviceId', 'nonce', 'signature']), id = text(x.deviceId, ID), nonce = text(x.nonce, HEX);
        this.store.rate('device-complete:' + id, Date.now(), 20);
        const d = this.store.q('SELECT * FROM a_device WHERE id=?', id)[0], n = this.store.q('SELECT * FROM a_nonce WHERE hash=?', hash(nonce))[0];
        if (!d || d.status !== 'approved' || d.challenge !== '' || !n || n.session !== 'device:' + id || n.path !== '/auth/device/complete' || Number(n.expires) <= Date.now())
            throw new GatewayError('UNAUTHORIZED');
        await this.verify(String(d.jwk), x.signature, ['wish-personal-v1', 'device', id, nonce].join(String.fromCharCode(10)));
        this.store.q('DELETE FROM a_nonce WHERE hash=?', hash(nonce));
        this.store.q('UPDATE a_session SET revoked=1 WHERE device=?', id);
        return this.issue(id);
    }
    issue(device: string) {
        this.store.q('DELETE FROM a_session WHERE expires<=? OR revoked=1', Date.now());
        this.store.q('DELETE FROM a_nonce WHERE expires<=?', Date.now());
        if (Number(this.store.q('SELECT count(*) n FROM a_session')[0].n) >= 64)
            throw new GatewayError('RATE_LIMITED');
        const id = crypto.randomUUID(), token = random();
        const ttl = Number(this.env.AUTH_SESSION_MS ?? 300000);
        if (!Number.isSafeInteger(ttl) || ttl < 1 || ttl > 300000)
            throw new GatewayError('UNAVAILABLE');
        const expiresAt = Date.now() + ttl;
        this.store.q('INSERT INTO a_session VALUES(?,?,?,?,0)', id, device, hash(token), expiresAt);
        return { sessionId: id, token, expiresAt };
    }
    session(request: Request) {
        const id = request.headers.get('x-wish-session') ?? '', header = request.headers.get('authorization') ?? '';
        if (!ID.test(id) || !/^Bearer [a-f0-9]{64}$/u.test(header))
            throw new GatewayError('UNAUTHORIZED');
        const s = this.store.q('SELECT s.*,d.status,d.jwk FROM a_session s JOIN a_device d ON d.id=s.device WHERE s.id=?', id)[0];
        if (!s || s.status !== 'approved' || s.revoked || Number(s.expires) <= Date.now() || !equal(String(s.hash), hash(header.slice(7))))
            throw new GatewayError('UNAUTHORIZED');
        return s;
    }
    challenge(request: Request, input: unknown) {
        const s = this.session(request), x = object(input, ['path', 'bodyHash']);
        if (typeof x.path !== 'string' || !['/v1/identify', '/v1/compare', '/v1/cancel', '/auth/renew'].includes(x.path))
            throw new GatewayError('INVALID_REQUEST');
        const bodyHash = text(x.bodyHash, HEX);
        this.store.rate('challenge:' + String(s.device), Date.now(), 20);
        this.store.q('DELETE FROM a_nonce WHERE expires<=?', Date.now());
        if (Number(this.store.q('SELECT count(*) n FROM a_nonce')[0].n) >= 128)
            throw new GatewayError('RATE_LIMITED');
        const nonce = random();
        this.store.q('INSERT INTO a_nonce VALUES(?,?,?,?,?)', hash(nonce), s.id, x.path, bodyHash, Date.now() + 60000);
        return { nonce, expiresInSeconds: 60 };
    }
    async proof(request: Request, input: unknown, path: string) {
        const s = this.session(request);
        this.store.rate('proof:' + String(s.device), Date.now(), 20);
        const nonce = request.headers.get('x-wish-nonce') ?? '', bodyHash = hash(JSON.stringify(input));
        if (!HEX.test(nonce))
            throw new GatewayError('UNAUTHORIZED');
        const n = this.store.q('SELECT * FROM a_nonce WHERE hash=?', hash(nonce))[0];
        if (!n || n.session !== s.id || n.path !== path || n.body_hash !== bodyHash || Number(n.expires) <= Date.now())
            throw new GatewayError('UNAUTHORIZED');
        await this.verify(String(s.jwk), request.headers.get('x-wish-signature'), message(String(s.id), nonce, path, bodyHash));
        this.store.q('DELETE FROM a_nonce WHERE hash=?', hash(nonce));
        return s;
    }
    approve(input: unknown) {
        const x = object(input, ['deviceId', 'fingerprint']), id = text(x.deviceId, ID);
        const d = this.store.q('SELECT * FROM a_device WHERE id=?', id)[0];
        if (!d || d.status !== 'pending' || d.fingerprint !== x.fingerprint || Number(d.expires) <= Date.now())
            throw new GatewayError('UNAUTHORIZED');
        this.store.q("UPDATE a_device SET status='approved' WHERE id=?", id);
        return { approved: true };
    }
    revoke(input: unknown) {
        const x = object(input, ['deviceId']), id = text(x.deviceId, ID);
        if (!this.store.q('SELECT 1 FROM a_device WHERE id=?', id).length)
            throw new GatewayError('INVALID_REQUEST');
        this.store.q("UPDATE a_device SET status='revoked',challenge='',expires=0 WHERE id=?", id);
        this.store.q('UPDATE a_session SET revoked=1 WHERE device=?', id);
        this.store.q('DELETE FROM a_nonce WHERE session IN (SELECT id FROM a_session WHERE device=?)', id);
        return { revoked: true };
    }
    recover(input: unknown) {
        const x = object(input, ['recoveryToken']);
        if (typeof x.recoveryToken !== 'string' || !HEX.test(x.recoveryToken) || !equal(hash(x.recoveryToken), this.meta('recovery')))
            throw new GatewayError('UNAUTHORIZED');
        const next = random();
        this.store.storage.transactionSync(() => {
            this.store.q("UPDATE a_device SET status='revoked',challenge='',expires=0");
            this.store.q('UPDATE a_session SET revoked=1');
            this.store.q('DELETE FROM a_nonce');
            this.store.q("UPDATE a_meta SET v=? WHERE k='recovery'", hash(next));
        });
        return { allDevicesRevoked: true, recoveryToken: next, budgetPreserved: true };
    }
    compact() {
        const rows = this.store.q("SELECT id,data FROM c_request WHERE state='done'");
        const retained = rows.map(r => ({ id: r.id, at: Date.parse(String((JSON.parse(String(r.data)) as {
                queriedAt: string;
            }).queriedAt)) })).sort((a, b) => b.at - a.at);
        for (const [index, r] of retained.entries())
            if (!Number.isFinite(r.at) || Date.now() - r.at >= 900000 || index >= 16)
                this.store.q("UPDATE c_request SET state='tombstone',data=NULL WHERE id=?", r.id);
    }
}
