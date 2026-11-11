'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/store/app-store';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { InspectionStatusBadge, PriorityTag } from '@/components/Badges';
import { FilterSelect, Pagination, SortSelect, type SortOption } from '@/components/ListControls';
import { formatDateTime } from '@/lib/inspection-display';
import { inspectionStatusToApi, listInspections } from '@/lib/inspections-api';
import { usePagedList } from '@/hooks/usePagedList';
import type { Inspection, InspectionStatus } from '@/types';

const STATUS_FILTERS: { value: 'TODAS' | InspectionStatus; label: string }[] = [
  { value: 'TODAS', label: 'Todos os estados' },
  { value: 'ATRIBUIDA', label: 'Atribuídas' },
  { value: 'EM_ANDAMENTO', label: 'Em andamento' },
  { value: 'ENVIADA', label: 'Aguardando revisão' },
  { value: 'EM_REVISAO', label: 'Em revisão' },
  { value: 'APROVADA', label: 'Aprovadas' },
  { value: 'REPROVADA', label: 'Reprovadas' },
  { value: 'CANCELADA', label: 'Canceladas' },
];

const SORT_OPTIONS: SortOption[] = [
  { label: 'Prazo (mais próximo)', sort: { field: 'scheduledFor', dir: 'asc' } },
  { label: 'Prazo (mais distante)', sort: { field: 'scheduledFor', dir: 'desc' } },
  { label: 'Prioridade', sort: { field: 'priority', dir: 'desc' } },
  { label: 'Estado', sort: { field: 'status', dir: 'asc' } },
  { label: 'Mais recentes', sort: { field: 'createdAt', dir: 'desc' } },
];

interface InspectionFilters {
  status: 'TODAS' | InspectionStatus;
  technicianId: string;
  clientId: string;
  scheduledFrom: string;
  scheduledTo: string;
}

const INITIAL_FILTERS: InspectionFilters = {
  status: 'TODAS',
  technicianId: 'TODOS',
  clientId: 'TODOS',
  scheduledFrom: '',
  scheduledTo: '',
};

function toIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * UC-15 — Acompanhar inspeções (PBI-0030.2).
 * A lista vem de GET /inspections, com filtros de estado, período, técnico e cliente.
 */
