import type Database from "better-sqlite3";

export type Migration = {
  version: number;
  name: string;
  sql: string;
};

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "001_initial_schema",
    sql: `
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS calculation_records (
        id TEXT PRIMARY KEY NOT NULL,
        calculation_type TEXT NOT NULL,
        title TEXT NOT NULL,
        input_json TEXT NOT NULL DEFAULT '{}',
        result_json TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_calculation_records_updated
        ON calculation_records (archived_at, updated_at DESC);
    `,
  },
  {
    version: 2,
    name: "002_deposit_interest_rates",
    sql: `
      CREATE TABLE IF NOT EXISTS deposit_interest_rates (
        period TEXT PRIMARY KEY NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        rate REAL NOT NULL,
        source TEXT NOT NULL,
        currency TEXT NOT NULL,
        maturity TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 3,
    name: "003_local_desktop_user",
    sql: `
      CREATE TABLE IF NOT EXISTS yerel_kullanici (
        id INTEGER PRIMARY KEY,
        ad_soyad TEXT NOT NULL,
        kullanici_adi TEXT NOT NULL UNIQUE,
        eposta TEXT,
        telefon TEXT,
        sifre_hash TEXT NOT NULL,
        guvenlik_sorusu_kodu TEXT NOT NULL,
        guvenlik_cevap_hash TEXT NOT NULL,
        aktif_mi INTEGER NOT NULL DEFAULT 1,
        kayit_tarihi TEXT NOT NULL
      );
    `,
  },
  {
    version: 4,
    name: "004_calculation_folders",
    sql: `
      CREATE TABLE IF NOT EXISTS calculation_folders (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      ALTER TABLE calculation_records
        ADD COLUMN folder_id TEXT REFERENCES calculation_folders (id) ON DELETE SET NULL;

      CREATE INDEX IF NOT EXISTS idx_calculation_records_folder
        ON calculation_records (folder_id);
    `,
  },
];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db
      .prepare("SELECT version FROM schema_migrations")
      .all()
      .map((row) => Number((row as { version: number }).version)),
  );

  const insert = db.prepare(
    "INSERT INTO schema_migrations (version, name, applied_at) VALUES (@version, @name, @applied_at)",
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) {
      continue;
    }
    const apply = db.transaction(() => {
      db.exec(migration.sql);
      insert.run({
        version: migration.version,
        name: migration.name,
        applied_at: new Date().toISOString(),
      });
    });
    apply();
  }
}

export function getAppliedSchemaVersion(db: Database.Database): number | null {
  const row = db
    .prepare("SELECT MAX(version) AS version FROM schema_migrations")
    .get() as { version: number | null } | undefined;
  if (!row || row.version == null) {
    return null;
  }
  return Number(row.version);
}
