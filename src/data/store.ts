import type { Database } from './migrations.ts';
export type ChangeReason = 'catalog' | 'sync' | 'settings';
export interface LocalStore {
  read<T>(task: (db: Database) => Promise<T>): Promise<T>;
  write<T>(task: (db: Database) => Promise<T>, reason?: ChangeReason): Promise<T>;
  subscribe(listener: (reason: ChangeReason) => void): () => void;
}
const stores = new WeakMap<object, LocalStore>();
// All callers on a connection share one lane. Transaction callbacks use the raw connection,
// never reenter this queue; UI writes cannot accidentally join a sync transaction.
export function localStore(db: Database): LocalStore {
  const existing = stores.get(db); if (existing) return existing;
  let tail: Promise<unknown> = Promise.resolve();
  const listeners = new Set<(reason: ChangeReason) => void>();
  function lane<T>(task: () => Promise<T>): Promise<T> {
    const next = tail.then(task); tail = next.catch(() => {}); return next;
  }
  const store: LocalStore = {
    read: task => lane(() => task(db)),
    write: (task, reason = 'sync') => lane(async () => {
      let result: unknown;
      await db.withTransactionAsync(async () => { result = await task(db); });
      for (const listener of listeners) { try { listener(reason); } catch { /* A view cannot undo a committed write. */ } }
      return result as never;
    }),
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
  stores.set(db, store); return store;
}
