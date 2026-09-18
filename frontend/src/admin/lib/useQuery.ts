import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
import { errorMessage } from "../../lib/api";

export type QueryState<T> = {
  data: T | null;
  error: string | null;
  /** True during the very first load (no data yet). */
  loading: boolean;
  /** True while any fetch (including refetch) is in flight. */
  fetching: boolean;
  refetch: () => Promise<void>;
  /** Optimistically replace the cached data. */
  setData: (updater: T | ((current: T | null) => T | null)) => void;
};

type Options = {
  /** Skip fetching until true (e.g. waiting for an id). */
  enabled?: boolean;
  /** Keep showing the previous data while refetching for new deps. */
  keepPreviousData?: boolean;
};

/**
 * Tiny fetch hook — loading / error / refetch — no external library.
 * `fn` runs whenever `deps` change; stale responses are ignored.
 */
export function useQuery<T>(fn: () => Promise<T>, deps: DependencyList, options: Options = {}): QueryState<T> {
  const { enabled = true, keepPreviousData = true } = options;
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [fetching, setFetching] = useState(enabled);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const requestId = useRef(0);
  const hasData = useRef(false);

  const run = useCallback(async () => {
    const id = ++requestId.current;
    setFetching(true);
    if (!hasData.current || !keepPreviousData) setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      if (id !== requestId.current) return;
      hasData.current = true;
      setDataState(result);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(errorMessage(err, "Could not load data"));
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setFetching(false);
      }
    }
  }, [keepPreviousData]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setFetching(false);
      return;
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps]);

  const setData = useCallback((updater: T | ((current: T | null) => T | null)) => {
    setDataState((current) =>
      typeof updater === "function" ? (updater as (c: T | null) => T | null)(current) : updater,
    );
  }, []);

  return { data, error, loading, fetching, refetch: run, setData };
}

/** Run an async action with pending state + error capture (for buttons/forms). */
export function useMutation<Args extends unknown[], R>(fn: (...args: Args) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const mutate = useCallback(async (...args: Args): Promise<R | undefined> => {
    setPending(true);
    setError(null);
    try {
      return await fnRef.current(...args);
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    } finally {
      setPending(false);
    }
  }, []);
  return { mutate, pending, error, reset: () => setError(null) };
}
