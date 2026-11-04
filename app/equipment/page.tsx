'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/store/app-store';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { ActiveBadge, StatCard } from '@/components/Badges';
import { FilterSelect, Pagination, SearchBox, SortSelect, type SortOption } from '@/components/ListControls';
import { usePagedList } from '@/hooks/usePagedList';
import * as equipmentApi from '@/lib/equipment-api';
import type { Equipment } from '@/types';

type StatusFilter = 'TODOS' | 'ATIVOS' | 'INATIVOS';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'TODOS', label: 'Todos os status' },
  { value: 'ATIVOS', label: 'Ativos' },
  { value: 'INATIVOS', label: 'Inativos' },
];

const SORT_OPTIONS: SortOption[] = [
  { label: 'Nome (A–Z)', sort: { field: 'name', dir: 'asc' } },
  { label: 'Nome (Z–A)', sort: { field: 'name', dir: 'desc' } },
  { label: 'Mais recentes', sort: { field: 'createdAt', dir: 'desc' } },
];

interface EquipmentListFilters {
  status: StatusFilter;
  clientId: string;
}

const INITIAL_FILTERS: EquipmentListFilters = { status: 'TODOS', clientId: 'TODOS' };

/**
 * Catálogo global de equipamentos (PBI-0015.1 / 0016.1).
 * Criação a partir do local (RN-010). QR exibido com copiar (RN-011).
 */
