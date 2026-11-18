import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
import { onPricingChanged } from "./pricingEvents";
import type { WithSource } from "./publicApi";

type State<T> = {
  data: T | null;
  source: "api" | "fallback" | null;
  loading: boolean;
};

/**
 * Runs a fetch-with-fallback function on mount, when deps change, or when refreshed.
 * `data` is never an error state: fallbacks are baked into the fetcher.
 */
export function usePublicData<T>(
  fetcher: () => Promise<WithSource<T>>,
  deps: DependencyList = [],
  { refreshPricing = false }: { refreshPricing?: boolean } = {},
): State<T> & { refresh: () => void } {
  const [state, setState] = useState<State<T>>({ data: null, source: null, loading: true });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    setState((previous) => ({ ...previous, loading: true }));
    fetcherRef.current().then(({ data, source }) => {
      if (!cancelled) setState({ data, source, loading: false });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, revision]);

  useEffect(() => {
    if (!refreshPricing) return;
    window.addEventListener("focus", refresh);
    const stopPricingListener = onPricingChanged(refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      stopPricingListener();
    };
  }, [refreshPricing, refresh]);

  return { ...state, refresh };
}
