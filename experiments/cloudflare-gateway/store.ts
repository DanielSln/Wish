import { GatewayError, type Snapshot } from '../search-gateway/contracts.ts';
import type { GatewayStorage } from '../search-gateway/gateway.ts';
import type { Storage, Value } from './runtime.ts';
interface Cycle {
    id: string;
    starts: number;
    ends: number;
    observed: number;
    remaining: number;
    used: number;
    ack: number;
    blocked: number;
}
/** Dedicated DO SQLite only. No app database, filesystem, calendar reset or live account. */
export class DurableStore implements GatewayStorage {
    storage: Storage;
    failed = false;
    fault: 'none' | 'reserve' | 'finish' | 'sync' = 'none';
    reads = 0;
    writes = 0;
    constructor(storage: Storage, initial: Snapshot) {
        this.storage = storage;
        this.q(`CREATE TABLE IF NOT EXISTS c_meta(k TEXT PRIMARY KEY,v TEXT)`);
        const schema = this.q(`SELECT v FROM c_meta WHERE k='schema'`)[0];
        const existing = this.q("SELECT name FROM sqlite_master WHERE type='table' AND name GLOB 'c_*'").map(row => String(row.name));
        const expected = ['c_meta', 'c_cycle', 'c_reservation', 'c_cache', 'c_rate', 'c_request', 'c_calls'];
        if ((schema && (expected.some(name => !existing.includes(name)) || existing.some(name => !expected.includes(name)))) || (!schema && existing.some(name => name !== 'c_meta')))
            throw new GatewayError('UNAVAILABLE');
        if (schema && schema.v !== '1')
            throw new GatewayError('UNAVAILABLE');
        storage.transactionSync(() => {
            this.q(`CREATE TABLE IF NOT EXISTS c_cycle(id TEXT PRIMARY KEY,starts INTEGER,ends INTEGER,observed INTEGER,remaining INTEGER,used INTEGER,ack INTEGER,blocked INTEGER)`);
            this.q(`CREATE TABLE IF NOT EXISTS c_reservation(id TEXT PRIMARY KEY,cycle TEXT,k TEXT,at INTEGER,state TEXT)`);
            this.q(`CREATE INDEX IF NOT EXISTS c_reservation_time ON c_reservation(at)`);
            this.q(`CREATE TABLE IF NOT EXISTS c_cache(k TEXT PRIMARY KEY,owner TEXT,data TEXT,at INTEGER,identity_end INTEGER,price_end INTEGER,bytes INTEGER)`);
            this.q(`CREATE TABLE IF NOT EXISTS c_rate(k TEXT PRIMARY KEY,start INTEGER,n INTEGER)`);
            this.q(`CREATE TABLE IF NOT EXISTS c_request(id TEXT PRIMARY KEY,k TEXT,state TEXT,data TEXT)`);
            this.q(`CREATE TABLE IF NOT EXISTS c_calls(id TEXT PRIMARY KEY,reserved INTEGER)`);
            this.q(`UPDATE c_reservation SET state='uncertain' WHERE state='pending'`);
            this.q(`UPDATE c_request SET state='uncertain' WHERE state='pending'`);
            if (!schema) {
                this.reconcile(initial, Date.now());
                this.q(`INSERT INTO c_meta VALUES('schema','1')`);
            }
        });
    }
    q(query: string, ...args: Value[]): Record<string, Value>[] {
        if (this.failed)
            throw new GatewayError('UNAVAILABLE');
        try {
            const cursor = this.storage.sql.exec(query, ...args);
            const rows = cursor.toArray();
            this.reads += cursor.rowsRead;
            this.writes += cursor.rowsWritten;
            return rows;
        }
        catch {
            this.failed = true;
            throw new GatewayError('UNAVAILABLE');
        }
    }
    cycle(): Cycle | undefined { return this.q('SELECT * FROM c_cycle ORDER BY starts DESC LIMIT 1')[0] as unknown as Cycle | undefined; }
    count(cycle: string) { return Number(this.q('SELECT count(*) n FROM c_reservation WHERE cycle=?', cycle)[0].n); }
    reconcile(s: Snapshot, now: number) {
        if (s.simulation !== true || s.free !== true || s.monthlyLimit !== 250 || ![s.startsAt, s.renewsAt, s.observedAt, s.used, s.remaining, now].every(Number.isSafeInteger) || s.used < 0 || s.remaining < 0 || s.used + s.remaining !== 250 || s.observedAt > now || now - s.observedAt > 3600000 || s.startsAt > now || s.renewsAt <= now || !/^mock-[a-zA-Z0-9_-]{1,60}$/u.test(s.cycleId))
            throw new GatewayError('BUDGET_STALE');
        let blocked = false;
        this.storage.transactionSync(() => {
            const old = this.cycle();
            if (old) {
                // Local experiment deliberately supports no rollover or external-use acknowledgement.
                if (old.id !== s.cycleId || s.startsAt !== old.starts || s.renewsAt !== old.ends || s.observedAt <= old.observed || s.used !== old.used + this.count(old.id) - old.ack) {
                    this.q('UPDATE c_cycle SET blocked=1 WHERE id=?', old.id);
                    blocked = true;
                    return;
                }
                this.q('UPDATE c_cycle SET observed=?,remaining=?,used=?,ack=?,blocked=0 WHERE id=?', s.observedAt, s.remaining, s.used, this.count(old.id), old.id);
            }
            else
                this.q('INSERT INTO c_cycle VALUES(?,?,?,?,?,?,0,0)', s.cycleId, s.startsAt, s.renewsAt, s.observedAt, s.remaining, s.used);
        });
        if (blocked)
            throw new GatewayError('BUDGET_INCONSISTENT');
    }
    reserve(key: string, now: number): string {
        return this.storage.transactionSync(() => {
            if (this.fault === 'reserve') {
                this.failed = true;
                throw new GatewayError('UNAVAILABLE');
            }
            const s = this.cycle();
            if (!s || s.blocked)
                throw new GatewayError(s ? 'BUDGET_INCONSISTENT' : 'BUDGET_STALE');
            if (now < s.observed || now >= s.ends || now - s.observed > 3600000)
                throw new GatewayError('BUDGET_STALE');
            if (this.q("SELECT 1 FROM c_reservation WHERE k=? AND state='uncertain' LIMIT 1", key).length)
                throw new GatewayError('BUDGET_INCONSISTENT');
            const count = this.count(s.id);
            if (count >= 200 || s.remaining - (count - s.ack) <= 50)
                throw new GatewayError('BUDGET_EXHAUSTED');
            if (Number(this.q('SELECT count(*) n FROM c_reservation WHERE at>?', now - 3600000)[0].n) >= 40)
                throw new GatewayError('RATE_LIMITED');
            const id = crypto.randomUUID();
            this.q("INSERT INTO c_reservation VALUES(?,?,?,?,'pending')", id, s.id, key, now);
            return id;
        });
    }
    async barrier() {
        if (this.failed || this.fault === 'sync') {
            this.failed = true;
            throw new GatewayError('UNAVAILABLE');
        }
        try {
            await this.storage.sync();
        }
        catch {
            this.failed = true;
            throw new GatewayError('UNAVAILABLE');
        }
    }
    finish(id: string, state: 'settled' | 'uncertain') {
        if (this.fault === 'finish') {
            this.failed = true;
            throw new GatewayError('UNAVAILABLE');
        }
        this.q('UPDATE c_reservation SET state=? WHERE id=?', state, id);
    }
    rate(key: string, now: number, max = 20) {
        this.storage.transactionSync(() => {
            this.q('DELETE FROM c_rate WHERE start<?', now - 60000);
            const r = this.q('SELECT start,n FROM c_rate WHERE k=?', key)[0];
            if (r && (now < Number(r.start) || Number(r.n) >= max))
                throw new GatewayError('RATE_LIMITED');
            this.q('INSERT INTO c_rate VALUES(?,?,1) ON CONFLICT(k) DO UPDATE SET n=n+1', key, r?.start ?? now);
        });
    }
    cacheGet(key: string, owner: string, now: number, op: 'identify' | 'compare') {
        this.q('DELETE FROM c_cache WHERE identity_end<=?', now);
        const r = this.q('SELECT * FROM c_cache WHERE k=? AND owner=?', key, owner)[0];
        if (!r || now < Number(r.at) || (op === 'compare' && Number(r.price_end) <= now))
            return null;
        try {
            return { data: JSON.parse(String(r.data)) as unknown, at: Number(r.at), commercialFresh: Number(r.price_end) > now };
        }
        catch {
            throw new GatewayError('UNAVAILABLE');
        }
    }
    cachePut(key: string, owner: string, data: unknown, now: number, identityTtl = 86400000, priceTtl = 900000) {
        const json = JSON.stringify(data), bytes = new TextEncoder().encode(json).length;
        if (bytes > 200000 || identityTtl <= 0 || identityTtl > 86400000 || priceTtl <= 0 || priceTtl > identityTtl)
            throw new GatewayError('INVALID_PROVIDER_DATA');
        this.storage.transactionSync(() => {
            this.q('DELETE FROM c_cache WHERE identity_end<=?', now);
            this.q('INSERT OR REPLACE INTO c_cache VALUES(?,?,?,?,?,?,?)', key, owner, json, now, now + identityTtl, now + priceTtl, bytes);
            while (Number(this.q('SELECT count(*) n FROM c_cache')[0].n) > 128 || Number(this.q('SELECT coalesce(sum(bytes),0) n FROM c_cache')[0].n) > 2000000)
                this.q('DELETE FROM c_cache WHERE k=(SELECT k FROM c_cache ORDER BY at,k LIMIT 1)');
        });
    }
    stats() {
        return { cacheEntries: Number(this.q('SELECT count(*) n FROM c_cache')[0].n), cacheBytes: Number(this.q('SELECT coalesce(sum(bytes),0) n FROM c_cache')[0].n), reserved: Number(this.q('SELECT count(*) n FROM c_reservation')[0].n), uncertain: Number(this.q("SELECT count(*) n FROM c_reservation WHERE state='uncertain'")[0].n), pending: Number(this.q("SELECT count(*) n FROM c_reservation WHERE state='pending'")[0].n), calls: Number(this.q('SELECT count(*) n FROM c_calls')[0].n), unreservedCalls: Number(this.q('SELECT count(*) n FROM c_calls c LEFT JOIN c_reservation r ON r.id=c.id WHERE r.id IS NULL OR c.reserved=0')[0].n), requests: Number(this.q('SELECT count(*) n FROM c_request')[0].n), reads: this.reads, writes: this.writes, blocked: !!this.cycle()?.blocked };
    }
}
