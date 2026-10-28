/**
 * Paginação, busca, filtros e ordenação server-side (PBI-0017.1).
 * Contrato da API (doc. 12.1): `page` (0-based), `size` (máx. 100), `sort`
 * ("campo,asc|desc"), `q` (busca textual) e filtros explícitos por recurso;
 * resposta `{ items, page: { page, size, totalElements, totalPages } }`.
 * Este arquivo só tem lógica pura (sem React), para ser testável.
 */

export interface PageMeta {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface Paged<T> {
  items: T[];
  page: PageMeta;
}

export type SortDir = 'asc' | 'desc';

export interface Sort {
  field: string;
  dir: SortDir;
}

export interface ListQuery<F> {
  page: number;
  size: number;
  sort: Sort;
  q: string;
  filters: F;
}

/** Máximo de itens por página aceito pela API. */
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function toSortParam(sort: Sort): string {
  return `${sort.field},${sort.dir}`;
}

/** Monta `?a=1&b=x`, omitindo valores vazios (undefined, null, ''). */
export function buildQueryString(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/** Parâmetros comuns de uma listagem, prontos para `buildQueryString`. */
export function listParams<F>(query: Pick<ListQuery<F>, 'page' | 'size' | 'sort' | 'q'>) {
  return {
    page: query.page,
    size: query.size,
    sort: toSortParam(query.sort),
    q: query.q.trim() || undefined,
  };
}

/** Percorre todas as páginas — para listas de apoio (seletores, nomes, contagens). */
export async function fetchAllPages<T>(fetchPage: (page: number, size: number) => Promise<Paged<T>>): Promise<T[]> {
  const items: T[] = [];
  let page = 0;
  let totalPages = 1;
  while (page < totalPages) {
    const response = await fetchPage(page, MAX_PAGE_SIZE);
    items.push(...response.items);
    totalPages = response.page.totalPages;
    page += 1;
  }
  return items;
}

// ---------------------------------------------------------------------------
// Estado da listagem (reducer puro)
// ---------------------------------------------------------------------------

export interface PagedListState<F> {
  page: number;
  size: number;
  sort: Sort;
  /** Texto digitado no campo de busca (muda a cada tecla). */
  input: string;
  /** Busca aplicada (depois do debounce) — é o que vai para a API. */
  q: string;
  filters: F;
}

export type PagedListAction<F> =
  | { type: 'input'; value: string }
  | { type: 'applyInput' }
  | { type: 'page'; page: number }
  | { type: 'size'; size: number }
  | { type: 'sortBy'; field: string }
  | { type: 'setSort'; sort: Sort }
  | { type: 'filter'; key: keyof F; value: F[keyof F] }
  | { type: 'clear'; filters: F }
  | { type: 'clamp'; totalPages: number };

export function initialPagedListState<F>(options: { size?: number; sort: Sort; filters: F }): PagedListState<F> {
  return {
    page: 0,
    size: options.size ?? DEFAULT_PAGE_SIZE,
    sort: options.sort,
    input: '',
    q: '',
    filters: options.filters,
  };
}

/**
 * Regra central: qualquer mudança de busca, filtro, ordenação ou tamanho
 * volta para a primeira página (senão a página pedida pode nem existir mais).
 * Estados "iguais" devolvem o mesmo objeto, para não disparar nova consulta.
 */
export function pagedListReducer<F>(state: PagedListState<F>, action: PagedListAction<F>): PagedListState<F> {
  switch (action.type) {
    case 'input':
      return action.value === state.input ? state : { ...state, input: action.value };
    case 'applyInput': {
      const q = state.input.trim();
      return q === state.q ? state : { ...state, q, page: 0 };
    }
    case 'page': {
      const page = Math.max(0, action.page);
      return page === state.page ? state : { ...state, page };
    }
    case 'size': {
      const size = Math.min(Math.max(1, action.size), MAX_PAGE_SIZE);
      return size === state.size ? state : { ...state, size, page: 0 };
    }
    case 'sortBy': {
      // Clicar no cabeçalho: mesmo campo inverte a direção; campo novo começa em asc.
      const dir: SortDir = state.sort.field === action.field && state.sort.dir === 'asc' ? 'desc' : 'asc';
      return { ...state, sort: { field: action.field, dir }, page: 0 };
    }
    case 'setSort':
      return action.sort.field === state.sort.field && action.sort.dir === state.sort.dir
        ? state
        : { ...state, sort: action.sort, page: 0 };
    case 'filter':
      return state.filters[action.key] === action.value
        ? state
        : { ...state, filters: { ...state.filters, [action.key]: action.value }, page: 0 };
    case 'clear':
      return { ...state, input: '', q: '', filters: action.filters, page: 0 };
    case 'clamp': {
      // Ex.: apagou/inativou o último item da última página — volta uma página.
      const last = Math.max(action.totalPages - 1, 0);
      return state.page > last ? { ...state, page: last } : state;
    }
  }
}
