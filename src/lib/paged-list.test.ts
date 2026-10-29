import { describe, expect, it, vi } from 'vitest';
import {
  buildQueryString,
  fetchAllPages,
  initialPagedListState,
  listParams,
  pagedListReducer,
  toSortParam,
  type Paged,
  type PagedListState,
} from './paged-list';

interface Filters {
  status: 'TODOS' | 'ATIVO';
  role: 'TODOS' | 'ADMIN';
}

const INITIAL_FILTERS: Filters = { status: 'TODOS', role: 'TODOS' };
const newState = () => initialPagedListState<Filters>({ sort: { field: 'name', dir: 'asc' }, filters: INITIAL_FILTERS });
const reduce = (state: PagedListState<Filters>, action: Parameters<typeof pagedListReducer<Filters>>[1]) =>
  pagedListReducer(state, action);

describe('buildQueryString', () => {
  it('monta a query e omite valores vazios', () => {
    expect(buildQueryString({ page: 0, size: 20, sort: 'name,asc', q: undefined, status: '', role: null })).toBe(
      '?page=0&size=20&sort=name%2Casc'
    );
  });

  it('mantém o zero (página 0) e devolve string vazia sem parâmetros', () => {
    expect(buildQueryString({ page: 0 })).toBe('?page=0');
    expect(buildQueryString({ q: undefined })).toBe('');
  });

  it('codifica a busca com espaços e acentos', () => {
    expect(buildQueryString({ q: 'usina são paulo' })).toBe('?q=usina+s%C3%A3o+paulo');
  });
});

describe('toSortParam / listParams', () => {
  it('formata o sort como "campo,direção"', () => {
    expect(toSortParam({ field: 'createdAt', dir: 'desc' })).toBe('createdAt,desc');
  });

  it('listParams apara a busca e omite q vazio', () => {
    const base = { page: 2, size: 10, sort: { field: 'name', dir: 'asc' as const } };
    expect(listParams({ ...base, q: '  acme  ' })).toEqual({ page: 2, size: 10, sort: 'name,asc', q: 'acme' });
    expect(listParams({ ...base, q: '   ' }).q).toBeUndefined();
  });
});

describe('fetchAllPages', () => {
  const pageOf = (items: number[], page: number, totalPages: number): Paged<number> => ({
    items,
    page: { page, size: 100, totalElements: 0, totalPages },
  });

  it('percorre todas as páginas', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(pageOf([1, 2], 0, 3))
      .mockResolvedValueOnce(pageOf([3], 1, 3))
      .mockResolvedValueOnce(pageOf([4], 2, 3));

    expect(await fetchAllPages(fetchPage)).toEqual([1, 2, 3, 4]);
    expect(fetchPage.mock.calls.map((c) => [c[0], c[1]])).toEqual([[0, 100], [1, 100], [2, 100]]);
  });

  it('lista vazia (0 páginas) devolve [] sem laço infinito', async () => {
    const fetchPage = vi.fn().mockResolvedValue(pageOf([], 0, 0));

    expect(await fetchAllPages(fetchPage)).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});

describe('pagedListReducer', () => {
  it('estado inicial: página 0, 20 por página, sem busca', () => {
    expect(newState()).toMatchObject({ page: 0, size: 20, input: '', q: '', filters: INITIAL_FILTERS });
  });

  it('digitar só muda o texto; a busca só é aplicada no applyInput (debounce)', () => {
    let state = reduce({ ...newState(), page: 3 }, { type: 'input', value: 'ac' });
    expect(state.q).toBe('');
    expect(state.page).toBe(3);

    state = reduce(state, { type: 'applyInput' });
    expect(state.q).toBe('ac');
    expect(state.page).toBe(0);
  });

  it('applyInput sem mudança devolve o mesmo estado (não dispara nova consulta)', () => {
    const state = reduce(newState(), { type: 'input', value: '   ' });
    expect(reduce(state, { type: 'applyInput' })).toBe(state);
  });

  it('mudar filtro, tamanho ou ordenação volta para a primeira página', () => {
    const onPage3 = { ...newState(), page: 3 };

    expect(reduce(onPage3, { type: 'filter', key: 'status', value: 'ATIVO' })).toMatchObject({ page: 0, filters: { status: 'ATIVO', role: 'TODOS' } });
    expect(reduce(onPage3, { type: 'size', size: 50 })).toMatchObject({ page: 0, size: 50 });
    expect(reduce(onPage3, { type: 'sortBy', field: 'email' })).toMatchObject({ page: 0, sort: { field: 'email', dir: 'asc' } });
    expect(reduce(onPage3, { type: 'setSort', sort: { field: 'createdAt', dir: 'desc' } })).toMatchObject({ page: 0 });
  });

  it('mesmo filtro, tamanho ou ordenação devolve o mesmo estado', () => {
    const state = newState();
    expect(reduce(state, { type: 'filter', key: 'status', value: 'TODOS' })).toBe(state);
    expect(reduce(state, { type: 'size', size: 20 })).toBe(state);
    expect(reduce(state, { type: 'setSort', sort: { field: 'name', dir: 'asc' } })).toBe(state);
    expect(reduce(state, { type: 'page', page: 0 })).toBe(state);
  });

  it('clicar de novo no mesmo cabeçalho inverte a direção; campo novo começa em asc', () => {
    let state = newState();
    state = reduce(state, { type: 'sortBy', field: 'name' });
    expect(state.sort).toEqual({ field: 'name', dir: 'desc' });
    state = reduce(state, { type: 'sortBy', field: 'name' });
    expect(state.sort).toEqual({ field: 'name', dir: 'asc' });
    state = reduce(state, { type: 'sortBy', field: 'email' });
    expect(state.sort).toEqual({ field: 'email', dir: 'asc' });
  });

  it('tamanho de página respeita os limites da API (1 a 100)', () => {
    expect(reduce(newState(), { type: 'size', size: 500 }).size).toBe(100);
    expect(reduce(newState(), { type: 'size', size: 0 }).size).toBe(1);
  });

  it('page nunca fica negativa', () => {
    expect(reduce({ ...newState(), page: 2 }, { type: 'page', page: -1 }).page).toBe(0);
  });

  it('clear limpa busca e filtros e volta para a página 0, mantendo a ordenação', () => {
    const dirty: PagedListState<Filters> = {
      ...newState(),
      page: 4,
      input: 'acme',
      q: 'acme',
      filters: { status: 'ATIVO', role: 'ADMIN' },
      sort: { field: 'email', dir: 'desc' },
    };

    expect(reduce(dirty, { type: 'clear', filters: INITIAL_FILTERS })).toMatchObject({
      page: 0,
      input: '',
      q: '',
      filters: INITIAL_FILTERS,
      sort: { field: 'email', dir: 'desc' },
    });
  });

  it('clamp volta para a última página que existe (ex.: inativou o último item da última página)', () => {
    expect(reduce({ ...newState(), page: 5 }, { type: 'clamp', totalPages: 3 }).page).toBe(2);
    expect(reduce({ ...newState(), page: 5 }, { type: 'clamp', totalPages: 0 }).page).toBe(0);
  });

  it('clamp não mexe quando a página ainda existe', () => {
    const state = { ...newState(), page: 1 };
    expect(reduce(state, { type: 'clamp', totalPages: 3 })).toBe(state);
  });
});
