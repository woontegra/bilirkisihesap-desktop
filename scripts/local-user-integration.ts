import { createRequire } from "node:module";
import path from "node:path";
import type BetterSqlite3 from "better-sqlite3";
import { runMigrations } from "../electron/db/migrations";
import { loginLocalUser, resetLocalPassword, setupLocalUser } from "../electron/auth/localDesktopUser";

const require = createRequire(path.join(process.cwd(), "package.json"));
const Sqlite = require("better-sqlite3") as typeof BetterSqlite3;
const db = new Sqlite(":memory:");
runMigrations(db);

const calculations = db.prepare("SELECT COUNT(*) AS count FROM calculation_records").get() as { count: number };
if (calculations.count !== 0) throw new Error("calculation rows changed");

const account = {
  fullName: "Test Kullanici",
  email: "kullanici@example.com",
  phone: "+905550000000",
  password: "gizli123",
  securityQuestion: "G1",
  securityAnswer: "Ornek",
};
const created = setupLocalUser(db, account);
if (!created.ok) throw new Error(created.error);
if (setupLocalUser(db, account).ok) throw new Error("second account was created");
if (loginLocalUser(db, "kullanici@example.com", "yanlis").ok) throw new Error("wrong password accepted");
if (!loginLocalUser(db, "KULLANICI@example.com", "gizli123").ok) throw new Error("email login failed");
if (resetLocalPassword(db, { identity: "kullanici@example.com", securityAnswer: "yanlis", newPassword: "yeni1234" }).ok) {
  throw new Error("wrong answer reset the password");
}
const reset = resetLocalPassword(db, { identity: "kullanici@example.com", securityAnswer: "ornek", newPassword: "yeni1234" });
if (!reset.ok) throw new Error(reset.error);
if (loginLocalUser(db, "kullanici@example.com", "gizli123").ok) throw new Error("old password still works");
if (!loginLocalUser(db, "kullanici@example.com", "yeni1234").ok) throw new Error("new password failed");
const after = db.prepare("SELECT COUNT(*) AS count FROM calculation_records").get() as { count: number };
if (after.count !== 0) throw new Error("calculation row was inserted");
console.log("local-user-integration-ok");
