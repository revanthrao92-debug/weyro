import { useCallback, useEffect, useRef, useState } from 'react';

interface HistoryPage<T> {
  items: T[];
  nextCursor: string | null;
}

type Fetcher<T> = (cursor: string | null) => Promise<HistoryPage<T> | T[]>;

interface UseHistoryListOptions {
  fetch: Fetcher<unknown>;
  /** Refetch when this changes (e.g. active tab) */
  key: string;
}

/**
 * Shared list state for history dashboards: initial load, pull-to-refresh,
 * cursor load-more, error/retry. Normalizes endpoints that return either a
 * cursor page ({ items, nextCursor }) or a plain array.
 */
export function useHistoryList<T>({ fetch, key }: UseHistoryListOptions) {
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);

  const load = useCallback(
    async (cursor: string | null, mode: 'initial' | 'refresh' | 'more') => {
      if (mode === 'initial') {
        setIsLoading(true);
      } else if (mode === 'refresh') {
        setIsRefreshing(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      try {
        const nextPage = await fetch(cursor);
        if (!mounted.current) return;

        const page: HistoryPage<T> = Array.isArray(nextPage)
          ? { items: nextPage as T[], nextCursor: null }
          : (nextPage as HistoryPage<T>);

        setItems((current) =>
          cursor ? [...current, ...page.items] : page.items,
        );
        setNextCursor(page.nextCursor);
      } catch (err: any) {
        if (mounted.current) {
          setError(
            err?.message || 'Unable to load your history. Please retry.',
          );
        }
      } finally {
        if (mounted.current) {
          setIsLoading(false);
          setIsRefreshing(false);
          setIsLoadingMore(false);
        }
      }
    },
    [fetch],
  );

  // Initial load / tab switch
  useEffect(() => {
    mounted.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems([]);
    setNextCursor(null);
    void load(null, 'initial');

    return () => {
      mounted.current = false;
    };
  }, [key, load]);

  const refresh = useCallback(() => load(null, 'initial'), [load]);

  const loadMore = useCallback(() => {
    if (!nextCursor || isLoadingMore || isLoading) return;
    void load(nextCursor, 'more');
  }, [nextCursor, isLoadingMore, isLoading, load]);

  return {
    items: items as T[],
    hasMore: nextCursor !== null,
    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    refresh,
    loadMore,
    retry: refresh,
  };
}
