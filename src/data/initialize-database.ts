import {backupPlatform} from '@/backup/platform';
import {recoverInterrupted} from '@/backup/recovery';
import { backupDatabaseAsync, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { migrate } from './migrations';
import { copyVerifiedDatabase, type SnapshotDriver } from './database-snapshot';
const driver: SnapshotDriver = {
  open: name => openDatabaseAsync(name,{useNewConnection:true}),
  copy: (source,destination) => backupDatabaseAsync({sourceDatabase:source as SQLiteDatabase,destDatabase:destination as SQLiteDatabase}),
  close: database => (database as SQLiteDatabase).closeAsync(),
};
export async function initializeDatabase(db: SQLiteDatabase) {
  await migrate(db, () => copyVerifiedDatabase(db,driver,'wish-pre-v5-'+randomUUID()+'.db'));
  await recoverInterrupted(db,backupPlatform.files);
}
// Maintenance only: creates a separate recovery DB, never swaps wish.db automatically.
// Requires owner's restoration decision and closed catalogue connections.
export async function prepareRecoveryCopy(snapshotName: string) {
  if (!/^wish-pre-v5-[a-f0-9-]{36}\.db$/.test(snapshotName)) throw new Error('Nome de backup inválido.');
  const snapshot = await openDatabaseAsync(snapshotName,{useNewConnection:true});
  try {
    const version = await snapshot.getFirstAsync<{user_version:number}>('PRAGMA user_version');
    if (![1,2,4].includes(version?.user_version ?? 0)) throw new Error('Backup anterior à v5 não encontrado.');
    return await copyVerifiedDatabase(snapshot,driver,'wish-recovery-'+randomUUID()+'.db');
  } finally { await snapshot.closeAsync(); }
}
