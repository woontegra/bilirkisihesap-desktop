import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { holder } = vi.hoisted(() => ({ holder: { db: null as unknown } }));

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: () => null },
  dialog: {},
  app: { getPath: () => "/tmp" },
}));

vi.mock("../db/database", () => ({
  getDatabase: () => holder.db,
}));

import { MIGRATIONS, runMigrations } from "../db/migrations";
import {
  createCalculationRecord,
  getCalculationRecord,
  listCalculationRecords,
  updateCalculationRecord,
  archiveCalculationRecord,
} from "../db/calculationRecordsRepository";
import {
  createCalculationFolder,
  deleteCalculationFolder,
  listCalculationFolders,
  moveCalculationRecordsToFolder,
  renameCalculationFolder,
} from "../db/calculationFoldersRepository";
import { createBackupFile, parseBackupFile, type BackupPayload } from "./bhbackupFormat";
import { buildBackupPayload, restoreBackupCases } from "./savedCasesBackup";

/** better-sqlite3 Electron için derlendiğinden testte aynı API'yi node:sqlite ile sağlar. */
function adapt(raw: DatabaseSync) {
  return {
    raw,
    exec: (sql: string) => raw.exec(sql),
    prepare: (sql: string) => {
      const statement = raw.prepare(sql);
      statement.setAllowUnknownNamedParameters(true);
      return {
        run: (...args: never[]) => statement.run(...args),
        get: (...args: never[]) => statement.get(...args),
        all: (...args: never[]) => statement.all(...args),
      };
    },
    transaction:
      <A extends unknown[], R>(fn: (...args: A) => R) =>
      (...args: A): R => {
        raw.exec("BEGIN");
        try {
          const result = fn(...args);
          raw.exec("COMMIT");
          return result;
        } catch (error) {
          raw.exec("ROLLBACK");
          throw error;
        }
      },
  };
}

type TestDb = ReturnType<typeof adapt>;

function openDb(): TestDb {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON");
  const db = adapt(raw);
  holder.db = db;
  return db;
}

/** 3.6.4 sürümündeki şema: migration 1–3, klasör yok. */
function openLegacyDb(): TestDb {
  const db = openDb();
  db.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, applied_at TEXT NOT NULL)");
  for (const migration of MIGRATIONS.filter((m) => m.version <= 3)) {
    db.exec(migration.sql);
    db.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)").run(
      migration.version as never,
      migration.name as never,
      "2026-10-01T00:00:00.000Z" as never,
    );
  }
  return db;
}

