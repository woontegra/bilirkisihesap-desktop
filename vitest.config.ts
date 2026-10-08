import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(rootDir, "src"),
    },
  },
  test: {
    environment: "node",
    include: [
      "electron/license/*.test.ts",
      "electron/auth/*.test.ts",
      "electron/security/*.test.ts",
      "electron/kidem/*.test.ts",
      "electron/icra/*.test.ts",
      "electron/backup/*.test.ts",
      "electron/dashboard/*.test.ts",
      "electron/db/settingsRepository.test.ts",
      "shared/kidem/*.test.ts",
      "src/shell/*.test.ts",
      "src/license/*.test.ts",
      "src/utils/caseNotesStore.test.ts",
      "src/utils/caseTagsStore.test.ts",
      "src/components/calculation-tools/pressDailyInterest.test.ts",
      "src/components/calculation-preview/pdfExport.test.ts",
      "src/pages/araclar/manuel-brut-ucret/*.test.ts",
      "src/pages/profile/*.test.ts",
      "src/pages/hesaplamalar/fazla-mesai/shared/*.test.ts",
      "src/pages/hesaplamalar/ubgt/bilirkisi/bilirkisiUbgtView.test.ts",
      "src/pages/hesaplamalar/legalNotePlacement.test.ts",
    ],
  },
});
