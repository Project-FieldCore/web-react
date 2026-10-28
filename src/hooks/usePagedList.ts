'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { ApiError, NetworkError } from '@/lib/http';
import {
  initialPagedListState,
  pagedListReducer,
  type ListQuery,
  type PageMeta,
  type Paged,
  type Sort,
} from '@/lib/paged-list';

const SEARCH_DEBOUNCE_MS = 300;

interface Options<T, F> {
  size?: number;
  sort: Sort;
  filters: F;
  /** Chamado a cada página carregada (ex.: manter o `version` dos itens no store). */
  onLoaded?: (items: T[]) => void;
}

/**
 * Listagem com busca, filtros, ordenação e paginação feitas na API.
 * - Busca com debounce; qualquer mudança de busca/filtro/ordem/tamanho volta à página 1.
 * - Loading só na primeira carga; depois a lista antiga fica visível (`refreshing`).
 * - Respostas fora de ordem são descartadas (só vale a da última consulta).
 */
export function usePagedList<T, F extends object>(
  fetcher: (query: ListQuery<F>) => Promise<Paged<T>>,
  options: Options<T, F>
) {
  const [state, dispatch] = useReducer(pagedListReducer<F>, options, initialPagedListState<F>);
  const initialFilters = useRef(options.filters).current;

  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const onLoadedRef = useRef(options.onLoaded);
  onLoadedRef.current = options.onLoaded;
  const latestRequest = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => dispatch({ type: 'applyInput' }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state.input]);

  useEffect(() => {
    const requestId = ++latestRequest.current;
    setRefreshing(true);
    // Nova tentativa depois de um erro volta a mostrar o loading.
    setStatus((current) => (current === 'error' ? 'loading' : current));
    fetcherRef
      .current({ page: state.page, size: state.size, sort: state.sort, q: state.q, filters: state.filters })
      .then((response) => {
        if (requestId !== latestRequest.current) return;
        setItems(response.items);
        setMeta(response.page);
        setStatus('ready');
        setError(null);
        setRefreshing(false);
        onLoadedRef.current?.(response.items);
        if (response.items.length === 0 && response.page.totalPages > 0) {
          dispatch({ type: 'clamp', totalPages: response.page.totalPages });
        }
      })
      .catch((err: unknown) => {
        if (requestId !== latestRequest.current) return;
        setStatus('error');
        setError(
          err instanceof ApiError || err instanceof NetworkError
            ? err.message
            : 'Não foi possível carregar a lista. Tente novamente.'
        );
        setRefreshing(false);
      });
  }, [state.page, state.size, state.sort, state.q, state.filters, reloadToken]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);
  const clear = useCallback(() => dispatch({ type: 'clear', filters: initialFilters }), [initialFilters]);

  const hasActiveFilters =
    state.input.trim() !== '' ||
    (Object.keys(initialFilters) as (keyof F)[]).some((key) => state.filters[key] !== initialFilters[key]);

  return {
    items,
    meta,
    status,
    error,
    refreshing,
    reload,
    page: state.page,
    size: state.size,
    sort: state.sort,
    input: state.input,
    filters: state.filters,
    hasActiveFilters,
    setInput: (value: string) => dispatch({ type: 'input', value }),
    setPage: (page: number) => dispatch({ type: 'page', page }),
    setSize: (size: number) => dispatch({ type: 'size', size }),
    sortBy: (field: string) => dispatch({ type: 'sortBy', field }),
    setSort: (sort: Sort) => dispatch({ type: 'setSort', sort }),
    setFilter: <K extends keyof F>(key: K, value: F[K]) => dispatch({ type: 'filter', key, value }),
    clear,
  };
}
