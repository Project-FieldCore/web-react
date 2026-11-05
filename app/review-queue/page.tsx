'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/store/app-store';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { InspectionStatusBadge, PriorityTag } from '@/components/Badges';
import { FilterSelect, Pagination, SearchBox, SortSelect, type SortOption } from '@/components/ListControls';
import { usePagedList } from '@/hooks/usePagedList';
import { formatDateTime } from '@/lib/inspection-display';
import {
  EMPTY_QUEUE_MESSAGE,
  INITIAL_QUEUE_FILTERS,
  NO_RESULTS_MESSAGE,
  queryReviewQueue,
  type QueueNames,
  type ReviewQueueFilters,
} from '@/lib/review-queue';
import type { Inspection } from '@/types';

const SORT_OPTIONS: SortOption[] = [
  { label: 'Previsão (mais antigas)', sort: { field: 'dataPrevista', dir: 'asc' } },
  { label: 'Previsão (mais recentes)', sort: { field: 'dataPrevista', dir: 'desc' } },
  { label: 'Prioridade (alta primeiro)', sort: { field: 'prioridade', dir: 'asc' } },
];

const STATUS_OPTIONS: { value: ReviewQueueFilters['status']; label: string }[] = [
  { value: 'TODOS', label: 'Aguardando e em revisão' },
  { value: 'ENVIADA', label: 'Aguardando revisão' },
  { value: 'EM_REVISAO', label: 'Em revisão' },
];

const PRIORITY_OPTIONS: { value: ReviewQueueFilters['prioridade']; label: string }[] = [
  { value: 'TODAS', label: 'Todas as prioridades' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'MEDIA', label: 'Média' },
  { value: 'BAIXA', label: 'Baixa' },
];

const DATE_INPUT = 'border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 bg-white';

/**
 * Fila de revisão do supervisor (PBI-0056.2): inspeções enviadas que aguardam
 * revisão, com busca, filtros, ordenação e paginação. Os dados ainda vêm do
 * store — a API não tem listagem de inspeções para supervisor (ver `queryReviewQueue`).
 */
export default function ReviewQueuePage() {
  const clients = useAppStore((s) => s.clients);
  const users = useAppStore((s) => s.users);
  const locations = useAppStore((s) => s.locations);
  const technicians = users.filter((u) => u.role === 'TECHNICIAN');

  const names: QueueNames = {
    cliente: (id) => clients.find((c) => c.id === id)?.nome ?? '—',
    local: (id) => locations.find((l) => l.id === id)?.nome ?? '—',
    tecnico: (id) => users.find((u) => u.id === id)?.nome ?? '—',
  };

  const list = usePagedList<Inspection, ReviewQueueFilters>(
    // Lê o store na hora da consulta, para refletir o estado mais recente.
    async (query) => {
      const s = useAppStore.getState();
      return queryReviewQueue(s.inspections, query, {
        cliente: (id) => s.clients.find((c) => c.id === id)?.nome ?? '—',
        local: (id) => s.locations.find((l) => l.id === id)?.nome ?? '—',
        tecnico: (id) => s.users.find((u) => u.id === id)?.nome ?? '—',
      });
    },
    { sort: SORT_OPTIONS[0].sort, filters: INITIAL_QUEUE_FILTERS }
  );

  const total = list.meta?.totalElements ?? 0;
  const detailHref = (i: Inspection) => `/inspections/${i.id}`;

  // Se uma inspeção sair da fila em outra aba/ação, a lista é recarregada ao voltar para a tela.
  const { reload } = list;
  useEffect(() => {
    const onFocus = () => reload();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reload]);

  return (
    <div className="w-full min-w-0">
      <h1 className="text-2xl font-extrabold text-navy-900 mb-1">Fila de revisão</h1>
      <p className="text-sm text-slate-500 mb-6">Inspeções enviadas pelos técnicos que aguardam a sua revisão</p>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox value={list.input} onChange={list.setInput} placeholder="Buscar por cliente, local, técnico ou código" />
          <FilterSelect
            label="Filtrar por situação"
            value={list.filters.status}
            options={STATUS_OPTIONS}
            onChange={(v) => list.setFilter('status', v)}
          />
          <FilterSelect
            label="Filtrar por cliente"
            value={list.filters.clienteId}
            options={[{ value: '', label: 'Todos os clientes' }, ...clients.map((c) => ({ value: c.id, label: c.nome }))]}
            onChange={(v) => list.setFilter('clienteId', v)}
          />
          <FilterSelect
            label="Filtrar por técnico"
            value={list.filters.tecnicoId}
            options={[{ value: '', label: 'Todos os técnicos' }, ...technicians.map((t) => ({ value: t.id, label: t.nome }))]}
            onChange={(v) => list.setFilter('tecnicoId', v)}
          />
          <FilterSelect
            label="Filtrar por prioridade"
            value={list.filters.prioridade}
            options={PRIORITY_OPTIONS}
            onChange={(v) => list.setFilter('prioridade', v)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <label className="flex items-center gap-1.5">
            Previsão de
            <input type="date" value={list.filters.de} max={list.filters.ate || undefined} onChange={(e) => list.setFilter('de', e.target.value)} className={DATE_INPUT} />
          </label>
          <label className="flex items-center gap-1.5">
            até
            <input type="date" value={list.filters.ate} min={list.filters.de || undefined} onChange={(e) => list.setFilter('ate', e.target.value)} className={DATE_INPUT} />
          </label>
          <SortSelect value={list.sort} options={SORT_OPTIONS} onChange={list.setSort} />
          {list.hasActiveFilters && (
            <button type="button" onClick={list.clear} className="font-bold text-navy-700">Limpar filtros</button>
          )}
          {list.status === 'ready' && (
            <span role="status" aria-live="polite" className="ml-auto font-semibold text-slate-600">
              {total} {total === 1 ? 'inspeção' : 'inspeções'}
            </span>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {list.status === 'loading' && <LoadingState label="Carregando a fila de revisão..." />}
        {list.status === 'error' && <ErrorState message={list.error ?? 'Não foi possível carregar a fila.'} onRetry={list.reload} />}
        {list.status === 'ready' && list.items.length === 0 && (
          <EmptyState title={list.hasActiveFilters ? NO_RESULTS_MESSAGE : EMPTY_QUEUE_MESSAGE} description={list.hasActiveFilters ? 'Ajuste ou limpe os filtros para ver outras inspeções.' : 'Quando um técnico enviar uma inspeção, ela aparece aqui.'} action={list.hasActiveFilters ? { label: 'Limpar filtros', onClick: list.clear } : undefined} />
        )}
        {list.status === 'ready' && list.items.length > 0 && (
          <ul className="divide-y divide-slate-100" aria-label="Inspeções aguardando revisão">
            {list.items.map((i) => (
              <li key={i.id}>
                <Link href={detailHref(i)} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 hover:bg-slate-50">
                  <div className="min-w-0 sm:flex-1">
                    <div className="font-semibold text-navy-900 truncate">{names.cliente(i.clienteId)} · {names.local(i.localId)}</div>
                    <div className="text-xs text-slate-500 truncate">{names.tecnico(i.tecnicoId)} · <span className="font-mono text-slate-400">{i.id}</span></div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <PriorityTag priority={i.prioridade} />
                    <InspectionStatusBadge status={i.status} />
                    <span className="text-xs font-mono text-slate-500">{formatDateTime(i.dataPrevista)}</span>
                    <span className="text-xs font-bold text-navy-700 whitespace-nowrap">Revisar →</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Pagination meta={list.meta} onPage={list.setPage} onSize={list.setSize} />
    </div>
  );
}
