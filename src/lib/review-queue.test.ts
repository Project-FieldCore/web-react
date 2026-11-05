import { describe, expect, it } from 'vitest';
import { countPendingReview, INITIAL_QUEUE_FILTERS, isPendingReview, queryReviewQueue, type QueueNames, type ReviewQueueFilters } from './review-queue';
import type { Inspection } from '@/types';
import type { ListQuery } from './paged-list';

const make = (id: string, patch: Partial<Inspection> = {}): Inspection => ({
  id, clienteId: 'c1', localId: 'l1', modeloId: 'm', modeloVersao: 1, tecnicoId: 't1', prioridade: 'MEDIA',
  dataPrevista: '2026-11-10T12:00:00.000Z', status: 'ENVIADA', answers: {}, nonConformities: {}, ...patch,
});

const NAMES: QueueNames = {
  cliente: (id) => ({ c1: 'Usina Norte', c2: 'Fábrica Sul' })[id] ?? '—',
  local: (id) => ({ l1: 'Caldeira', l2: 'Prensa' })[id] ?? '—',
  tecnico: (id) => ({ t1: 'Ana', t2: 'Caio' })[id] ?? '—',
};

const query = (patch: Partial<Omit<ListQuery<ReviewQueueFilters>, 'filters'>> & { filters?: Partial<ReviewQueueFilters> } = {}): ListQuery<ReviewQueueFilters> => ({
  page: 0,
  size: 20,
  q: '',
  sort: { field: 'dataPrevista', dir: 'asc' },
  ...patch,
  filters: { ...INITIAL_QUEUE_FILTERS, ...patch.filters },
});
const ids = (r: { items: Inspection[] }) => r.items.map((i) => i.id);

const DATA = [
  make('a', { dataPrevista: '2026-11-12T10:00:00Z', prioridade: 'BAIXA' }),
  make('b', { dataPrevista: '2026-11-10T10:00:00Z', prioridade: 'ALTA', tecnicoId: 't2' }),
  make('c', { dataPrevista: '2026-11-11T10:00:00Z', status: 'EM_REVISAO', clienteId: 'c2', localId: 'l2' }),
  make('d', { status: 'EM_ANDAMENTO' }),
  make('e', { status: 'APROVADA' }),
];

describe('fila de revisão', () => {
  it('só entram inspeções enviadas ou em revisão', () => {
    expect(isPendingReview({ status: 'ENVIADA' })).toBe(true);
    expect(isPendingReview({ status: 'EM_REVISAO' })).toBe(true);
    expect(isPendingReview({ status: 'APROVADA' })).toBe(false);
    expect(ids(queryReviewQueue(DATA, query(), NAMES)).sort()).toEqual(['a', 'b', 'c']);
    expect(countPendingReview(DATA)).toBe(3);
  });

  it('ordena pela previsão, das mais antigas para as mais recentes, e inverte', () => {
    expect(ids(queryReviewQueue(DATA, query(), NAMES))).toEqual(['b', 'c', 'a']);
    expect(ids(queryReviewQueue(DATA, query({ sort: { field: 'dataPrevista', dir: 'desc' } }), NAMES))).toEqual(['a', 'c', 'b']);
  });

  it('ordena por prioridade (alta primeiro), desempatando pela data mais antiga', () => {
    const r = queryReviewQueue(DATA, query({ sort: { field: 'prioridade', dir: 'asc' } }), NAMES);
    expect(ids(r)).toEqual(['b', 'c', 'a']);
  });

  it('filtra por situação, cliente, técnico e prioridade', () => {
    expect(ids(queryReviewQueue(DATA, query({ filters: { status: 'EM_REVISAO' } }), NAMES))).toEqual(['c']);
    expect(ids(queryReviewQueue(DATA, query({ filters: { clienteId: 'c2' } }), NAMES))).toEqual(['c']);
    expect(ids(queryReviewQueue(DATA, query({ filters: { tecnicoId: 't2' } }), NAMES))).toEqual(['b']);
    expect(ids(queryReviewQueue(DATA, query({ filters: { prioridade: 'BAIXA' } }), NAMES))).toEqual(['a']);
  });

  it('filtra por período (inclusivo nos dois extremos)', () => {
    expect(ids(queryReviewQueue(DATA, query({ filters: { de: '2026-11-11', ate: '2026-11-11' } }), NAMES))).toEqual(['c']);
    expect(ids(queryReviewQueue(DATA, query({ filters: { de: '2026-11-11' } }), NAMES))).toEqual(['c', 'a']);
    expect(ids(queryReviewQueue(DATA, query({ filters: { ate: '2026-11-10' } }), NAMES))).toEqual(['b']);
  });

  it('busca por cliente, local, técnico ou código, sem diferenciar maiúsculas', () => {
    expect(ids(queryReviewQueue(DATA, query({ q: 'usina' }), NAMES)).sort()).toEqual(['a', 'b']);
    expect(ids(queryReviewQueue(DATA, query({ q: 'PRENSA' }), NAMES))).toEqual(['c']);
    expect(ids(queryReviewQueue(DATA, query({ q: 'caio' }), NAMES))).toEqual(['b']);
    expect(ids(queryReviewQueue(DATA, query({ q: 'nada' }), NAMES))).toEqual([]);
  });

  it('pagina e informa o total', () => {
    const r = queryReviewQueue(DATA, query({ size: 2, page: 1 }), NAMES);
    expect(ids(r)).toEqual(['a']);
    expect(r.page).toEqual({ page: 1, size: 2, totalElements: 3, totalPages: 2 });
  });

  it('fila vazia: zero páginas', () => {
    const r = queryReviewQueue([], query(), NAMES);
    expect(r).toEqual({ items: [], page: { page: 0, size: 20, totalElements: 0, totalPages: 0 } });
  });
});
