import type { Database } from './migrations.ts';
export interface SnapshotDriver {
  open(name: string): Promise<Database>;
  copy(source: Database, destination: Database): Promise<void>;
  close(database: Database): Promise<void>;
}
// Always copy to a blank destination; never replace a live catalogue or prior snapshot.
export async function copyVerifiedDatabase(source: Database, driver: SnapshotDriver, name: string) {
  const destination = await driver.open(name);
  try {
    const existing = await destination.getFirstAsync<{ count: number }>("SELECT count(*) AS count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    if (existing?.count) throw new Error('O destino já contém dados; nenhuma cópia foi realizada.');
    const version = await source.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    await driver.copy(source,destination);
    const checks = await destination.getAllAsync<Record<string,string>>('PRAGMA integrity_check');
    const copiedVersion = await destination.getFirstAsync<{user_version:number}>('PRAGMA user_version');
    if (checks.length !== 1 || Object.values(checks[0])[0] !== 'ok' || copiedVersion?.user_version !== version?.user_version) throw new Error('Não foi possível verificar a cópia do banco.');
    for (const table of ['products','categories']) {
      const original = await source.getFirstAsync<{count:number}>(`SELECT count(*) AS count FROM ${table}`);
      const copied = await destination.getFirstAsync<{count:number}>(`SELECT count(*) AS count FROM ${table}`);
      if (original?.count !== copied?.count) throw new Error('A cópia do catálogo está incompleta.');
    }
    return name;
  } finally { await driver.close(destination); }
}
