'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/store/app-store';
import { EmptyState, ErrorState, InlineError, LoadingState } from '@/components/States';
import { InspectionStatusBadge, PriorityTag } from '@/components/Badges';
import { FilterSelect, Pagination, SortSelect, type SortOption } from '@/components/ListControls';
import { formatDateTime } from '@/lib/inspection-display';
import { ApiError } from '@/lib/http';
import { listReviewQueue, type ReviewQueueItem } from '@/lib/inspections-api';
import {
  isSubmittedPeriodInvalid,
  SUBMITTED_PERIOD_ORDER_MESSAGE,
  toSubmittedIso,
} from '@/lib/review-queue-filters';
import { usePagedList } from '@/hooks/usePagedList';

const SORT_OPTIONS: SortOption[] = [
  { label: 'Envio (mais antigas primeiro)', sort: { field: 'submittedAt', dir: 'asc' } },
  { label: 'Envio (mais recentes primeiro)', sort: { field: 'submittedAt', dir: 'desc' } },
  { label: 'Prazo (mais próximo)', sort: { field: 'scheduledFor', dir: 'asc' } },
  { label: 'Prazo (mais distante)', sort: { field: 'scheduledFor', dir: 'desc' } },
  { label: 'Prioridade (alta → baixa)', sort: { field: 'priority', dir: 'desc' } },
  { label: 'Prioridade (baixa → alta)', sort: { field: 'priority', dir: 'asc' } },
];

interface ReviewQueueFilters {
  technicianId: string;
  clientId: string;
  submittedFrom: string;
  submittedTo: string;
}

const INITIAL_FILTERS: ReviewQueueFilters = {
  technicianId: 'TODOS',
  clientId: 'TODOS',
  submittedFrom: '',
  submittedTo: '',
};

function reviewQueueErrorCopy(error: unknown): { title: string; message: string; retry: boolean } {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return {
        title: 'Acesso não autorizado',
        message: 'Seu perfil não pode consultar a fila de revisão.',
        retry: false,
      };
    }
    if (error.status === 401) {
      return {
        title: 'Não foi possível carregar a fila',
        message: 'Sessão expirada. Entre novamente.',
        retry: false,
      };
    }
    if (error.code === 'INVALID_DATE_RANGE') {
      return {
        title: 'Não foi possível carregar a fila',
        message: 'Intervalo de datas inválido. Ajuste o período de envio.',
        retry: true,
      };
    }
    if (error.status === 400) {
      return {
        title: 'Não foi possível carregar a fila',
        message: 'Não foi possível aplicar os filtros. Verifique os valores informados.',
        retry: true,
      };
    }
    return { title: 'Não foi possível carregar a fila', message: error.message, retry: true };
  }
  return {
    title: 'Não foi possível carregar a fila',
    message: error instanceof Error ? error.message : 'Não foi possível carregar a fila.',
    retry: true,
  };
}

/**
 * PBI-0056.2 — Fila de revisão (UC / AC-REVIEW).
 * Lista só via GET /inspections/review-queue; linha abre o detalhe (sem aprovar/reprovar aqui).
 */
