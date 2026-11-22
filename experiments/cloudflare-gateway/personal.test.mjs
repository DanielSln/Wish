import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { personalRuntime, device, enroll, signed, proof } from './personal-harness.mjs';
import { identify } from './harness.mjs';
const nonce = () => randomBytes(32).toString('hex');
const checked = async (p, status, code) => {
    const out = await p;
    assert.equal(out.status, status, 'Unexpected HTTP status (payload deliberately omitted)');
    if (code)
        assert.equal(out.data.error, code);
    return out;
};
async function setup(t, options = {}) { const r = await personalRuntime(options); t.after(async () => { assert.equal(r.outbound(), 0); await r.close(); }); return r; }
async function ready(t, options = {}) { const r = await setup(t, options), d = await device(), s = await enroll(r, d); return { r, d, s }; }
const stats = async (r) => (await checked(r.admin('status'), 200)).data;
async function checkpoint(r) { await r.close(); const target = fileURLToPath(new URL('./.local/backups/' + nonce(), import.meta.url)); await mkdir(target, { recursive: true }); await cp(r.persist, target, { recursive: true }); return target; }
test('explicit operator approval, private key proof and five-minute session required before mock', async (t) => { const { r, d, s } = await ready(t); assert.ok(s.expiresAt > Date.now() && s.expiresAt <= Date.now() + 300000); const out = await checked(signed(r, d, s, '/v1/identify', identify('personal')), 200); assert.equal(out.data.provider, 'simulated'); assert.equal(out.data.assessment.eligibleOffers.length, 0); const status = await stats(r); assert.equal(status.reserved, 1); assert.equal(status.calls, 1); });
test('pending unapproved device cannot complete pairing', async (t) => { const r = await setup(t), d = await device(); const p = (await r.post('/auth/pair/start', { publicKey: d.publicKey, label: 'Pending' })).data; const signature = await d.sign(['wish-personal-v1', 'pair', p.deviceId, p.challenge].join(String.fromCharCode(10))); await checked(r.post('/auth/pair/complete', { deviceId: p.deviceId, challenge: p.challenge, signature }), 401); assert.equal((await stats(r)).calls, 0); });
test('operator approval rejects wrong capability and fingerprint', async (t) => { const r = await setup(t), d = await device(); const p = (await r.post('/auth/pair/start', { publicKey: d.publicKey, label: 'Pending' })).data; await checked(r.admin('approve', { deviceId: p.deviceId, fingerprint: p.fingerprint }, nonce()), 401); await checked(r.admin('approve', { deviceId: p.deviceId, fingerprint: nonce() }), 401); });
test('private JWK and unexpected key parameters rejected', async (t) => { const r = await setup(t), d = await device(); await checked(r.post('/auth/pair/start', { publicKey: { ...d.publicKey, d: nonce() }, label: 'Bad' }), 400); await checked(r.post('/auth/pair/start', { publicKey: { ...d.publicKey, crv: 'P-384' }, label: 'Bad' }), 400); assert.equal((await stats(r)).calls, 0); });
test('expired pairing and wrong private key proof refused', async (t) => { const r = await setup(t), d = await device(), other = await device(); const p = (await r.post('/auth/pair/start', { publicKey: d.publicKey, label: 'Pair' })).data; await checked(r.admin('approve', { deviceId: p.deviceId, fingerprint: p.fingerprint }), 200); const signature = await other.sign(['wish-personal-v1', 'pair', p.deviceId, p.challenge].join(String.fromCharCode(10))); await checked(r.post('/auth/pair/complete', { deviceId: p.deviceId, challenge: p.challenge, signature }), 401); await checked(r.admin('test', { action: 'expire-pairs' }), 200); await checked(r.post('/auth/pair/complete', { deviceId: p.deviceId, challenge: p.challenge, signature: await d.sign(['wish-personal-v1', 'pair', p.deviceId, p.challenge].join(String.fromCharCode(10))) }), 401); });
test('pair completion replay cannot mint another session', async (t) => { const r = await setup(t), d = await device(); const p = (await r.post('/auth/pair/start', { publicKey: d.publicKey, label: 'Pair' })).data; await r.admin('approve', { deviceId: p.deviceId, fingerprint: p.fingerprint }); const body = { deviceId: p.deviceId, challenge: p.challenge, signature: await d.sign(['wish-personal-v1', 'pair', p.deviceId, p.challenge].join(String.fromCharCode(10))) }; await checked(r.post('/auth/pair/complete', body), 200); await checked(r.post('/auth/pair/complete', body), 401); });
test('legacy static bearer, missing headers and forged operator routes denied', async (t) => { const { r, s } = await ready(t); await checked(r.post('/v1/identify', identify('missing')), 401); await checked(r.post('/v1/identify', identify('legacy'), { authorization: 'Bearer ' + r.token }), 401); await checked(r.post('/operator/recover', { recoveryToken: r.context.recovery }, { 'x-operator': r.context.operator }), 400); await checked(r.post('/v1/identify', identify('bearer-only'), { authorization: 'Bearer ' + s.token, 'x-wish-session': s.sessionId }), 401); assert.equal((await stats(r)).calls, 0); });
test('stolen bearer without private key fails proof', async (t) => { const { r, s } = await ready(t), wrong = await device(); await checked(signed(r, wrong, s, '/v1/identify', identify('stolen')), 401); assert.equal((await stats(r)).calls, 0); });
test('proof is bound to body and endpoint, then consumed exactly once', async (t) => { const { r, d, s } = await ready(t), body = identify('proof'); const p = await proof(r, d, s, '/v1/identify', body); await checked(r.post('/v1/identify', identify('tampered'), p.headers), 401); await checked(r.post('/v1/cancel', { requestId: 'proof' }, p.headers), 401); await checked(r.post('/v1/identify', body, p.headers), 200); await checked(r.post('/v1/identify', body, p.headers), 401); assert.equal((await stats(r)).calls, 1); });
test('concurrent reuse of same signed nonce has a single winner', async (t) => { const { r, d, s } = await ready(t), body = identify('race'); const p = await proof(r, d, s, '/v1/identify', body); const results = await Promise.all([r.post('/v1/identify', body, p.headers), r.post('/v1/identify', body, p.headers)]); assert.deepEqual(results.map(x => x.status).sort(), [200, 401]); assert.equal((await stats(r)).calls, 1); });
test('nonce expiration and session expiration are persistent authorization checks', async (t) => { const { r, d, s } = await ready(t); const body = identify('expires'), p = await proof(r, d, s, '/v1/identify', body); await r.admin('test', { action: 'expire-nonces' }); await checked(r.post('/v1/identify', body, p.headers), 401); await r.admin('test', { action: 'expire-sessions' }); await checked(signed(r, d, s, '/v1/identify', identify('expired-session')), 401); assert.equal((await stats(r)).calls, 0); });
test('renewal requires signed proof and rotates the old session', async (t) => { const { r, d, s } = await ready(t); const next = (await checked(signed(r, d, s, '/auth/renew', {}), 200)).data; assert.notEqual(next.sessionId, s.sessionId); await checked(signed(r, d, s, '/v1/identify', identify('old-session')), 401); await checked(signed(r, d, next, '/v1/identify', identify('new-session')), 200); });
test('revocation immediately blocks future challenges and existing proofs of that device only', async (t) => { const { r, d, s } = await ready(t), d2 = await device(), s2 = await enroll(r, d2); const body = identify('revoked'), p = await proof(r, d, s, '/v1/identify', body); await checked(r.admin('revoke', { deviceId: s.deviceId }), 200); await checked(r.post('/v1/identify', body, p.headers), 401); await checked(signed(r, d, s, '/auth/renew', {}), 401); await checked(signed(r, d2, s2, '/v1/identify', identify('survivor')), 200); });
test('normal runtime restart preserves revocation and active sessions', async (t) => { const r = await personalRuntime(), d = await device(), s = await enroll(r, d), d2 = await device(), s2 = await enroll(r, d2); await r.admin('revoke', { deviceId: s.deviceId }); await r.close(); const next = await setup(t, { context: r.context, persist: r.persist }); await checked(signed(next, d, s, '/v1/identify', identify('revoked-restart')), 401); await checked(signed(next, d2, s2, '/v1/identify', identify('restart-ok')), 200); });
test('two devices share private personal cache and global account budget', async (t) => { const { r, d, s } = await ready(t), d2 = await device(), s2 = await enroll(r, d2); await checked(signed(r, d, s, '/v1/identify', identify('dev1')), 200); const hit = await checked(signed(r, d2, s2, '/v1/identify', identify('dev2')), 200); assert.equal(hit.data.cache, 'hit'); assert.equal((await stats(r)).reserved, 1); });
test('requestId replay with new proof returns result; conflicting content cannot query', async (t) => { const { r, d, s } = await ready(t); await checked(signed(r, d, s, '/v1/identify', identify('idempotent')), 200); await checked(signed(r, d, s, '/v1/identify', identify('idempotent')), 200); await checked(signed(r, d, s, '/v1/identify', identify('idempotent', 'Different')), 409); assert.equal((await stats(r)).calls, 1); });
test('expired result compacted to permanent tombstone; no price refresh or query replay', async (t) => { const r = await personalRuntime(), d = await device(), s = await enroll(r, d); await checked(signed(r, d, s, '/v1/identify', identify('tombstone')), 200); await r.admin('test', { action: 'age-results' }); await checked(signed(r, d, s, '/v1/identify', identify('tombstone')), 409); assert.equal((await stats(r)).tombstones, 1); await r.close(); const next = await setup(t, { context: r.context, persist: r.persist }); await checked(signed(next, d, s, '/v1/identify', identify('tombstone')), 409); assert.equal((await stats(next)).calls, 1); });
test('bounded tombstone capacity fails closed without deleting identifiers', async (t) => { const { r, d, s } = await ready(t); await checked(r.admin('test', { action: 'cap-requests' }), 200); await checked(signed(r, d, s, '/v1/identify', identify('capacity')), 429); const status = await stats(r); assert.equal(status.requests, 4096); assert.equal(status.tombstones, 4096); assert.equal(status.calls, 0); });
test('uncertain mock reservations retain budget; claimed receipts cannot unlock or refund', async (t) => { const { r, d, s } = await ready(t, { mode: 'timeout' }); await checked(signed(r, d, s, '/v1/identify', identify('timeout')), 504); const report = await checked(r.admin('reconcile'), 200); assert.equal(report.data.release, false); assert.equal(report.data.externalEvidenceRequired, true); assert.equal(report.data.uncertain.length, 1); await checked(r.admin('reconcile', { receipt: 'claimed success' }), 400); await checked(signed(r, d, s, '/v1/identify', identify('same-uncertain')), 503); assert.equal((await stats(r)).reserved, 1); });
test('recovery requires operator plus one-time offline capability, rotates secret and revokes all', async (t) => { const { r, d, s } = await ready(t); await checked(signed(r, d, s, '/v1/identify', identify('before-recovery')), 200); await checked(r.admin('recover', { recoveryToken: nonce() }), 401); const old = r.context.recovery, next = await checked(r.admin('recover', { recoveryToken: old }), 200); await checked(r.admin('recover', { recoveryToken: old }), 401); await checked(signed(r, d, s, '/v1/identify', identify('after-recovery')), 401); const status = await stats(r); assert.equal(status.calls, 1); assert.equal(status.reserved, 1); assert.equal(status.requests, 1); const d2 = await device(), s2 = await enroll(r, d2); await checked(signed(r, d2, s2, '/v1/identify', identify('new-owner-device', 'Other product')), 200); await checked(r.admin('recover', { recoveryToken: next.data.recoveryToken }), 200); });
test('recovery replay and revoked device stay denied after restart', async (t) => { const r = await personalRuntime(), d = await device(), s = await enroll(r, d); await checked(r.admin('recover', { recoveryToken: r.context.recovery }), 200); await r.close(); const next = await setup(t, { context: r.context, persist: r.persist }); await checked(next.admin('recover', { recoveryToken: r.context.recovery }), 401); await checked(signed(next, d, s, '/v1/identify', identify('old-device')), 401); });
test('missing witness blocks pairing and operator recovery, no automatic substitute', async (t) => { const r = await setup(t); r.fault.down = true; const d = await device(); await checked(r.post('/auth/pair/start', { publicKey: d.publicKey, label: 'No witness' }), 503); await checked(r.admin('recover', { recoveryToken: r.context.recovery }), 503); r.fault.down = false; assert.equal((await stats(r)).calls, 0); });
test('lost witness acknowledgement leaves runtime and restart blocked rather than guessing sequence', async (t) => { const r = await personalRuntime(), d = await device(); r.fault.loseAck = true; await checked(r.post('/auth/pair/start', { publicKey: d.publicKey, label: 'Ack lost' }), 503); await checked(r.admin('status'), 503); await r.close(); const next = await setup(t, { context: r.context, persist: r.persist }); await checked(next.admin('recover', { recoveryToken: r.context.recovery }), 503); });
test('old DO backup restored under newer independent witness cannot un-revoke or refund', async (t) => { const r = await personalRuntime(), d = await device(), s = await enroll(r, d); const backup = await checkpoint(r); const live = await personalRuntime({ context: r.context, persist: r.persist }); await checked(signed(live, d, s, '/v1/identify', identify('consumed-after-checkpoint')), 200); await live.admin('revoke', { deviceId: s.deviceId }); await live.close(); const restored = await setup(t, { context: r.context, persist: backup }); await checked(restored.admin('status'), 503); await checked(restored.admin('recover', { recoveryToken: r.context.recovery }), 503); await checked(signed(restored, d, s, '/v1/identify', identify('rollback-retry')), 503); });
test('witness lineage mismatch refuses existing DB even with correct operator secret', async (t) => { const r = await personalRuntime(); await r.admin('status'); await r.close(); const next = await setup(t, { context: { ...r.context, lineage: nonce() }, persist: r.persist }); await checked(next.admin('status'), 503); });
test('local witness clock rollback is refused', async (t) => { const r = await setup(t); const saved = JSON.parse(await readFile(r.context.witnessPath, 'utf8')); const { writeFile } = await import('node:fs/promises'); await writeFile(r.context.witnessPath, JSON.stringify({ ...saved, time: Date.now() + 60000 })); await checked(r.admin('status'), 503); });
test('pairing flood is bounded without provider calls', async (t) => {
    const r = await setup(t), d = await device();
    for (let i = 0; i < 10; i++)
        await checked(r.post('/auth/pair/start', { publicKey: d.publicKey, label: 'Pending ' + i }), 200);
    await checked(r.post('/auth/pair/start', { publicKey: d.publicKey, label: 'Excess' }), 429);
    assert.equal((await stats(r)).calls, 0);
});
test('declared restore stays blocked even if the local witness was rolled back too', async (t) => {
    const r = await personalRuntime(), savedWitness = await readFile(r.context.witnessPath, 'utf8');
    // Establish matching checkpoint of both stores, then declare restoration: no external evidence exists.
    const backup = await checkpoint(r);
    const restoredContext = { ...r.context, witnessPath: fileURLToPath(new URL('./.local/witness/' + nonce() + '.json', import.meta.url)) };
    const { writeFile } = await import('node:fs/promises');
    await writeFile(restoredContext.witnessPath, savedWitness);
    const restored = await setup(t, { context: restoredContext, persist: backup, restored: true });
    await checked(restored.admin('status'), 503);
    await checked(restored.admin('recover', { recoveryToken: r.context.recovery }), 503);
});
test('witness missing on disk never gets silently recreated on restart', async (t) => {
    const r = await personalRuntime();
    await r.admin('status');
    await r.close();
    const missing = { ...r.context, witnessPath: fileURLToPath(new URL('./.local/witness/' + nonce() + '.json', import.meta.url)) };
    const next = await setup(t, { context: missing, persist: r.persist });
    await checked(next.admin('status'), 503);
});
test('storage synchronization failure prevents access after restart instead of resetting credentials', async (t) => {
    const r = await personalRuntime();
    await checked(r.admin('test', { action: 'fault' }), 503);
    await r.close();
    const next = await setup(t, { context: r.context, persist: r.persist });
    await checked(next.admin('recover', { recoveryToken: r.context.recovery }), 503);
});
test('only sixteen full results retained; evicted results leave tombstones rather than freeing requestIds', async (t) => {
    const { r, d, s } = await ready(t);
    for (let i = 0; i < 17; i++)
        await checked(signed(r, d, s, '/v1/identify', identify('retain-' + i, 'Product ' + i)), 200);
    const status = await stats(r);
    assert.equal(status.retainedResults, 16);
    assert.equal(status.tombstones, 1);
    await checked(signed(r, d, s, '/v1/identify', identify('retain-0', 'Product 0')), 409);
    assert.equal((await stats(r)).calls, 17);
});
test('pending challenge survives normal restart and remains single-use after successful execution', async (t) => {
    const r = await personalRuntime(), d = await device(), s = await enroll(r, d), body = identify('nonce-restart'), p = await proof(r, d, s, '/v1/identify', body);
    await r.close();
    const next = await setup(t, { context: r.context, persist: r.persist });
    await checked(next.post('/v1/identify', body, p.headers), 200);
    await checked(next.post('/v1/identify', body, p.headers), 401);
    assert.equal((await stats(next)).calls, 1);
});
test('two clones of one checkpoint cannot both advance an independent account witness', async (t) => {
    const original = await personalRuntime();
    await original.admin('status');
    const clone = await checkpoint(original);
    const first = await setup(t, { context: original.context, persist: original.persist });
    const second = await setup(t, { context: original.context, persist: clone });
    const results = await Promise.all([first.admin('status'), second.admin('status')]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 503]);
});
test('natural short-session expiry denies renewal without changing persisted authorization timestamps', async (t) => {
    const { r, d, s } = await ready(t, { sessionMs: 50 });
    await new Promise(resolve => setTimeout(resolve, 100));
    await checked(signed(r, d, s, '/auth/renew', {}), 401);
    assert.equal((await stats(r)).calls, 0);
});
test('corrupt independent witness metadata fails closed instead of bypassing monotonic time checks', async (t) => {
    const r = await setup(t);
    const saved = JSON.parse(await readFile(r.context.witnessPath, 'utf8'));
    const { writeFile } = await import('node:fs/promises');
    await writeFile(r.context.witnessPath, JSON.stringify({ ...saved, time: null }));
    await checked(r.admin('status'), 503);
});
test('approved device reauthenticates after expiry without operator, rotates old sessions and never uses a refresh bearer', async (t) => {
    const { reauthenticate } = await import('./personal-harness.mjs');
    const { r, d, s } = await ready(t);
    await r.admin('test', { action: 'expire-sessions' });
    const next = (await checked(reauthenticate(r, d, s.deviceId), 200)).data;
    await checked(signed(r, d, next, '/v1/identify', identify('reauthenticated')), 200);
    await checked(signed(r, d, s, '/auth/renew', {}), 401);
    assert.equal((await stats(r)).calls, 1);
});
test('device reauthentication denies stolen device ID, uncompleted pairing, revoked key and replayed nonce', async (t) => {
    const { reauthenticate } = await import('./personal-harness.mjs');
    const { r, d, s } = await ready(t), wrong = await device();
    await checked(reauthenticate(r, wrong, s.deviceId), 401);
    const challenge = (await checked(r.post('/auth/device/challenge', { deviceId: s.deviceId }), 200)).data;
    const body = { deviceId: s.deviceId, nonce: challenge.nonce, signature: await d.sign(['wish-personal-v1', 'device', s.deviceId, challenge.nonce].join(String.fromCharCode(10))) };
    await checked(r.post('/auth/device/complete', body), 200);
    await checked(r.post('/auth/device/complete', body), 401);
    const p = (await r.post('/auth/pair/start', { publicKey: wrong.publicKey, label: 'Not completed' })).data;
    await r.admin('approve', { deviceId: p.deviceId, fingerprint: p.fingerprint });
    await checked(r.post('/auth/device/challenge', { deviceId: p.deviceId }), 401);
    await r.admin('revoke', { deviceId: s.deviceId });
    await checked(reauthenticate(r, d, s.deviceId), 401);
});
