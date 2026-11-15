export interface Database {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
export const defaultCategories = [
  ['c915bd16-02ef-4bbd-9de9-04c431012001', 'Casa'],
  ['c915bd16-02ef-4bbd-9de9-04c431012002', 'Tecnologia'],
  ['c915bd16-02ef-4bbd-9de9-04c431012003', 'Roupas'],
];
export async function migrate(db: Database) {
  await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((version?.user_version ?? 0) > 3) throw new Error('Este banco foi criado por uma versão mais recente do Wish. Atualize o aplicativo.');
  if ((version?.user_version ?? 0) === 0) {
    // Runs before screens mount, so no other query can join this transaction.
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE categories (
          id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL COLLATE NOCASE UNIQUE,
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
        );
        CREATE TABLE products (
          id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL CHECK(length(trim(name)) > 0),
          description TEXT NOT NULL DEFAULT '', category_id TEXT NOT NULL REFERENCES categories(id),
          priority TEXT NOT NULL CHECK(priority IN ('low','medium','high')),
          image_url TEXT NOT NULL DEFAULT '',
          price_cents INTEGER CHECK(price_cents IS NULL OR price_cents >= 0),
          desired_price_cents INTEGER CHECK(desired_price_cents IS NULL OR desired_price_cents >= 0),
          store TEXT NOT NULL DEFAULT '', original_url TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','purchased')),
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
        );
        CREATE INDEX products_category_status ON products(category_id, status) WHERE deleted_at IS NULL;
        CREATE INDEX products_created ON products(created_at) WHERE deleted_at IS NULL;
      `);
      const now = new Date().toISOString();
      for (const [id, name] of defaultCategories) await db.runAsync('INSERT INTO categories(id,name,created_at,updated_at) VALUES (?,?,?,?)', id, name, now, now);
      await db.execAsync('PRAGMA user_version = 1');
    });
  }
  if ((version?.user_version ?? 0) < 2) {
    await db.withTransactionAsync(async () => {
      await db.execAsync('CREATE TABLE app_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL); PRAGMA user_version = 2;');
    });
  }
  if ((version?.user_version ?? 0) < 3) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE sync_state (
          id INTEGER PRIMARY KEY CHECK(id=1), owner_id TEXT, backend TEXT,
          enabled INTEGER NOT NULL DEFAULT 0, cursor INTEGER NOT NULL DEFAULT 0,
          upper_cursor INTEGER, last_success TEXT, retry_count INTEGER NOT NULL DEFAULT 0,
          retry_at INTEGER NOT NULL DEFAULT 0, last_error TEXT, initial_complete INTEGER NOT NULL DEFAULT 0
        );
        INSERT INTO sync_state(id) VALUES (1);
        CREATE TABLE sync_versions (kind TEXT NOT NULL, entity_id TEXT NOT NULL, server_version INTEGER NOT NULL DEFAULT 0, local_revision INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(kind,entity_id));
        CREATE TABLE sync_outbox (
          seq INTEGER PRIMARY KEY AUTOINCREMENT, op_id TEXT NOT NULL UNIQUE,
          kind TEXT NOT NULL CHECK(kind IN ('category','product')), entity_id TEXT NOT NULL,
          payload TEXT NOT NULL, local_revision INTEGER NOT NULL, base_version INTEGER,
          attempted INTEGER NOT NULL DEFAULT 0, priority INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX sync_outbox_entity ON sync_outbox(kind,entity_id,seq);
        CREATE TABLE sync_inbox (seq INTEGER PRIMARY KEY, payload TEXT NOT NULL);
        CREATE TABLE sync_conflicts (
          id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, entity_id TEXT NOT NULL,
          related_id TEXT, local_payload TEXT, remote_payload TEXT NOT NULL,
          type TEXT NOT NULL, created_at TEXT NOT NULL, resolved_at TEXT
        );
        CREATE UNIQUE INDEX sync_conflicts_open ON sync_conflicts(kind,entity_id) WHERE resolved_at IS NULL;
        CREATE TABLE sync_archive (id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, entity_id TEXT NOT NULL, payload TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL);
        PRAGMA user_version = 3;
      `);
    });
  }
}
