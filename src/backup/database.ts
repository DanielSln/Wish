import type { Database } from '../data/migrations.ts';
import { canonicalCatalog, categoryColumns, productColumns, offerColumns, validateCatalog, checkCancelled, yieldWork, type Catalog, type Operation } from './format.ts';
export async function checkDatabase(db: Database) { const v = await db.getFirstAsync<{
    user_version: number;
}>('PRAGMA user_version'); if (v?.user_version !== 5)
    throw Error('Backup requer SQLite v5. Não há migração ou downgrade automático.'); const integrity = await db.getAllAsync<Record<string, string>>('PRAGMA integrity_check'); if (integrity.length !== 1 || Object.values(integrity[0])[0] !== 'ok' || (await db.getAllAsync('PRAGMA foreign_key_check')).length)
    throw Error('Não foi possível confirmar a integridade do catálogo.'); }
export async function readCatalog(db: Database): Promise<Catalog> {
    await checkDatabase(db);
    const select = (table: string, columns: readonly string[]) => db.getAllAsync(`SELECT ${columns.join(',')} FROM ${table} ORDER BY id`);
    return validateCatalog({ categories: await select('categories', categoryColumns), products: await select('products', productColumns), offers: await select('product_offers', offerColumns), settings: await db.getAllAsync("SELECT key,value FROM app_settings WHERE key='appearance'") });
}
// A read transaction sees one SQLite/WAL snapshot; no live database file is copied.
export async function snapshotCatalog(db: Database) { let result: Catalog | undefined; await db.withTransactionAsync(async () => { result = await readCatalog(db); }); return result!; }
export async function assertCatalog(db: Database, expected: Catalog) { const actual = await readCatalog(db); if (canonicalCatalog(actual) !== canonicalCatalog(expected))
    throw Error('A verificação do catálogo restaurado falhou.'); }
export async function replaceCatalog(db: Database, catalog: Catalog, op: Operation = {}, beforeCommit: () => void = () => { }) {
    await validateCatalog(catalog, op);
    await checkDatabase(db);
    await db.withTransactionAsync(async () => {
        checkCancelled(op);
        await db.execAsync("DELETE FROM product_offers; DELETE FROM products; DELETE FROM categories; DELETE FROM app_settings WHERE key='appearance';");
        for (const [table, columns, rows] of [['categories', categoryColumns, catalog.categories], ['products', productColumns, catalog.products], ['product_offers', offerColumns, catalog.offers], ['app_settings', ['key', 'value'], catalog.settings]] as const) {
            let i = 0;
            for (const row of rows) {
                checkCancelled(op);
                const record = row as unknown as Record<string, string | number | null>;
                await db.runAsync(`INSERT INTO ${table}(${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, ...columns.map(k => record[k]));
                if (++i % 100 === 0) {
                    op.progress?.('Restaurando registros…');
                    await yieldWork();
                }
            }
        }
        await assertCatalog(db, catalog);
        checkCancelled(op);
        beforeCommit();
    });
}
