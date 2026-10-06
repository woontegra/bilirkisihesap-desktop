import {
  archiveCalculationRecord,
  createCalculationRecord,
  getCalculationRecord,
  listCalculationRecords,
  updateCalculationRecord,
} from "./calculationRecordsRepository";
import { getSetting, setSetting } from "./settingsRepository";

export function runDatabaseSmokeTest(): void {
  const created = createCalculationRecord({
    calculationType: "fazla-mesai",
    title: "Doğrulama kaydı",
    notes: "Geçici",
    inputJson: { check: true },
    resultJson: null,
  });

  const listed = listCalculationRecords();
  if (!listed.some((item) => item.id === created.id)) {
    throw new Error("Listeleme başarısız.");
  }

  const fetched = getCalculationRecord(created.id);
  if (fetched.title !== "Doğrulama kaydı") {
    throw new Error("Okuma başarısız.");
  }

  const updated = updateCalculationRecord(created.id, { title: "Doğrulama kaydı (güncellendi)" });
  if (updated.title !== "Doğrulama kaydı (güncellendi)") {
    throw new Error("Güncelleme başarısız.");
  }

  setSetting("locale", "tr");
  const locale = getSetting("locale");
  if (locale?.value !== "tr") {
    throw new Error("Ayar yazma/okuma başarısız.");
  }

  archiveCalculationRecord(created.id);
  const remaining = listCalculationRecords();
  if (remaining.some((item) => item.id === created.id)) {
    throw new Error("Arşivleme başarısız.");
  }
}
