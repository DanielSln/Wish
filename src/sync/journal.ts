import type { Database } from '../data/migrations.ts';
import type { Kind, RecordData } from './types.ts';
export type SyncState = { owner_id: string | null; backend: string | null; enabled: number; cursor: number; upper_cursor: number | null; last_success: string | null; retry_count: number; retry_at: number; last_error: string | null; initial_complete: number };
export const state = (db: Database) => db.getFirstAsync<SyncState>('SELECT * FROM sync_state WHERE id=1');
export const tableFor = (kind: Kind) => kind === 'category' ? 'categories' : 'products';
export const snapshot = (db: Database, kind: Kind, id: string) => db.getFirstAsync<RecordData>(`SELECT * FROM ${tableFor(kind)} WHERE id=?`, id);
export async function enqueue(db: Database, kind: Kind, id: string, uuid: () => string, priority = 0) {
  const row = await snapshot(db, kind, id); if (!row) return;
  await db.runAsync('INSERT INTO sync_versions(kind,entity_id,server_version,local_revision) VALUES (?,?,0,1) ON CONFLICT(kind,entity_id) DO UPDATE SET local_revision=local_revision+1', kind,id);
  if (!(await state(db))?.owner_id) return; // Guest data stays local; consent snapshots it later.
  const version = await db.getFirstAsync<{ local_revision: number }>('SELECT local_revision FROM sync_versions WHERE kind=? AND entity_id=?',kind,id);
  await db.runAsync('INSERT INTO sync_outbox(op_id,kind,entity_id,payload,local_revision,priority) VALUES (?,?,?,?,?,?)',uuid(),kind,id,JSON.stringify(row),version!.local_revision,priority);
}
export async function archive(db: Database, kind: Kind, row: RecordData, reason: string, now: string, uuid: () => string) {
  await db.runAsync('INSERT INTO sync_archive(id,kind,entity_id,payload,reason,created_at) VALUES (?,?,?,?,?,?)',uuid(),kind,row.id,JSON.stringify(row),reason,now);
}
