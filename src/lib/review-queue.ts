import type { Inspection, InspectionStatus, Priority } from '@/types';
import type { ListQuery, Paged } from '@/lib/paged-list';

/** Estados que fazem a inspeção estar na fila do supervisor (AC-REVIEW). */
export const PENDING_REVIEW_STATUSES: InspectionStatus[] = ['ENVIADA', 'EM_REVISAO'];

export const EMPTY_QUEUE_MESSAGE = 'Nenhuma inspeção aguardando revisão.';
export const NO_RESULTS_MESSAGE = 'Nenhuma inspeção encontrada para os filtros escolhidos.';

export interface ReviewQueueFilters {
  clienteId: string;
  tecnicoId: string;
  prioridade: 'TODAS' | Priority;
  /** 'TODOS' = aguardando + em revisão. */
  status: 'TODOS' | 'ENVIADA' | 'EM_REVISAO';
  /** Período da data prevista, formato yyyy-mm-dd (vazio = sem limite). */
  de: string;
  ate: string;
}

export const INITIAL_QUEUE_FILTERS: ReviewQueueFilters = {
  clienteId: '',
  tecnicoId: '',
  prioridade: 'TODAS',
  status: 'TODOS',
  de: '',
  ate: '',
};

/** Nomes usados só na busca textual (a fila filtra por id, cliente, local e técnico). */
export interface QueueNames {
  cliente: (id: string) => string;
  local: (id: string) => string;
  tecnico: (id: string) => string;
}

export function isPendingReview(inspection: Pick<Inspection, 'status'>): boolean {
  return PENDING_REVIEW_STATUSES.includes(inspection.status);
}

const PRIORITY_RANK: Record<Priority, number> = { ALTA: 0, MEDIA: 1, BAIXA: 2 };

function matches(i: Inspection, f: ReviewQueueFilters, q: string, names: QueueNames): boolean {
  if (!isPendingReview(i)) return false;
  if (f.status !== 'TODOS' && i.status !== f.status) return false;
  if (f.clienteId && i.clienteId !== f.clienteId) return false;
  if (f.tecnicoId && i.tecnicoId !== f.tecnicoId) return false;
  if (f.prioridade !== 'TODAS' && i.prioridade !== f.prioridade) return false;
  const day = i.dataPrevista.slice(0, 10);
  if (f.de && day < f.de) return false;
  if (f.ate && day > f.ate) return false;
  const term = q.trim().toLowerCase();
  if (term) {
    const haystack = [i.id, names.cliente(i.clienteId), names.local(i.localId), names.tecnico(i.tecnicoId)].join(' ').toLowerCase();
    if (!haystack.includes(term)) return false;
  }
  return true;
}

function compare(a: Inspection, b: Inspection, field: string): number {
  if (field === 'prioridade') return PRIORITY_RANK[a.prioridade] - PRIORITY_RANK[b.prioridade];
  if (field === 'id') return a.id.localeCompare(b.id);
  return a.dataPrevista.localeCompare(b.dataPrevista);
}

/**
 * Consulta da fila com a mesma forma de uma listagem da API (busca, filtros,
 * ordenação, página 0-based). Quando existir o endpoint de listagem, só este
 * ponto é trocado por uma chamada HTTP.
 */
export function queryReviewQueue(inspections: Inspection[], query: ListQuery<ReviewQueueFilters>, names: QueueNames): Paged<Inspection> {
  const sign = query.sort.dir === 'desc' ? -1 : 1;
  const all = inspections
    .filter((i) => matches(i, query.filters, query.q, names))
    // Empate: o mais antigo primeiro, para ninguém ficar esquecido na fila.
    .sort((a, b) => sign * compare(a, b, query.sort.field) || a.dataPrevista.localeCompare(b.dataPrevista) || a.id.localeCompare(b.id));
  const start = query.page * query.size;
  return {
    items: all.slice(start, start + query.size),
    page: { page: query.page, size: query.size, totalElements: all.length, totalPages: Math.ceil(all.length / query.size) },
  };
}

/** Quantas inspeções aguardam revisão (todas, sem filtros). */
export function countPendingReview(inspections: Inspection[]): number {
  return inspections.filter(isPendingReview).length;
}
