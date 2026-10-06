import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ensureNumericIdForUuid } from "../api/savedCases";
import IsKanunuKidemPage from "./hesaplamalar/kidem-tazminati/is-kanunu/IsKanunuKidemPage";

export function KidemPage() {
  const [params, setParams] = useSearchParams();
  const kayit = params.get("kayit");
  const caseId = params.get("caseId");

  useEffect(() => {
    if (!kayit || caseId) return;
    void ensureNumericIdForUuid(kayit).then((numericId) => {
      setParams({ caseId: String(numericId) }, { replace: true });
    });
  }, [kayit, caseId, setParams]);

  return <IsKanunuKidemPage />;
}
