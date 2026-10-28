'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/store/app-store';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { ActiveBadge, StatCard } from '@/components/Badges';
import { Field, Modal } from '@/components/Modal';
import { FilterSelect, Pagination, SearchBox, SortSelect, type SortOption } from '@/components/ListControls';
import { usePagedList } from '@/hooks/usePagedList';
import * as clientsApi from '@/lib/clients-api';
import type { Client } from '@/types';

type ClientStatusFilter = 'TODOS' | 'ATIVOS' | 'INATIVOS';

const STATUS_FILTERS: { value: ClientStatusFilter; label: string }[] = [
  { value: 'TODOS', label: 'Todos os status' },
  { value: 'ATIVOS', label: 'Ativos' },
  { value: 'INATIVOS', label: 'Inativos' },
];

// Ordenações aceitas pela API em /clients: name e createdAt.
const SORT_OPTIONS: SortOption[] = [
  { label: 'Nome (A–Z)', sort: { field: 'name', dir: 'asc' } },
  { label: 'Nome (Z–A)', sort: { field: 'name', dir: 'desc' } },
  { label: 'Mais recentes', sort: { field: 'createdAt', dir: 'desc' } },
  { label: 'Mais antigos', sort: { field: 'createdAt', dir: 'asc' } },
];

interface ClientListFilters {
  status: ClientStatusFilter;
}

const INITIAL_FILTERS: ClientListFilters = { status: 'TODOS' };

const PAGE_SIZE_OPTIONS = [6, 12, 24];

/**
 * Cadastro de clientes (05 - Perfis; RN-013: inativação, nunca exclusão física).
 * Cada cliente concentra seus locais em /clients/[clientId].
 */