function insertLegacyRecord(db: TestDb, id: string, title: string, type: string, archived = false): void {
  db.prepare(
    `INSERT INTO calculation_records (id, calculation_type, title, input_json, result_json, notes, created_at, updated_at, archived_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
  ).run(
    id as never,
    type as never,
    title as never,
    JSON.stringify({ iseGirisTarihi: "2020-01-01", istenCikisTarihi: "2025-01-01", brut: 50000 }) as never,
    JSON.stringify({ net: 123456.78 }) as never,
    "2026-09-01T10:00:00.000Z" as never,
    "2026-09-01T10:00:00.000Z" as never,
    (archived ? "2026-09-02T10:00:00.000Z" : null) as never,
  );
}

const LEGACY_A = "11111111-1111-4111-8111-111111111111";
const LEGACY_B = "22222222-2222-4222-8222-222222222222";
const LEGACY_ARCHIVED = "33333333-3333-4333-8333-333333333333";

function seedLegacy(): TestDb {
  const db = openLegacyDb();
  insertLegacyRecord(db, LEGACY_A, "Eski kıdem kaydı", "kidem-tazminati");
  insertLegacyRecord(db, LEGACY_B, "Eski ihbar kaydı", "ihbar-tazminati");
  insertLegacyRecord(db, LEGACY_ARCHIVED, "Silinmiş kayıt", "ubgt", true);
  runMigrations(db as never);
  return db;
}

describe("004 klasör migration'ı ve eski kayıtlar", () => {
  let db: TestDb;
  beforeEach(() => {
    db = seedLegacy();
  });

  it("şemayı ekleyerek yükseltir, eski kayıtlar eksiksiz ve klasörsüz görünür", () => {
    const versions = (db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as { version: number }[]).map(
      (r) => r.version,
    );
    expect(versions).toEqual([1, 2, 3, 4]);
    const records = listCalculationRecords();
    expect(records.map((r) => r.id).sort()).toEqual([LEGACY_A, LEGACY_B]);
    expect(records.every((r) => r.folderId === null)).toBe(true);
    const total = db.prepare("SELECT COUNT(*) AS n FROM calculation_records").get() as { n: number };
    expect(total.n).toBe(3);
  });

  it("eski kayıt içeriği bozulmadan açılır", () => {
    const record = getCalculationRecord(LEGACY_A);
    expect(record.title).toBe("Eski kıdem kaydı");
    expect(record.inputJson).toEqual({ iseGirisTarihi: "2020-01-01", istenCikisTarihi: "2025-01-01", brut: 50000 });
    expect(record.resultJson).toEqual({ net: 123456.78 });
  });

  it("migration tekrar çalıştırılınca bir şey değişmez", () => {
    runMigrations(db as never);
    expect(listCalculationRecords()).toHaveLength(2);
  });
});

describe("klasör yönetimi", () => {
  beforeEach(() => {
    seedLegacy();
  });

  it("oluşturur, Türkçe büyük/küçük harf duyarsız tekrarı reddeder, yeniden adlandırır", () => {
    const folder = createCalculationFolder("  İşçi   Dosyaları ");
    expect(folder.name).toBe("İşçi Dosyaları");
    expect(() => createCalculationFolder("işçi dosyaları")).toThrow("zaten var");
    expect(() => createCalculationFolder("   ")).toThrow();
    expect(() => createCalculationFolder("x".repeat(81))).toThrow();
    const other = createCalculationFolder("Arşiv");
    expect(() => renameCalculationFolder(other.id, "İŞÇİ DOSYALARI")).toThrow("zaten var");
    const renamed = renameCalculationFolder(folder.id, "Müvekkil A");
    expect(renamed.name).toBe("Müvekkil A");
    expect(listCalculationFolders().map((f) => f.name)).toEqual(["Arşiv", "Müvekkil A"]);
  });

  it("eski kaydı klasöre taşır, içerik ve sıralama tarihi değişmez", () => {
    const before = getCalculationRecord(LEGACY_A);
    const folder = createCalculationFolder("Dava 2026");
    expect(moveCalculationRecordsToFolder([LEGACY_A, LEGACY_B], folder.id)).toEqual({ moved: 2 });
    const after = getCalculationRecord(LEGACY_A);
    expect(after.folderId).toBe(folder.id);
    expect(after.updatedAt).toBe(before.updatedAt);
    expect(after.inputJson).toEqual(before.inputJson);
    expect(after.resultJson).toEqual(before.resultJson);
    expect(moveCalculationRecordsToFolder([LEGACY_A], null)).toEqual({ moved: 1 });
    expect(getCalculationRecord(LEGACY_A).folderId).toBeNull();
  });

  it("arşivlenmiş kaydı taşımaz, bilinmeyen klasöre taşımayı reddeder", () => {
    const folder = createCalculationFolder("Dava");
    expect(moveCalculationRecordsToFolder([LEGACY_ARCHIVED], folder.id)).toEqual({ moved: 0 });
    expect(() => moveCalculationRecordsToFolder([LEGACY_A], "99999999-9999-4999-8999-999999999999")).toThrow(
      "Klasör bulunamadı",
    );
    expect(() => moveCalculationRecordsToFolder(["../x"], null)).toThrow();
  });

  it("klasör silinince içindeki hesaplamalar silinmez, klasörsüz olur", () => {
    const folder = createCalculationFolder("Silinecek");
    moveCalculationRecordsToFolder([LEGACY_A, LEGACY_B], folder.id);
    expect(deleteCalculationFolder(folder.id)).toEqual({ id: folder.id, releasedRecords: 2 });
    const records = listCalculationRecords();
    expect(records).toHaveLength(2);
    expect(records.every((r) => r.folderId === null)).toBe(true);
    expect(getCalculationRecord(LEGACY_A).title).toBe("Eski kıdem kaydı");
    expect(listCalculationFolders()).toHaveLength(0);
  });

  it("Kaydet akışındaki güncelleme klasörü korur, yeni kayıt klasörsüz başlar", () => {
    const folder = createCalculationFolder("Dava");
    moveCalculationRecordsToFolder([LEGACY_A], folder.id);
    updateCalculationRecord(LEGACY_A, { title: "Güncellendi", inputJson: { brut: 1 }, resultJson: { net: 2 } });
    expect(getCalculationRecord(LEGACY_A).folderId).toBe(folder.id);
    const created = createCalculationRecord({ calculationType: "fazla-mesai", title: "Yeni", inputJson: {} });
    expect(created.folderId).toBeNull();
    expect(getCalculationRecord(created.id).folderId).toBeNull();
  });

  it("kayıt silme (arşivleme) klasörü etkilemez", () => {
    const folder = createCalculationFolder("Dava");
    moveCalculationRecordsToFolder([LEGACY_A, LEGACY_B], folder.id);
    archiveCalculationRecord(LEGACY_A);
    expect(listCalculationRecords().map((r) => r.id)).toEqual([LEGACY_B]);
    expect(listCalculationFolders()).toHaveLength(1);
  });
});

describe("yedekleme ve geri yükleme", () => {
  it("klasörleri yedekler ve geri yükler; boş klasör de geri gelir", () => {
    seedLegacy();
    const dava = createCalculationFolder("Dava 2026");
    createCalculationFolder("Boş klasör");
    moveCalculationRecordsToFolder([LEGACY_A], dava.id);

    const payload = buildBackupPayload(listCalculationRecords(), listCalculationFolders());
    const parsed = parseBackupFile(createBackupFile(payload));
    expect(parsed.meta.version).toBe(1);

    openDb();
    runMigrations(holder.db as never);
    expect(restoreBackupCases(parsed)).toEqual({ imported: 2, skipped: 0 });

    const folders = listCalculationFolders();
    expect(folders.map((f) => f.name)).toEqual(["Boş klasör", "Dava 2026"]);
    const restored = listCalculationRecords();
    const kidem = restored.find((r) => r.title === "Eski kıdem kaydı");
    const ihbar = restored.find((r) => r.title === "Eski ihbar kaydı");
    expect(kidem?.folderId).toBe(folders.find((f) => f.name === "Dava 2026")?.id);
    expect(ihbar?.folderId).toBeNull();
    expect(kidem?.resultJson).toEqual({ net: 123456.78 });
  });

  it("eski (klasörsüz) yedek eksiksiz ve klasörsüz yüklenir", () => {
    openDb();
    runMigrations(holder.db as never);
    const legacyBackup: BackupPayload = {
      meta: { app: "bilirkisihesap-desktop", version: 1, createdAt: "2026-09-01T00:00:00.000Z", totalCases: 2 },
      cases: [
        { name: "Eski 1", type: "kidem-tazminati", data: { form: { brut: 1 }, results: { net: 1 } } },
        { name: "Eski 2", type: "ihbar-tazminati", data: { formValues: { brut: 2 }, results: { net: 2 } } },
      ],
    };
    expect(restoreBackupCases(parseBackupFile(createBackupFile(legacyBackup)))).toEqual({ imported: 2, skipped: 0 });
    expect(listCalculationRecords().every((r) => r.folderId === null)).toBe(true);
    expect(listCalculationFolders()).toHaveLength(0);
  });

  it("aynı adlı mevcut klasörle birleştirir, mevcut kayıtları silmez", () => {
    seedLegacy();
    const existing = createCalculationFolder("Dava 2026");
    moveCalculationRecordsToFolder([LEGACY_B], existing.id);
    const backup: BackupPayload = {
      meta: { app: "bilirkisihesap-desktop", version: 1, createdAt: "2026-10-01T00:00:00.000Z", totalCases: 1 },
      cases: [{ name: "Yedekten", type: "ubgt", folder: "dava 2026", data: { form: {}, results: null } }],
      folders: [{ name: "dava 2026" }, { name: "" }, { name: "x".repeat(200) }],
    };
    expect(restoreBackupCases(backup)).toEqual({ imported: 1, skipped: 0 });
    expect(listCalculationFolders().map((f) => f.id)).toEqual([existing.id]);
    const records = listCalculationRecords();
    expect(records).toHaveLength(3);
    expect(records.find((r) => r.title === "Yedekten")?.folderId).toBe(existing.id);
    expect(getCalculationRecord(LEGACY_B).folderId).toBe(existing.id);
  });

  it("yeni yedek eski sürümün okuduğu alanları aynen taşır", () => {
    seedLegacy();
    const payload = buildBackupPayload(listCalculationRecords(), []);
    for (const item of payload.cases) {
      expect(typeof item.name).toBe("string");
      expect(typeof item.type).toBe("string");
      expect(item.data).toMatchObject({ form: expect.any(Object), results: expect.any(Object) });
      expect(item.folder).toBeNull();
    }
  });
});
