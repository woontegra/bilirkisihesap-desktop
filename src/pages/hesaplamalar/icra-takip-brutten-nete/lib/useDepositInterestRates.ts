import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import {
  DEPOSIT_INTEREST_BLOKE_MESSAGE,
  type DepositInterestRateInput,
} from "./interestCalculator";

export function useDepositInterestRates(params: {
  enabled: boolean;
  startDate: string;
  endDate: string;
  principal: number;
}): {
  periods: DepositInterestRateInput[];
  loading: boolean;
  error: string | null;
} {
  const { enabled, startDate, endDate, principal } = params;
  const [periods, setPeriods] = useState<DepositInterestRateInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setPeriods([]);
      setError(null);
      setLoading(false);
      return;
    }
    if (!startDate || !endDate || principal <= 0) {
      setPeriods([]);
      setError(null);
      setLoading(false);
      return;
    }

    const api = window.bilirkisiDesktop;
    if (!api?.fetchDepositInterestRates) {
      setPeriods([]);
      setError(DEPOSIT_INTEREST_BLOKE_MESSAGE);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void api
      .fetchDepositInterestRates({ startDate, endDate })
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setPeriods([]);
          setError(result.message || DEPOSIT_INTEREST_BLOKE_MESSAGE);
          return;
        }
        setPeriods(Array.isArray(result.data.periods) ? result.data.periods : []);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPeriods([]);
        setError(err instanceof ApiError ? err.message : DEPOSIT_INTEREST_BLOKE_MESSAGE);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, startDate, endDate, principal]);

  return { periods, loading, error };
}
