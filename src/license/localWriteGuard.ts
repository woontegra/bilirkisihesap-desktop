import { isProtectedCalculationStorageKey } from "./licenseAccess";

const BLOCKED_MESSAGE = "Geçerli lisans olmadan kayıt yapılamaz.";

let writesAllowed = false;
let installed = false;

export function areLicensedLocalWritesAllowed(): boolean {
  return writesAllowed;
}

export function setLicensedLocalWritesAllowed(allowed: boolean): void {
  writesAllowed = allowed;
}

export function installLicensedLocalWriteGuard(): void {
  if (installed || typeof localStorage === "undefined" || typeof Storage === "undefined") {
    return;
  }
  installed = true;
  const originalSet = Storage.prototype.setItem;
  const originalRemove = Storage.prototype.removeItem;

  Storage.prototype.setItem = function setItem(key: string, value: string): void {
    if (!writesAllowed && isProtectedCalculationStorageKey(String(key))) {
      throw new Error(BLOCKED_MESSAGE);
    }
    originalSet.call(this, key, value);
  };

  Storage.prototype.removeItem = function removeItem(key: string): void {
    if (!writesAllowed && isProtectedCalculationStorageKey(String(key))) {
      throw new Error(BLOCKED_MESSAGE);
    }
    originalRemove.call(this, key);
  };
}
