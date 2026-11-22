import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, existsSync, lstatSync } from 'node:fs';
import { resolve, relative, dirname, sep } from 'node:path';
import { GatewayError, type Snapshot } from './contracts.ts';
const PRIVATE_ROOT = resolve('.expo/search-gateway');
const digest = (v: string) => createHash('sha256').update(v).digest('hex');
export class GatewayStore {
    private db: DatabaseSync;
    readonly limits: Readonly<{
        cycle: number;
        hour: number;
        entries: number;
        cacheBytes: number;
    }>;
    constructor(file: string = ':memory:', limits = { cycle: 200, hour: 40, entries: 128, cacheBytes: 2000000 }) {
        this.limits = Object.freeze({ ...limits });
        if (!Object.values(limits).every(v => Number.isSafeInteger(v) && v > 0) || limits.cycle > 200 || limits.hour > 40 || limits.entries > 128 || limits.cacheBytes > 2000000)
            throw new GatewayError('UNAVAILABLE');
        if (file !== ':memory:') {
            const absolute = resolve(file), rel = relative(PRIVATE_ROOT, absolute);
            if (!rel || rel.startsWith('..' + sep) || rel === '..' || !absolute.endsWith('.gateway.sqlite') || (existsSync(absolute) && lstatSync(absolute).isSymbolicLink()))
                throw new GatewayError('UNAVAILABLE');
            mkdirSync(dirname(absolute), { recursive: true });
            file = absolute;
        }
        this.db = new DatabaseSync(file, { timeout: 250 });
        const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
        const app = this.db.prepare('PRAGMA application_id').get() as {
            application_id: number;
        };
        if (tables.some(t => !String(t.name).startsWith('g_')) || (app.application_id !== 0 && app.application_id !== 1464281137)) {
            this.db.close();
            throw new GatewayError('UNAVAILABLE');
        }
        if (tables.length && (!tables.some(t => t.name === 'g_meta') || this.db.prepare("SELECT v FROM g_meta WHERE k='schema'").get()?.v !== '1')) {
            this.db.close();
            throw new GatewayError('UNAVAILABLE');
        }
        this.db.exec(`PRAGMA application_id=1464281137; PRAGMA busy_timeout=250; PRAGMA max_page_count=4096;
      CREATE TABLE IF NOT EXISTS g_cycle(id TEXT PRIMARY KEY,starts INTEGER,ends INTEGER,observed INTEGER,remaining INTEGER,used INTEGER,ack INTEGER,blocked INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS g_reservation(id TEXT PRIMARY KEY,cycle TEXT,k TEXT,at INTEGER,state TEXT);
      CREATE INDEX IF NOT EXISTS g_reservation_time ON g_reservation(at);
      CREATE TABLE IF NOT EXISTS g_cache(k TEXT PRIMARY KEY,owner TEXT,data TEXT,at INTEGER,identity_end INTEGER,price_end INTEGER,bytes INTEGER);
      CREATE TABLE IF NOT EXISTS g_session(hash TEXT PRIMARY KEY,owner TEXT,expires INTEGER,revoked INTEGER);
      CREATE TABLE IF NOT EXISTS g_rate(k TEXT PRIMARY KEY,start INTEGER,n INTEGER);
      CREATE TABLE IF NOT EXISTS g_meta(k TEXT PRIMARY KEY,v TEXT);
      INSERT OR IGNORE INTO g_meta VALUES('schema','1');
    `);
    }
    close() { this.db.close(); }
    private tx<T>(fn: () => T): T {
        this.db.exec('BEGIN IMMEDIATE');
        try {
            const out = fn();
            this.db.exec('COMMIT');
            return out;
        }
        catch (e) {
            this.db.exec('ROLLBACK');
            throw e;
        }
    }
    private cycle() {
        return this.db.prepare('SELECT * FROM g_cycle ORDER BY starts DESC LIMIT 1').get() as undefined | {
            id: string;
            starts: number;
            ends: number;
            observed: number;
            remaining: number;
            used: number;
            ack: number;
            blocked: number;
        };
    }
    private count(cycle: string) { return Number(this.db.prepare('SELECT count(*) n FROM g_reservation WHERE cycle=?').get(cycle)!.n); }
    reconcile(s: Snapshot, now: number, acknowledgedExternalUse = 0) {
        if (!Number.isSafeInteger(acknowledgedExternalUse) || acknowledgedExternalUse < 0 || acknowledgedExternalUse > 250)
            throw new GatewayError('BUDGET_INCONSISTENT');
        if (s.simulation !== true || s.free !== true || s.monthlyLimit !== 250 || ![s.remaining, s.used, s.startsAt, s.renewsAt, s.observedAt, now].every(Number.isSafeInteger) || s.remaining < 0 || s.used < 0 || s.used + s.remaining !== 250 || s.observedAt > now || now - s.observedAt > 3600000 || s.startsAt > now || s.renewsAt <= now || !/^mock-[a-zA-Z0-9_-]{1,60}$/u.test(s.cycleId))
            throw new GatewayError('BUDGET_STALE');
        let inconsistent = false;
        this.tx(() => {
            const old = this.cycle();
            if (old?.id === s.cycleId) {
                const count = this.count(old.id);
                if (s.observedAt < old.observed || s.startsAt !== old.starts || s.renewsAt !== old.ends || s.used !== old.used + count - old.ack + acknowledgedExternalUse) {
                    this.db.prepare('UPDATE g_cycle SET blocked=1 WHERE id=?').run(old.id);
                    inconsistent = true;
                    return;
                }
                this.db.prepare('UPDATE g_cycle SET observed=?,remaining=?,used=?,ack=?,blocked=0 WHERE id=?').run(s.observedAt, s.remaining, s.used, count, old.id);
                this.db.prepare("UPDATE g_reservation SET state='settled' WHERE cycle=? AND state='uncertain'").run(old.id);
                return;
            }
            if (old && (now < old.ends || s.startsAt < old.ends || this.db.prepare("SELECT 1 FROM g_reservation WHERE state IN ('pending','uncertain') LIMIT 1").get()))
                throw new GatewayError('BUDGET_INCONSISTENT');
            this.db.prepare('INSERT INTO g_cycle VALUES(?,?,?,?,?,?,?,0)').run(s.cycleId, s.startsAt, s.renewsAt, s.observedAt, s.remaining, s.used, 0);
        });
        if (inconsistent)
            throw new GatewayError('BUDGET_INCONSISTENT');
    }
    reserve(k: string, now: number): string {
        return this.tx(() => {
            const s = this.cycle();
            if (!s || s.blocked)
                throw new GatewayError(s ? 'BUDGET_INCONSISTENT' : 'BUDGET_STALE');
            if (now < s.observed || now >= s.ends || now - s.observed > 3600000)
                throw new GatewayError('BUDGET_STALE');
            const n = this.count(s.id);
            const hourly = Number(this.db.prepare('SELECT count(*) n FROM g_reservation WHERE at>?').get(now - 3600000)!.n);
            if (n >= this.limits.cycle || s.remaining - (n - s.ack) <= 50)
                throw new GatewayError('BUDGET_EXHAUSTED');
            if (hourly >= this.limits.hour)
                throw new GatewayError('RATE_LIMITED');
            const id = randomUUID();
            this.db.prepare('INSERT INTO g_reservation VALUES(?,?,?,?,?)').run(id, s.id, k, now, 'pending');
            return id;
        });
    }
    finish(id: string, state: 'settled' | 'uncertain') { this.db.prepare('UPDATE g_reservation SET state=? WHERE id=?').run(state, id); }
    recoverPending() { this.db.prepare("UPDATE g_reservation SET state='uncertain' WHERE state='pending'").run(); }
    stats() { const s = this.cycle(); return { cycleId: s?.id, reserved: s ? this.count(s.id) : 0, pending: Number(this.db.prepare("SELECT count(*) n FROM g_reservation WHERE state='pending'").get()!.n), uncertain: Number(this.db.prepare("SELECT count(*) n FROM g_reservation WHERE state='uncertain'").get()!.n), blocked: !!s?.blocked }; }
    rate(key: string, now: number, max = 20) {
        return this.tx(() => {
            this.db.prepare('DELETE FROM g_rate WHERE start<?').run(now - 60000);
            const row = this.db.prepare('SELECT start,n FROM g_rate WHERE k=?').get(key) as undefined | {
                start: number;
                n: number;
            };
            if (row && (now < row.start || row.n >= max))
                throw new GatewayError('RATE_LIMITED');
            this.db.prepare('INSERT INTO g_rate VALUES(?,?,1) ON CONFLICT(k) DO UPDATE SET n=n+1').run(key, row?.start ?? now);
        });
    }
    issueSession(owner: string, now: number, ttl = 3600000): string {
        if (!/^[a-zA-Z0-9_-]{1,64}$/u.test(owner) || ttl <= 0 || ttl > 3600000)
            throw new GatewayError('UNAUTHORIZED');
        this.db.prepare('DELETE FROM g_session WHERE expires<=? OR revoked=1').run(now);
        if (Number(this.db.prepare('SELECT count(*) n FROM g_session').get()!.n) >= 32)
            throw new GatewayError('UNAVAILABLE');
        const token = randomBytes(32).toString('hex');
        this.db.prepare('INSERT INTO g_session VALUES(?,?,?,0)').run(digest(token), owner, now + ttl);
        return token;
    }
    authenticate(header: string | undefined, now: number): string {
        if (!header || !/^Bearer [a-f0-9]{64}$/u.test(header))
            throw new GatewayError('UNAUTHORIZED');
        const row = this.db.prepare('SELECT owner,expires,revoked FROM g_session WHERE hash=?').get(digest(header.slice(7))) as undefined | {
            owner: string;
            expires: number;
            revoked: number;
        };
        if (!row || row.revoked || row.expires <= now)
            throw new GatewayError('UNAUTHORIZED');
        return row.owner;
    }
    revoke(token: string) { this.db.prepare('UPDATE g_session SET revoked=1 WHERE hash=?').run(digest(token)); }
    cacheGet(k: string, owner: string, now: number, operation: 'identify' | 'compare') {
        this.db.prepare('DELETE FROM g_cache WHERE identity_end<=?').run(now);
        const row = this.db.prepare('SELECT data,at,identity_end,price_end FROM g_cache WHERE k=? AND owner=?').get(k, owner) as undefined | {
            data: string;
            at: number;
            identity_end: number;
            price_end: number;
        };
        if (!row || now < row.at || (operation === 'compare' && row.price_end <= now))
            return null;
        try {
            return { data: JSON.parse(row.data) as unknown, at: row.at, commercialFresh: row.price_end > now };
        }
        catch {
            throw new GatewayError('UNAVAILABLE');
        }
    }
    cachePut(k: string, owner: string, data: unknown, now: number, identityTtl = 86400000, priceTtl = 900000) {
        const json = JSON.stringify(data), bytes = Buffer.byteLength(json);
        if (bytes > 200000 || identityTtl <= 0 || identityTtl > 86400000 || priceTtl <= 0 || priceTtl > identityTtl)
            throw new GatewayError('INVALID_PROVIDER_DATA');
        this.tx(() => {
            this.db.prepare('DELETE FROM g_cache WHERE identity_end<=?').run(now);
            this.db.prepare('INSERT OR REPLACE INTO g_cache VALUES(?,?,?,?,?,?,?)').run(k, owner, json, now, now + identityTtl, now + priceTtl, bytes);
            while (Number(this.db.prepare('SELECT count(*) n FROM g_cache').get()!.n) > this.limits.entries || Number(this.db.prepare('SELECT coalesce(sum(bytes),0) n FROM g_cache').get()!.n) > this.limits.cacheBytes)
                this.db.prepare('DELETE FROM g_cache WHERE k=(SELECT k FROM g_cache ORDER BY at,k LIMIT 1)').run();
        });
    }
    invalidate(k: string, owner: string) { this.db.prepare('DELETE FROM g_cache WHERE k=? AND owner=?').run(k, owner); }
}
