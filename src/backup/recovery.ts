import type { Database } from '../data/migrations.ts';
import { catalogGate } from '../data/catalog-gate.ts';
import { readCatalog } from './database.ts';
import { canonicalCatalog, photoReferences, validatePhoto, readBackup, type Reader, type Hash } from './format.ts';
export type RestoreJournal = {
    version: 1;
    safety: string;
    before: string;
    after: string;
};
export function validateJournal(value: unknown): RestoreJournal { if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Registro de recuperação inválido.'); const j = value as Record<string, unknown>; if (Object.keys(j).sort().join() !== 'after,before,safety,version' || j.version !== 1 || typeof j.safety !== 'string' || !/^wish-before-restore-[a-f0-9-]{36}\.wishbackup$/.test(j.safety) || ![j.before, j.after].every(x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x)))
    throw Error('Registro de recuperação inválido.'); return value as RestoreJournal; }
export interface JournalStore {
    read(): Promise<unknown | null>;
    write(value: RestoreJournal): Promise<void>;
    clear(): Promise<void>;
}
// Only verified old/new catalogue states may resume after a durable restore marker.
// Unknown states keep both the marker and prestate copy and block normal mutations.
export async function recoverInterrupted(db: Database, files: {
    openSafety(name: string): Promise<Reader>;
    hash: Hash;
    readPhoto(ref: string): Promise<Uint8Array>;
    decodePhoto(ref: string, bytes: Uint8Array): Promise<void>;
    journal: JournalStore;
}) {
    const gate = catalogGate(db);
    try {
        const raw = await files.journal.read();
        if (raw === null)
            return 'none';
        const j = validateJournal(raw);
        const r = await files.openSafety(j.safety);
        let safety;
        try {
            safety = await readBackup(r, files.hash, files.decodePhoto);
        }
        finally {
            await r.close();
        }
        if (await files.hash(new TextEncoder().encode(canonicalCatalog(safety.catalog))) !== j.before)
            throw Error('Cópia anterior divergente.');
        const catalog = await readCatalog(db), hash = await files.hash(new TextEncoder().encode(canonicalCatalog(catalog)));
        if (hash !== j.before && hash !== j.after)
            throw Error('Catálogo divergente.');
        for (const ref of photoReferences(catalog)) {
            const bytes = await files.readPhoto(ref);
            await validatePhoto(ref, bytes, files.hash);
            await files.decodePhoto(ref, bytes);
        }
        await files.journal.clear();
        gate.update({ result: hash === j.after ? 'Restauração confirmada após reinício. Cópia anterior: ' + j.safety : 'Interrupção recuperada: o catálogo anterior foi preservado. Cópia: ' + j.safety, fault: '' });
        return hash === j.after ? 'restored' : 'previous';
    }
    catch {
        gate.quarantine();
        return 'blocked';
    }
}
