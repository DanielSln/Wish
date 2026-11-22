import { runtime, hash } from './harness.mjs';
import { randomBytes } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const random = () => randomBytes(32).toString('hex');
export async function personalRuntime(options = {}) {
    const context = options.context ?? { operator: random(), recovery: random(), lineage: random(), witnessPath: fileURLToPath(new URL('./.local/witness/' + random() + '.json', import.meta.url)) };
    if (!options.context) {
        await mkdir(dirname(context.witnessPath), { recursive: true });
        const file = await open(context.witnessPath, 'wx');
        try {
            await file.writeFile(JSON.stringify({ sequence: 0, lineage: context.lineage, time: Date.now() }));
            await file.sync();
        }
        finally {
            await file.close();
        }
    }
    const fault = { down: false, loseAck: false, delayAckMs: 0, oversized: false, holdNextAck: false, ackHeld: false, releaseAck: () => { } };
    const witness = async (request) => {
        if (fault.down)
            return new Response('UNAVAILABLE', { status: 503 });
        let lock;
        try {
            lock = await open(context.witnessPath + '.lock', 'wx');
            const input = await request.json(), saved = JSON.parse(await readFile(context.witnessPath, 'utf8'));
            if (!Number.isSafeInteger(saved.sequence) || saved.sequence < 0 || saved.sequence >= Number.MAX_SAFE_INTEGER || !Number.isSafeInteger(saved.time) || saved.time < 0 || input.lineage !== saved.lineage || input.expected !== saved.sequence || !Number.isSafeInteger(input.expected) || Date.now() < saved.time)
                return new Response('MISMATCH', { status: 409 });
            const next = { sequence: saved.sequence + 1, lineage: saved.lineage, time: Date.now() };
            const path = context.witnessPath + '.next-' + random();
            const file = await open(path, 'wx');
            try {
                await file.writeFile(JSON.stringify(next));
                await file.sync();
            }
            finally {
                await file.close();
            }
            await rename(path, context.witnessPath);
            if (fault.loseAck) {
                fault.loseAck = false;
                return new Response('ACK_LOST', { status: 503 });
            }
            if (fault.holdNextAck) {
                fault.holdNextAck = false;
                fault.ackHeld = true;
                await new Promise(resolve => { fault.releaseAck = resolve; });
                fault.ackHeld = false;
            }
            if (fault.delayAckMs)
                await new Promise(resolve => setTimeout(resolve, fault.delayAckMs));
            if (fault.oversized)
                return new Response('x'.repeat(2048));
            return Response.json({ sequence: next.sequence });
        }
        catch {
            return new Response('UNAVAILABLE', { status: 503 });
        }
        finally {
            if (lock) {
                await lock.close();
                await unlink(context.witnessPath + '.lock');
            }
        }
    };
    const r = await runtime({ ...options, personal: true, internal: options.context?.internal, snapshot: options.context?.snapshot, serviceBindings: { WITNESS: witness }, bindings: { LINEAGE: context.lineage, OPERATOR_HASH: hash(context.operator), RECOVERY_HASH: hash(context.recovery), ...(options.restored ? { RESTORE_DECLARED: 'yes' } : {}), ...(options.witnessTimeoutMs ? { WITNESS_TIMEOUT_MS: String(options.witnessTimeoutMs) } : {}), ...(options.sessionMs ? { AUTH_SESSION_MS: String(options.sessionMs) } : {}) } });
    context.internal = r.internal;
    context.snapshot = r.snapshot;
    const namespace = await r.mf.getDurableObjectNamespace('COORDINATOR'), stub = namespace.get(namespace.idFromName('simulated-serpapi-account-global-v1'));
    const post = async (path, body, headers = {}) => { const res = await r.mf.dispatchFetch('http://127.0.0.1' + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }); return { status: res.status, data: await res.json() }; };
    const admin = async (path, body = {}, operator = context.operator) => {
        try {
            const res = await stub.fetch('http://coordinator/operator/' + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-internal': r.internal, 'x-operator': operator }, body: JSON.stringify(body) });
            return { status: res.status, data: await res.json() };
        }
        catch {
            return { status: 503, data: { error: 'UNAVAILABLE', simulation: true } };
        }
    };
    return { ...r, context, fault, post, admin };
}
export async function device() {
    const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
    const jwk = await crypto.subtle.exportKey('jwk', keys.publicKey), publicKey = { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
    const sign = async (text) => Buffer.from(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey, new TextEncoder().encode(text))).toString('hex');
    return { publicKey, sign };
}
export async function enroll(r, d) {
    const start = await r.post('/auth/pair/start', { publicKey: d.publicKey, label: 'Local test device' });
    if (start.status !== 200)
        throw Error('Pair start status ' + start.status);
    const p = start.data;
    const fingerprint = hash(JSON.stringify(d.publicKey));
    if (p.fingerprint !== fingerprint)
        throw Error('Out-of-band fingerprint mismatch');
    const approved = await r.admin('approve', { deviceId: p.deviceId, fingerprint });
    if (approved.status !== 200)
        throw Error('Approval status ' + approved.status);
    const signature = await d.sign(['wish-personal-v1', 'pair', p.deviceId, p.challenge].join(String.fromCharCode(10)));
    const paired = await r.post('/auth/pair/complete', { deviceId: p.deviceId, challenge: p.challenge, signature });
    if (paired.status !== 200)
        throw Error('Pair completion status ' + paired.status);
    return { ...paired.data, deviceId: p.deviceId };
}
export async function proof(r, d, s, path, body) {
    const headers = { authorization: 'Bearer ' + s.token, 'x-wish-session': s.sessionId };
    const bodyHash = hash(JSON.stringify(body));
    const result = await r.post('/auth/challenge', { path, bodyHash }, headers);
    if (result.status !== 200)
        return { error: result };
    const nonce = result.data.nonce;
    const signature = await d.sign(['wish-personal-v1', 'request', s.sessionId, nonce, 'POST', path, bodyHash].join(String.fromCharCode(10)));
    return { headers: { ...headers, 'x-wish-nonce': nonce, 'x-wish-signature': signature } };
}
export async function signed(r, d, s, path, body) { const p = await proof(r, d, s, path, body); return p.error ?? r.post(path, body, p.headers); }
export async function reauthenticate(r, d, deviceId) {
    const out = await r.post('/auth/device/challenge', { deviceId });
    if (out.status !== 200)
        return out;
    const nonce = out.data.nonce, signature = await d.sign(['wish-personal-v1', 'device', deviceId, nonce].join(String.fromCharCode(10)));
    return r.post('/auth/device/complete', { deviceId, nonce, signature });
}
