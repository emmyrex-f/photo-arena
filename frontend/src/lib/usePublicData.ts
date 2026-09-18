import { useEffect, useRef, useState, type DependencyList } from "react";
import type { WithSource } from "./publicApi";

type State<T> = {
  data: T | null;
  source: "api" | "fallback" | null;
  loading: boolean;
};

/**
 * Runs a fetch-with-fallback function once (or when deps change) and exposes { data, source, loading }.
 * `data` is never an error state: fallbacks are baked into the fetcher.
 */
export function usePublicData<T>(fetcher: () => Promise<WithSource<T>>, deps: DependencyList = []): State<T> {
  const [state, setState] = useState<State<T>>({ data: null, source: null, loading: true });
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
  }, deps);

  return state;
}