export default function ReviewQueuePage() {
  const clients = useAppStore((s) => s.clients);
  const users = useAppStore((s) => s.users);
  const loadClients = useAppStore((s) => s.loadClients);
  const loadUsers = useAppStore((s) => s.loadUsers);
  const technicians = users.filter((u) => u.role === 'TECHNICIAN' && u.status === 'ATIVO');

  const list = usePagedList<ReviewQueueItem, ReviewQueueFilters>(
    async (query) => {
      if (isSubmittedPeriodInvalid(query.filters.submittedFrom, query.filters.submittedTo)) {
        throw new ApiError(SUBMITTED_PERIOD_ORDER_MESSAGE, 400, undefined, 'CLIENT_PERIOD_INVALID');
      }
      try {
        return await listReviewQueue({
          ...query,
          filters: {
            technicianId: query.filters.technicianId === 'TODOS' ? undefined : query.filters.technicianId,
            clientId: query.filters.clientId === 'TODOS' ? undefined : query.filters.clientId,
            submittedFrom: toSubmittedIso(query.filters.submittedFrom),
            submittedTo: toSubmittedIso(query.filters.submittedTo),
          },
        });
      } catch (error) {
        if (error instanceof ApiError && error.code === 'CLIENT_PERIOD_INVALID') throw error;
        const copy = reviewQueueErrorCopy(error);
        if (error instanceof ApiError) {
          throw new ApiError(copy.message, error.status, error.details, error.code);
        }
        throw new ApiError(copy.message, 500);
      }
    },
    {
      size: 20,
      sort: SORT_OPTIONS[0].sort,
      filters: INITIAL_FILTERS,
    }
  );

  useEffect(() => {
    void loadClients();
    void loadUsers();
  }, [loadClients, loadUsers]);

  // Ao voltar do detalhe (após Iniciar revisão), refetch tira o item SUBMITTED da fila.
  const reloadQueue = list.reload;
  useEffect(() => {
    function onFocus() {
      reloadQueue();
    }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reloadQueue]);

  const periodInvalid = isSubmittedPeriodInvalid(list.filters.submittedFrom, list.filters.submittedTo);
  const isForbidden = list.error === 'Seu perfil não pode consultar a fila de revisão.';
  const isUnauthorized = list.error === 'Sessão expirada. Entre novamente.';

  return (
    <div className="w-full min-w-0">
      <h1 className="text-2xl font-extrabold text-navy-900 mb-1">Fila de revisão</h1>
      <p className="text-sm text-slate-500 mb-6">Inspeções enviadas aguardando decisão do supervisor.</p>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
          <FilterSelect
            label="Técnico"
            value={list.filters.technicianId}
            options={[{ value: 'TODOS', label: 'Todos os técnicos' }, ...technicians.map((t) => ({ value: t.id, label: t.nome }))]}
            onChange={(technicianId) => list.setFilter('technicianId', technicianId)}
          />
          <FilterSelect
            label="Cliente"
            value={list.filters.clientId}
            options={[{ value: 'TODOS', label: 'Todos os clientes' }, ...clients.map((c) => ({ value: c.id, label: c.nome }))]}
            onChange={(clientId) => list.setFilter('clientId', clientId)}
          />
          <SortSelect value={list.sort} options={SORT_OPTIONS} onChange={list.setSort} />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center flex-wrap">
          <label className="text-xs text-slate-500 flex items-center gap-2">
            Enviada de
            <input
              type="datetime-local"
              aria-label="Enviada de"
              value={list.filters.submittedFrom}
              onChange={(e) => list.setFilter('submittedFrom', e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 bg-white"
            />
          </label>
          <label className="text-xs text-slate-500 flex items-center gap-2">
            Enviada até
            <input
              type="datetime-local"
              aria-label="Enviada até"
              value={list.filters.submittedTo}
              onChange={(e) => list.setFilter('submittedTo', e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 bg-white"
            />
          </label>
          {list.hasActiveFilters && (
            <button type="button" onClick={list.clear} className="text-xs font-bold text-navy-700 underline">
              Limpar filtros
            </button>
          )}
        </div>
        {periodInvalid ? <InlineError message={SUBMITTED_PERIOD_ORDER_MESSAGE} /> : null}
      </div>

      {list.status === 'loading' && !periodInvalid && <LoadingState label="Carregando fila de revisão..." />}
      {list.status === 'error' && !periodInvalid && (
        <ErrorState
          title={isForbidden ? 'Acesso não autorizado' : 'Não foi possível carregar a fila'}
          message={list.error ?? 'Não foi possível carregar a fila.'}
          onRetry={isForbidden || isUnauthorized ? undefined : list.reload}
        />
      )}

      {list.status === 'ready' && !periodInvalid && (
        <div className={`bg-white border border-slate-200 rounded-2xl overflow-hidden ${list.refreshing ? 'opacity-70' : ''}`}>
          <table className="hidden xl:table w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead>
              <tr className="text-left text-slate-500 text-xs uppercase border-b border-slate-100">
                <th className="px-5 py-3">Título</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Local</th>
                <th className="px-5 py-3">Técnico</th>
                <th className="px-5 py-3">Prioridade</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Enviada em</th>
                <th className="px-5 py-3">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3 font-semibold text-navy-900 truncate">
                    <Link
                      href={`/inspections/${item.id}?from=review-queue`}
                      aria-label={`Abrir inspeção ${item.title} para revisão`}
                    >
                      {item.title}
                    </Link>
                    {process.env.NODE_ENV === 'development' ? (
                      <div className="font-mono text-[10px] font-normal text-slate-400">{item.id.slice(0, 8)}</div>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 text-slate-700 truncate">{item.clientName}</td>
                  <td className="px-5 py-3 text-slate-500 truncate">{item.siteName}</td>
                  <td className="px-5 py-3 text-slate-600 truncate">{item.technicianName}</td>
                  <td className="px-5 py-3">
                    <PriorityTag priority={item.prioridade} />
                  </td>
                  <td className="px-5 py-3">
                    <InspectionStatusBadge status="ENVIADA" />
                  </td>
                  <td className="px-5 py-3 text-slate-500 font-mono text-xs">{formatDateTime(item.submittedAt)}</td>
                  <td className="px-5 py-3 text-slate-500 font-mono text-xs">{formatDateTime(item.scheduledFor)}</td>
                </tr>
              ))}
              {list.items.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      title="Nenhuma inspeção aguardando revisão"
                      description={
                        list.hasActiveFilters
                          ? 'Ajuste os filtros para ver outros resultados.'
                          : 'Quando os técnicos enviarem inspeções, elas aparecerão aqui.'
                      }
                      action={list.hasActiveFilters ? { label: 'Limpar filtros', onClick: list.clear } : undefined}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="xl:hidden divide-y divide-slate-100">
            {list.items.map((item) => (
              <Link
                key={item.id}
                href={`/inspections/${item.id}?from=review-queue`}
                aria-label={`Abrir inspeção ${item.title} para revisão`}
                className="block p-4 hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-navy-900 truncate">{item.title}</div>
                    <div className="mt-1">
                      <PriorityTag priority={item.prioridade} />
                    </div>
                  </div>
                  <InspectionStatusBadge status="ENVIADA" />
                </div>
                <div className="text-sm text-slate-600 truncate mb-1">
                  {item.clientName} · {item.siteName}
                </div>
                <div className="text-sm text-slate-600 truncate mb-2">{item.technicianName}</div>
                <div className="text-xs text-slate-500">
                  Enviada: {formatDateTime(item.submittedAt)} · Prazo: {formatDateTime(item.scheduledFor)}
                </div>
              </Link>
            ))}
            {list.items.length === 0 && (
              <EmptyState
                title="Nenhuma inspeção aguardando revisão"
                description={
                  list.hasActiveFilters
                    ? 'Ajuste os filtros para ver outros resultados.'
                    : 'Quando os técnicos enviarem inspeções, elas aparecerão aqui.'
                }
                action={list.hasActiveFilters ? { label: 'Limpar filtros', onClick: list.clear } : undefined}
              />
            )}
          </div>
          <div className="px-4">
            <Pagination meta={list.meta} onPage={list.setPage} onSize={list.setSize} />
          </div>
        </div>
      )}
    </div>
  );
}
