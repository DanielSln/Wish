import type { JournalStore } from './recovery.ts';
import type { Database } from '../data/migrations.ts';
import { catalogGate } from '../data/catalog-gate.ts';
import { snapshotCatalog, replaceCatalog, assertCatalog } from './database.ts';
import { planBackup, readBackup, writeBackup, checkCancelled, canonicalCatalog, type Catalog, type Reader, type Writer, type Hash, type Operation, type Manifest } from './format.ts';
export interface BackupFiles {
    openSafety(name: string): Promise<Reader>;
    journal: JournalStore;
    hash: Hash;
    decodePhoto(ref: string, bytes: Uint8Array): Promise<void>;
    readPhoto(ref: string): Promise<Uint8Array>;
    installPhoto(ref: string, bytes: Uint8Array): Promise<void>;
    createSafety(): Promise<{
        name: string;
        writer: Writer;
        reader: () => Promise<Reader>;
        commit: () => Promise<void>;
    }>;
    checkSpace(bytes: number): Promise<void>;
}
export async function withReader<T>(reader: Reader, action: (reader: Reader) => Promise<T>) { try {
    return await action(reader);
}
finally {
    await reader.close();
} }
export async function exportCatalog(db: Database, files: BackupFiles, destination: () => Promise<{
    writer: Writer;
    reader: () => Promise<Reader>;
}>, op: Operation = {}) { return catalogGate(db).exclusive('Preparando backup…', async () => { const catalog = await snapshotCatalog(db), plan = await planBackup(catalog, files.readPhoto, files.hash, op); await files.checkSpace(plan.size); checkCancelled(op); const output = await destination(); try {
    await writeBackup(plan, output.writer, files.readPhoto, files.hash, op);
}
finally {
    await output.writer.close();
} op.progress?.('Verificando arquivo salvo…'); const checked = await withReader(await output.reader(), r => readBackup(r, files.hash, files.decodePhoto, op)); if (JSON.stringify(checked.manifest) !== JSON.stringify(plan.manifest))
    throw Error('Arquivo salvo não corresponde ao backup.'); return { catalog, manifest: plan.manifest }; }); }
export async function safetyBackup(catalog: Catalog, files: BackupFiles, op: Operation) { const plan = await planBackup(catalog, files.readPhoto, files.hash, op); await files.checkSpace(plan.size * 2); const safety = await files.createSafety(); try {
    await writeBackup(plan, safety.writer, files.readPhoto, files.hash, op);
}
finally {
    await safety.writer.close();
} const checked = await withReader(await safety.reader(), r => readBackup(r, files.hash, undefined, op)); if (JSON.stringify(checked.manifest) !== JSON.stringify(plan.manifest))
    throw Error('Cópia de segurança não confirmada.'); await safety.commit(); const persisted = await withReader(await safety.reader(), r => readBackup(r, files.hash, files.decodePhoto, op)); if (JSON.stringify(persisted.manifest) !== JSON.stringify(plan.manifest))
    throw Error('Cópia de segurança persistente não confirmada.'); return safety.name; }
// Validate twice and retain an independently verified prestate before replacing rows.
// Photo references are immutable hashes: install first, never delete existing photos.
export async function restoreFromStaged(db: Database, files: BackupFiles, open: () => Promise<Reader>, op: Operation = {}, expected?: Manifest) {
    const gate = catalogGate(db);
    return gate.exclusive('Validando backup…', async () => {
        const checked = await withReader(await open(), r => readBackup(r, files.hash, files.decodePhoto, op));
        if (expected && JSON.stringify(checked.manifest) !== JSON.stringify(expected))
            throw Error('O arquivo mudou após a prévia. Selecione novamente.');
        const before = await snapshotCatalog(db);
        op.progress?.('Criando cópia de segurança…');
        const safety = await safetyBackup(before, files, op);
        await files.checkSpace(checked.manifest.photos.reduce((n, p) => n + p.bytes, 0));
        const second = await withReader(await open(), r => readBackup(r, files.hash, files.installPhoto, op));
        if (JSON.stringify(second.manifest) !== JSON.stringify(checked.manifest))
            throw Error('O arquivo mudou durante a restauração.');
        checkCancelled(op);
        op.progress?.('Restaurando catálogo…');
        try {
            await files.journal.write({ version: 1, safety, before: await files.hash(new TextEncoder().encode(canonicalCatalog(before))), after: await files.hash(new TextEncoder().encode(canonicalCatalog(checked.catalog))) });
            checkCancelled(op);
            await replaceCatalog(db, checked.catalog, op, () => { gate.update({ cancellable: false, message: 'Concluindo restauração…' }); });
            await assertCatalog(db, checked.catalog);
            await files.journal.clear();
            gate.update({ fault: '', result: 'Catálogo restaurado. Cópia anterior: ' + safety });
            gate.changed();
            return { safety, manifest: checked.manifest };
        }
        catch (error) {
            try {
                await assertCatalog(db, before);
            }
            catch {
                try {
                    await replaceCatalog(db, before);
                    await assertCatalog(db, before);
                }
                catch {
                    gate.quarantine();
                    throw Error('Recuperação não confirmada. A cópia anterior foi preservada: ' + safety + '. Não limpe os dados.');
                }
            }
            try {
                await files.journal.clear();
            }
            catch {
                gate.quarantine();
                throw Error('Registro de recuperação não confirmado. A cópia anterior foi preservada: ' + safety);
            }
            throw error;
        }
    });
}