export default function ClientsPage() {
  const clients = useAppStore((s) => s.clients);
  const clientsStatus = useAppStore((s) => s.clientsStatus);
  const loadClients = useAppStore((s) => s.loadClients);
  const mergeClients = useAppStore((s) => s.mergeClients);
  const locations = useAppStore((s) => s.locations);
  const locationsStatus = useAppStore((s) => s.locationsStatus);
  const loadLocations = useAppStore((s) => s.loadLocations);
  const createClient = useAppStore((s) => s.createClient);
  const setClientActive = useAppStore((s) => s.setClientActive);

  const [showNew, setShowNew] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Busca, filtro, ordenação e paginação são feitos na API (PBI-0017.1).
  // Cada página carregada leva os itens ao store, para editar usar o `version` atual.
  const list = usePagedList<Client, ClientListFilters>(
    ({ filters, ...query }) =>
      clientsApi.searchClients({
        ...query,
        filters: { ativo: filters.status === 'TODOS' ? undefined : filters.status === 'ATIVOS' },
      }),
    { size: 12, sort: SORT_OPTIONS[0].sort, filters: INITIAL_FILTERS, onLoaded: mergeClients }
  );

  // Os cartões de resumo e a contagem de locais usam o cadastro completo.
  useEffect(() => {
    void loadClients();
    void loadLocations();
  }, [loadClients, loadLocations]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const summaryReady = clientsStatus === 'ready';
  // Até os locais chegarem da API, não mostra a contagem de exemplo.
  const locationsReady = locationsStatus === 'ready';
  const locationCount = (clienteId: string) => locations.filter((l) => l.clienteId === clienteId).length;

  const emptyProps = list.hasActiveFilters
    ? { title: 'Nenhum cliente encontrado', description: 'Nenhum resultado para a busca e o filtro atuais.', action: { label: 'Limpar filtros', onClick: list.clear } }
    : { title: 'Nenhum cliente cadastrado', description: 'Crie o primeiro cliente para começar.', action: { label: '+ Novo cliente', onClick: () => setShowNew(true) } };

  async function handleToggleActive(id: string, ativo: boolean) {
    const result = await setClientActive(id, ativo);
    setActionError(result.ok ? null : result.error);
    if (result.ok) {
      setNotice(ativo ? 'Cliente ativado.' : 'Cliente inativado.');
      list.reload();
    }
  }

  async function handleCreate(...args: Parameters<typeof createClient>) {
    const result = await createClient(...args);
    if (result.ok) {
      setNotice('Cliente criado.');
      list.reload();
    }
    return result;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">Clientes e locais</h1>
          <p className="text-sm text-slate-500">Cada local pertence a um cliente (RN-009); equipamentos ficam dentro do local.</p>
        </div>
        <button onClick={() => setShowNew(true)} className="bg-brandgreen-600 text-white font-bold text-sm rounded-xl px-4 py-2.5 whitespace-nowrap">
          + Novo cliente
        </button>
      </div>

      {notice && (
        <div role="status" className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg px-3 py-2 mb-4">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Clientes cadastrados" value={summaryReady ? clients.length : '—'} />
        <StatCard label="Ativos" value={summaryReady ? clients.filter((c) => c.ativo).length : '—'} tone="text-emerald-600" />
        <StatCard label="Locais no total" value={locationsReady ? locations.length : '—'} tone="text-navy-700" />
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <FilterSelect
          label="Filtrar por status"
          value={list.filters.status}
          options={STATUS_FILTERS}
          onChange={(v) => list.setFilter('status', v)}
        />
        <SortSelect value={list.sort} options={SORT_OPTIONS} onChange={list.setSort} />
        {list.hasActiveFilters && (
          <button onClick={list.clear} className="text-xs font-semibold text-navy-700">Limpar filtros</button>
        )}
        <div className="ml-auto w-full sm:w-auto">
          <SearchBox value={list.input} onChange={list.setInput} placeholder="Buscar por nome, CNPJ ou e-mail..." />
        </div>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg px-3 py-2 mb-4">{actionError}</div>
      )}

      {list.status === 'loading' && (
        <div className="bg-white border border-slate-200 rounded-2xl">
          <LoadingState label="Carregando clientes..." />
        </div>
      )}

      {list.status === 'error' && (
        <div className="bg-white border border-slate-200 rounded-2xl">
          <ErrorState title="Não foi possível carregar os clientes" message={list.error ?? 'Tente novamente.'} onRetry={list.reload} />
        </div>
      )}

      {list.status === 'ready' && (
        <>
          {list.items.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl">
              <EmptyState {...emptyProps} />
            </div>
          ) : (
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity ${list.refreshing ? 'opacity-60' : ''}`}
              aria-busy={list.refreshing}
            >
              {list.items.map((c) => (
                <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Link href={`/clients/${c.id}`} className="font-bold text-navy-900 hover:underline leading-snug">
                      {c.nome}
                    </Link>
                    <ActiveBadge ativo={c.ativo} />
                  </div>
                  {c.cnpj && <p className="text-xs text-slate-400 font-mono mb-3">{c.cnpj}</p>}
                  <div className="mt-auto flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                      {locationsReady ? `${locationCount(c.id)} ${locationCount(c.id) === 1 ? 'local' : 'locais'}` : 'Locais…'}
                    </span>
                    <button
                      onClick={() => handleToggleActive(c.id, !c.ativo)}
                      className={`text-xs font-semibold ${c.ativo ? 'text-slate-500' : 'text-emerald-600'}`}
                    >
                      {c.ativo ? 'Inativar' : 'Ativar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Pagination meta={list.meta} onPage={list.setPage} onSize={list.setSize} sizeOptions={PAGE_SIZE_OPTIONS} />
        </>
      )}

      {showNew && <NewClientModal onClose={() => setShowNew(false)} onCreate={handleCreate} />}
    </div>
  );
}

function NewClientModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (nome: string, cnpj?: string) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
}) {
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await onCreate(nome, cnpj || undefined);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    <Modal title="Novo cliente" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Nome" required>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required autoFocus />
        </Field>
        <Field label="CNPJ (opcional)">
          <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="00.000.000/0000-00" />
        </Field>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg px-3 py-2 mb-3">{error}</div>}
        <button type="submit" disabled={loading} className="w-full bg-brandgreen-600 text-white rounded-xl py-2.5 font-bold mt-1 disabled:opacity-60">
          {loading ? 'Criando...' : 'Criar cliente'}
        </button>
      </form>
    </Modal>
  );
}
