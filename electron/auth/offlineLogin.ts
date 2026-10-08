import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { normalizeDesktopUsername } from "../../shared/desktopAuthAccount";

const KEY_LENGTH = 32;

export type OfflineLoginRecord = {
  v: 1;
  username: string;
  salt: string;
  hash: string;
  deviceHash: string;
};

export function normalizeLoginName(username: string): string {
  return normalizeDesktopUsername(username);
}

export function createOfflineLoginRecord(username: string, password: string, deviceHash: string): OfflineLoginRecord {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return {
    v: 1,
    username: normalizeLoginName(username),
    salt: salt.toString("base64"),
    hash: hash.toString("base64"),
    deviceHash,
  };
}

export function offlinePasswordMatches(
  record: OfflineLoginRecord,
  username: string,
  password: string,
  deviceHash: string,
): boolean {
  if (record.v !== 1) return false;
  if (record.username !== normalizeLoginName(username)) return false;
  if (record.deviceHash !== deviceHash) return false;
  const expected = Buffer.from(record.hash, "base64");
  const actual = scryptSync(password, Buffer.from(record.salt, "base64"), expected.length);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
