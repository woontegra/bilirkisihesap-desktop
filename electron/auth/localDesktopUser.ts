import type Database from "better-sqlite3";
import {
  LOCAL_SECURITY_QUESTIONS,
  localSecurityQuestionCode,
  normalizeDesktopUsername,
  normalizeLocalAnswer,
} from "../../shared/desktopAuthAccount";
import { hashLocalSecret, verifyLocalSecret } from "./localSecret";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type LocalUserRow = {
  id: number;
  ad_soyad: string;
  kullanici_adi: string;
  eposta: string | null;
  telefon: string | null;
  sifre_hash: string;
  guvenlik_sorusu_kodu: string;
  guvenlik_cevap_hash: string;
  aktif_mi: number;
};

export type LocalSetupInput = {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  securityQuestion: string;
  securityAnswer: string;
};

export function countLocalUsers(db: Database.Database): number {
  const row = db.prepare("SELECT COUNT(*) AS count FROM yerel_kullanici").get() as { count: number };
  return Number(row.count);
}

export function setupLocalUser(
  db: Database.Database,
  input: LocalSetupInput,
): { ok: true; username: string } | { ok: false; error: string } {
  if (countLocalUsers(db) > 0) return { ok: false, error: "İlk kurulum zaten tamamlandı." };
  const fullName = input.fullName.trim();
  const email = normalizeDesktopUsername(input.email);
  const question = localSecurityQuestionCode(input.securityQuestion);
  const answer = normalizeLocalAnswer(input.securityAnswer);
  if (!fullName || !email || !input.password || !question || !answer) {
    return { ok: false, error: "Lütfen tüm alanları doldurun." };
  }
  if (!EMAIL_PATTERN.test(email)) return { ok: false, error: "Geçerli bir e-posta adresi girin." };
  if (input.password.length < 6) return { ok: false, error: "Şifre en az 6 karakter olmalıdır." };
  const now = new Date().toISOString();
  try {
    db.prepare(
      `INSERT INTO yerel_kullanici (
        ad_soyad, kullanici_adi, eposta, telefon, sifre_hash, guvenlik_sorusu_kodu, guvenlik_cevap_hash, aktif_mi, kayit_tarihi
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    ).run(
      fullName,
      email,
      email,
      input.phone?.trim() || null,
      hashLocalSecret(input.password),
      question,
      hashLocalSecret(answer),
      now,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.toUpperCase().includes("UNIQUE")) return { ok: false, error: "Bu e-posta adresi zaten kayıtlı." };
    return { ok: false, error: "Hesap oluşturulamadı." };
  }
  return { ok: true, username: email };
}

export function findLocalUser(db: Database.Database, identity: string): LocalUserRow | undefined {
  const key = normalizeDesktopUsername(identity);
  if (!key) return undefined;
  return db
    .prepare(
      `SELECT id, ad_soyad, kullanici_adi, eposta, telefon, sifre_hash, guvenlik_sorusu_kodu, guvenlik_cevap_hash, aktif_mi
       FROM yerel_kullanici
       WHERE kullanici_adi = ? COLLATE NOCASE OR (eposta IS NOT NULL AND eposta = ? COLLATE NOCASE)`,
    )
    .get(key, key) as LocalUserRow | undefined;
}

export function loginLocalUser(
  db: Database.Database,
  identity: string,
  password: string,
): { ok: true; username: string } | { ok: false; error: string } {
  const user = findLocalUser(db, identity);
  if (!user || !user.aktif_mi) return { ok: false, error: "E-posta, kullanıcı adı veya şifre hatalı." };
  if (!verifyLocalSecret(password, user.sifre_hash)) {
    return { ok: false, error: "E-posta, kullanıcı adı veya şifre hatalı." };
  }
  return { ok: true, username: user.kullanici_adi };
}

export function localSecurityQuestion(
  db: Database.Database,
  identity: string,
): { ok: true; question: string } | { ok: false; error: string } {
  const user = findLocalUser(db, identity);
  if (!user || !user.aktif_mi) return { ok: false, error: "Kullanıcı bulunamadı." };
  const question = LOCAL_SECURITY_QUESTIONS[user.guvenlik_sorusu_kodu as keyof typeof LOCAL_SECURITY_QUESTIONS];
  if (!question) return { ok: false, error: "Bu hesap için güvenlik sorusu tanımlı değil." };
  return { ok: true, question };
}

export function resetLocalPassword(
  db: Database.Database,
  input: { identity: string; securityAnswer: string; newPassword: string },
): { ok: true } | { ok: false; error: string } {
  if (input.newPassword.length < 6) return { ok: false, error: "Yeni şifre en az 6 karakter olmalıdır." };
  const user = findLocalUser(db, input.identity);
  if (!user?.guvenlik_cevap_hash) return { ok: false, error: "Kullanıcı bulunamadı veya güvenlik cevabı tanımlı değil." };
  if (!verifyLocalSecret(normalizeLocalAnswer(input.securityAnswer), user.guvenlik_cevap_hash)) {
    return { ok: false, error: "Güvenlik cevabı hatalı." };
  }
  db.prepare("UPDATE yerel_kullanici SET sifre_hash = ? WHERE id = ?").run(hashLocalSecret(input.newPassword), user.id);
  return { ok: true };
}