export default function InspectionsListPage() {
  const clients = useAppStore((s) => s.clients);
  const users = useAppStore((s) => s.users);
  const loadClients = useAppStore((s) => s.loadClients);
  const loadUsers = useAppStore((s) => s.loadUsers);
  const technicians = users.filter((u) => u.role === 'TECHNICIAN' && u.status === 'ATIVO');

  const list = usePagedList<Inspection, InspectionFilters>(
    (query) =>
      listInspections({
        ...query,
        filters: {
          status: query.filters.status === 'TODAS' ? undefined : inspectionStatusToApi(query.filters.status),
          technicianId: query.filters.technicianId === 'TODOS' ? undefined : query.filters.technicianId,
          clientId: query.filters.clientId === 'TODOS' ? undefined : query.filters.clientId,
          scheduledFrom: toIso(query.filters.scheduledFrom),
          scheduledTo: toIso(query.filters.scheduledTo),
        },
      }),
    {
      size: 20,
      sort: SORT_OPTIONS[0].sort,
      filters: INITIAL_FILTERS,
      onLoaded: (items) => {
        useAppStore.setState((s) => {
          const incoming = new Map(items.map((item) => [item.id, item]));
          const merged = s.inspections.map((current) => {
            const next = incoming.get(current.id);
            if (!next) return current;
            incoming.delete(current.id);
            return {
              ...current,
              clienteId: next.clienteId,
              localId: next.localId,
              tecnicoId: next.tecnicoId,
              prioridade: next.prioridade,
              dataPrevista: next.dataPrevista,
              orientacoes: next.orientacoes,
              status: next.status,
              cancelamento: next.cancelamento ?? current.cancelamento,
              version: next.version,
            };
          });
          return { inspections: [...merged, ...incoming.values()] };
        });
      },
    }
  );

  useEffect(() => {
    void loadClients();
    void loadUsers();
  }, [loadClients, loadUsers]);

  const clientName = (id: string) => clients.find((c) => c.id === id)?.nome ?? '—';
  const techName = (id: string) => users.find((u) => u.id === id)?.nome ?? '—';

  return (
    <div className="w-full min-w-0">
      <h1 className="text-2xl font-extrabold text-navy-900 mb-1">Inspeções</h1>
      <p className="text-sm text-slate-500 mb-6">Acompanhe o andamento e abra a revisão das inspeções enviadas (UC-15, UC-16)</p>

      {list.filters.status === 'ENVIADA' && (
        <p className="text-sm text-slate-600 mb-4">
          <Link href="/inspections/review-queue" className="font-bold text-navy-700 underline">
            Abrir fila de revisão
          </Link>
        </p>
      )}

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
          <FilterSelect
            label="Estado"
            value={list.filters.status}
            options={STATUS_FILTERS}
            onChange={(status) => list.setFilter('status', status)}
          />
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
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="text-xs text-slate-500 flex items-center gap-2">
            De
            <input
              type="datetime-local"
              aria-label="Data inicial"
              value={list.filters.scheduledFrom}
              onChange={(e) => list.setFilter('scheduledFrom', e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 bg-white"
            />
          </label>
          <label className="text-xs text-slate-500 flex items-center gap-2">
            Até
            <input
              type="datetime-local"
              aria-label="Data final"
              value={list.filters.scheduledTo}
              onChange={(e) => list.setFilter('scheduledTo', e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 bg-white"
            />
          </label>
          {list.hasActiveFilters && (
            <button type="button" onClick={list.clear} className="text-xs font-bold text-navy-700 underline">
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {list.status === 'loading' && <LoadingState label="Carregando inspeções..." />}
      {list.status === 'error' && (
        <ErrorState
          title={list.errorCopy?.title}
          message={list.error ?? 'Não foi possível carregar as inspeções.'}
          onRetry={list.errorCopy?.retry === false ? undefined : list.reload}
        />
      )}

      {list.status === 'ready' && (
        <div className={`bg-white border border-slate-200 rounded-2xl overflow-hidden ${list.refreshing ? 'opacity-70' : ''}`}>
          <table className="hidden xl:table w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[10%]" />
              <col className="w-[21%]" />
              <col className="w-[18%]" />
              <col className="w-[13%]" />
              <col className="w-[24%]" />
              <col className="w-[14%]" />
            </colgroup>
            <thead>
              <tr className="text-left text-slate-500 text-xs uppercase border-b border-slate-100">
                <th className="px-5 py-3">ID</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Técnico</th>
                <th className="px-5 py-3">Prioridade</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Previsão</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((i) => (
                <tr key={i.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono text-xs text-slate-400 truncate">{i.id}</td>
                  <td className="px-5 py-3 font-semibold text-navy-900 truncate">
                    <Link href={`/inspections/${i.id}`}>{clientName(i.clienteId)}</Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600 truncate">{techName(i.tecnicoId)}</td>
                  <td className="px-5 py-3"><PriorityTag priority={i.prioridade} /></td>
                  <td className="px-5 py-3"><InspectionStatusBadge status={i.status} /></td>
                  <td className="px-5 py-3 text-slate-500 font-mono text-xs">{formatDateTime(i.dataPrevista)}</td>
                </tr>
              ))}
              {list.items.length === 0 && (
                <tr><td colSpan={6}><EmptyState title="Nenhuma inspeção encontrada" description="Ajuste os filtros para ver outros resultados." /></td></tr>
              )}
            </tbody>
          </table>

          <div className="xl:hidden divide-y divide-slate-100">
            {list.items.map((i) => (
              <Link key={i.id} href={`/inspections/${i.id}`} className="block p-4 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-navy-900 truncate">{clientName(i.clienteId)}</div>
                    <div className="text-xs font-mono text-slate-400 truncate">{i.id}</div>
                  </div>
                  <InspectionStatusBadge status={i.status} />
                </div>
                <div className="flex items-center justify-between gap-3 text-sm text-slate-600 mb-2">
                  <span className="truncate min-w-0">{techName(i.tecnicoId)}</span>
                  <PriorityTag priority={i.prioridade} />
                </div>
                <div className="text-xs font-mono text-slate-500">{formatDateTime(i.dataPrevista)}</div>
              </Link>
            ))}
            {list.items.length === 0 && (
              <EmptyState title="Nenhuma inspeção encontrada" description="Ajuste os filtros para ver outros resultados." />
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
