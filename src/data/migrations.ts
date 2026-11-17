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
  if ((version?.user_version ?? 0) > 4) throw new Error('Este banco foi criado por uma versão mais recente do Wish. Atualize o aplicativo.');
  if (version?.user_version === 3) throw new Error('Este banco pertence a outra versão de desenvolvimento. Preserve os dados e abra a versão que o criou; não há downgrade automático.');
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
  // Version 3 is reserved by the separate Supabase branch. Never reinterpret its database.
  if ((version?.user_version ?? 0) < 4) {
    await db.withTransactionAsync(async () => {
      await db.execAsync("ALTER TABLE products ADD COLUMN personal_notes TEXT NOT NULL DEFAULT ''; ALTER TABLE products ADD COLUMN offer_details TEXT NOT NULL DEFAULT ''; PRAGMA user_version = 4;");
    });
  }
}