export default function EquipmentCatalogPage() {
  const equipment = useAppStore((s) => s.equipment);
  const equipmentStatus = useAppStore((s) => s.equipmentStatus);
  const loadEquipment = useAppStore((s) => s.loadEquipment);
  const mergeEquipment = useAppStore((s) => s.mergeEquipment);
  const locations = useAppStore((s) => s.locations);
  const locationsStatus = useAppStore((s) => s.locationsStatus);
  const loadLocations = useAppStore((s) => s.loadLocations);
  const clients = useAppStore((s) => s.clients);
  const loadClients = useAppStore((s) => s.loadClients);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const locationOf = (localId: string) => locations.find((l) => l.id === localId);
  const clientOf = (localId: string) => {
    const loc = locationOf(localId);
    return loc ? clients.find((c) => c.id === loc.clienteId) : undefined;
  };

  // Filtro de cliente é resolvido localmente (API filtra por siteId, não clientId).
  const list = usePagedList<Equipment, EquipmentListFilters>(
    async ({ filters, ...query }) => {
      const siteIds =
        filters.clientId === 'TODOS'
          ? undefined
          : locations.filter((l) => l.clienteId === filters.clientId).map((l) => l.id);

      // Sem locais do cliente ainda → página vazia (evita listar todos).
      if (siteIds && siteIds.length === 0) {
        return { items: [], page: { page: query.page, size: query.size, totalElements: 0, totalPages: 0 } };
      }

      // API aceita um siteId; com vários locais do cliente, busca sem site e filtra depois.
      if (siteIds && siteIds.length === 1) {
        return equipmentApi.searchEquipment({
          ...query,
          filters: {
            ativo: filters.status === 'TODOS' ? undefined : filters.status === 'ATIVOS',
            localId: siteIds[0],
          },
        });
      }

      const page = await equipmentApi.searchEquipment({
        ...query,
        filters: { ativo: filters.status === 'TODOS' ? undefined : filters.status === 'ATIVOS' },
      });
      if (!siteIds) return page;
      const items = page.items.filter((e) => siteIds.includes(e.localId));
      return {
        items,
        page: { ...page.page, totalElements: items.length, totalPages: items.length ? 1 : 0 },
      };
    },
    { size: 12, sort: SORT_OPTIONS[0].sort, filters: INITIAL_FILTERS, onLoaded: mergeEquipment }
  );

  useEffect(() => {
    void loadEquipment();
    void loadLocations();
    void loadClients();
  }, [loadEquipment, loadLocations, loadClients]);

  useEffect(() => {
    if (!notice && !copiedId) return;
    const timer = setTimeout(() => {
      setNotice(null);
      setCopiedId(null);
    }, 2500);
    return () => clearTimeout(timer);
  }, [notice, copiedId]);

  const summaryReady = equipmentStatus === 'ready';
  const summary = (value: number) => (summaryReady ? value : '—');

  async function copyQr(eq: Equipment) {
    try {
      await navigator.clipboard.writeText(eq.qrCode);
      setCopiedId(eq.id);
      setNotice('Código QR copiado.');
    } catch {
      setNotice('Não foi possível copiar o código QR.');
    }
  }

  const emptyProps = list.hasActiveFilters
    ? {
        title: 'Nenhum equipamento encontrado',
        description: 'Nenhum resultado para a busca e os filtros atuais.',
        action: { label: 'Limpar filtros', onClick: list.clear },
      }
    : {
        title: 'Nenhum equipamento cadastrado',
        description: 'Cadastre o primeiro equipamento a partir do local correspondente (RN-010).',
      };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-navy-900">Equipamentos</h1>
        <p className="text-sm text-slate-500">
          Catálogo consolidado — para cadastrar um novo, acesse o local correspondente (RN-010).
        </p>
      </div>

      {notice && (
        <div role="status" className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg px-3 py-2 mb-4">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total de equipamentos" value={summary(equipment.length)} />
        <StatCard label="Ativos" value={summary(equipment.filter((e) => e.ativo).length)} tone="text-emerald-600" />
        <StatCard
          label="Locais com equipamento"
          value={summary(new Set(equipment.map((e) => e.localId)).size)}
          tone="text-navy-700"
        />
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={list.filters.clientId}
          onChange={(e) => list.setFilter('clientId', e.target.value)}
          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-600"
          disabled={locationsStatus !== 'ready'}
        >
          <option value="TODOS">Todos os clientes</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <FilterSelect
          label="Filtrar por status"
          value={list.filters.status}
          options={STATUS_FILTERS}
          onChange={(v) => list.setFilter('status', v)}
        />
        <div className="xl:hidden">
          <SortSelect value={list.sort} options={SORT_OPTIONS} onChange={list.setSort} />
        </div>
        {list.hasActiveFilters && (
          <button onClick={list.clear} className="text-xs font-semibold text-navy-700">
            Limpar filtros
          </button>
        )}
        <div className="ml-auto w-full sm:w-auto">
          <SearchBox value={list.input} onChange={list.setInput} placeholder="Buscar por nome ou código QR..." />
        </div>
      </div>

      {list.status === 'loading' && (
        <div className="bg-white border border-slate-200 rounded-2xl">
          <LoadingState label="Carregando equipamentos..." />
        </div>
      )}

      {list.status === 'error' && (
        <div className="bg-white border border-slate-200 rounded-2xl">
          <ErrorState
            title="Não foi possível carregar os equipamentos"
            message={list.error ?? 'Tente novamente.'}
            onRetry={list.reload}
          />
        </div>
      )}

      {list.status === 'ready' && (
        <>
          <div
            className={`bg-white border border-slate-200 rounded-2xl overflow-hidden transition-opacity ${list.refreshing ? 'opacity-60' : ''}`}
            aria-busy={list.refreshing}
          >
            <table className="hidden xl:table w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[14%]" />
                <col className="w-[26%]" />
                <col className="w-[18%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead>
                <tr className="text-left text-slate-500 text-xs uppercase border-b border-slate-100">
                  <th className="px-5 py-3">Equipamento</th>
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Código QR</th>
                  <th className="px-5 py-3">Cliente / local</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((eq) => {
                  const loc = locationOf(eq.localId);
                  const client = clientOf(eq.localId);
                  return (
                    <tr key={eq.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3 font-semibold text-navy-900 truncate">{eq.nome}</td>
                      <td className="px-5 py-3 text-slate-600 truncate">{eq.tipo ?? '—'}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs text-slate-500 truncate">{eq.qrCode}</span>
                          <button
                            type="button"
                            onClick={() => void copyQr(eq)}
                            className="shrink-0 text-[11px] font-bold text-navy-700"
                          >
                            {copiedId === eq.id ? 'Copiado' : 'Copiar'}
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-600 truncate">
                        {client?.nome ?? '—'} · {loc?.nome ?? '—'}
                      </td>
                      <td className="px-5 py-3">
                        <ActiveBadge ativo={eq.ativo} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        {client && loc && (
                          <Link
                            href={`/clients/${client.id}/sites/${loc.id}`}
                            className="text-xs font-bold text-navy-700 whitespace-nowrap"
                          >
                            Gerenciar →
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {list.items.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState {...emptyProps} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="xl:hidden divide-y divide-slate-100">
              {list.items.map((eq) => {
                const loc = locationOf(eq.localId);
                const client = clientOf(eq.localId);
                return (
                  <div key={eq.id} className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <span className="font-semibold text-navy-900 truncate min-w-0">{eq.nome}</span>
                      <ActiveBadge ativo={eq.ativo} />
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-slate-500 truncate">{eq.qrCode}</span>
                      <button type="button" onClick={() => void copyQr(eq)} className="text-[11px] font-bold text-navy-700 shrink-0">
                        {copiedId === eq.id ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                    <div className="text-xs text-slate-500 mb-2">
                      {client?.nome ?? '—'} · {loc?.nome ?? '—'}
                    </div>
                    {client && loc && (
                      <Link href={`/clients/${client.id}/sites/${loc.id}`} className="text-xs font-bold text-navy-700">
                        Gerenciar →
                      </Link>
                    )}
                  </div>
                );
              })}
              {list.items.length === 0 && <EmptyState {...emptyProps} />}
            </div>
          </div>
          <Pagination meta={list.meta} onPage={list.setPage} onSize={list.setSize} />
        </>
      )}
    </div>
  );
}
