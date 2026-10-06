import type { DesktopLicenseStatus } from "../../shared/desktop-contract";
import { dispatchKidemCalculation } from "../../shared/kidem/dispatch";
import { AppError } from "../db/errors";

export function assertCanCalculate(status: DesktopLicenseStatus): void {
  if (!status.canWriteRecords) {
    throw new AppError(status.message || "Geçerli lisans olmadan yeni hesaplama yapılamaz.");
  }
}

export function calculateKidemWithLicense(payload: unknown, status: DesktopLicenseStatus) {
  assertCanCalculate(status);
  try {
    const dispatched = dispatchKidemCalculation(payload);
    return {
      kind: dispatched.kind,
      informational: dispatched.informational,
      form: dispatched.form,
      result: dispatched.result,
      calculatedAt: dispatched.calculatedAt,
    };
  } catch (error) {
    throw error instanceof AppError ? error : new AppError(error instanceof Error ? error.message : "Hesaplama yapılamadı.");
  }
}
