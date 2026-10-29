'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/store/app-store';
import { ActiveBadge } from '@/components/Badges';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Field, Modal } from '@/components/Modal';
import { FilterSelect, Pagination, SearchBox, SortSelect, type SortOption } from '@/components/ListControls';
import { usePagedList } from '@/hooks/usePagedList';
import * as locationsApi from '@/lib/locations-api';
import type { Client, Location } from '@/types';

/**
 * Detalhe do cliente + gestão dos seus locais.
 * RN-009: todo local pertence a um cliente (criado sempre a partir daqui).
 * RN-013: inativação em vez de exclusão física.
 */
export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();

  const client = useAppStore((s) => s.clients.find((c) => c.id === clientId));
  const clientsStatus = useAppStore((s) => s.clientsStatus);
  const clientsError = useAppStore((s) => s.clientsError);
  const loadClients = useAppStore((s) => s.loadClients);
  const updateClient = useAppStore((s) => s.updateClient);
  const setClientActive = useAppStore((s) => s.setClientActive);

  const [nome, setNome] = useState(client?.nome ?? '');
  const [cnpj, setCnpj] = useState(client?.cnpj ?? '');
  const [editError, setEditError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // O cliente vem da API — carrega ao abrir (inclusive em link direto ou refresh).
  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  // Sincroniza os campos quando o cliente chega (ou muda) da API.
  useEffect(() => {
    setNome(client?.nome ?? '');
    setCnpj(client?.cnpj ?? '');
  }, [client?.nome, client?.cnpj, client?.version]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!client && (clientsStatus === 'idle' || clientsStatus === 'loading')) {
    return <LoadingState label="Carregando cliente..." />;
  }
  if (!client && clientsStatus === 'error') {
    return (
      <ErrorState
        title="Não foi possível carregar o cliente"
        message={clientsError ?? 'Tente novamente.'}
        onRetry={() => void loadClients()}
      />
    );
  }
  if (!client) {
    return <ErrorState title="Cliente não encontrado" message="Ele pode ter sido removido ou o link está incorreto." />;
  }

  // Salva nome e/ou CNPJ ao sair do campo, só do que mudou.
  async function handleSave() {
    const patch: { nome?: string; cnpj?: string } = {};
    if (nome !== client!.nome) patch.nome = nome;
    if (cnpj !== (client!.cnpj ?? '')) patch.cnpj = cnpj;
    if (Object.keys(patch).length === 0) return;
    const result = await updateClient(client!.id, patch);
    if (!result.ok) {
      setEditError(result.error);
      return;
    }
    setEditError(null);
    setNotice('Alterações salvas.');
  }

  async function handleToggleClientActive() {
    const result = await setClientActive(client!.id, !client!.ativo);
    if (!result.ok) {
      setEditError(result.error);
      return;
    }
    setEditError(null);
    setNotice(client!.ativo ? 'Cliente inativado.' : 'Cliente ativado.');
  }

  return (
    <div>
      <button onClick={() => router.push('/clients')} className="text-sm font-semibold text-slate-500 hover:text-navy-700 mb-4">
        ← Voltar aos clientes
      </button>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-5">
        <div className="flex flex-col items-start sm:flex-row justify-between gap-2 sm:gap-3 mb-4">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onBlur={handleSave}
            className="text-lg sm:text-xl font-extrabold text-navy-900 border-b border-transparent focus:border-navy-700 outline-none w-full sm:flex-1 sm:min-w-[200px]"
          />
          <ActiveBadge ativo={client.ativo} />
        </div>
        {editError && <p role="alert" className="text-xs text-red-600 font-semibold mb-3">{editError}</p>}
        {notice && <p role="status" className="text-xs text-emerald-700 font-semibold mb-3">{notice}</p>}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            onBlur={handleSave}
            placeholder="CNPJ não informado"
            aria-label="CNPJ"
            className="text-sm text-slate-500 font-mono border-b border-transparent focus:border-navy-700 outline-none w-full sm:w-64"
          />
          <button
            onClick={handleToggleClientActive}
            className={`text-sm font-semibold ${client.ativo ? 'text-slate-500' : 'text-emerald-600'}`}
          >
            {client.ativo ? 'Inativar cliente' : 'Ativar cliente'}
          </button>
        </div>
      </div>

      <LocationsSection key={client.id} client={client} />
    </div>
  );
}

type LocationStatusFilter = 'TODOS' | 'ATIVOS' | 'INATIVOS';

const LOCATION_STATUS_FILTERS: { value: LocationStatusFilter; label: string }[] = [
  { value: 'TODOS', label: 'Todos os status' },
  { value: 'ATIVOS', label: 'Ativos' },
  { value: 'INATIVOS', label: 'Inativos' },
];

// Ordenações aceitas pela API em /sites: name, city e createdAt.
const LOCATION_SORT_OPTIONS: SortOption[] = [
  { label: 'Nome (A–Z)', sort: { field: 'name', dir: 'asc' } },
  { label: 'Nome (Z–A)', sort: { field: 'name', dir: 'desc' } },
  { label: 'Cidade (A–Z)', sort: { field: 'city', dir: 'asc' } },
  { label: 'Mais recentes', sort: { field: 'createdAt', dir: 'desc' } },
];

interface LocationListFilters {
  status: LocationStatusFilter;
}

const LOCATION_INITIAL_FILTERS: LocationListFilters = { status: 'TODOS' };
const LOCATION_PAGE_SIZE_OPTIONS = [6, 12, 24];

/**
 * Locais do cliente: busca, filtro de status, ordenação e paginação feitos na
 * API (GET /sites?clientId=...). `key={client.id}` reinicia a lista ao trocar de cliente.
 */
function LocationsSection({ client }: { client: Client }) {
  const equipment = useAppStore((s) => s.equipment);
  const mergeLocations = useAppStore((s) => s.mergeLocations);
  const createLocation = useAppStore((s) => s.createLocation);
  const setLocationActive = useAppStore((s) => s.setLocationActive);

  const [showNewLocation, setShowNewLocation] = useState(false);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const list = usePagedList<Location, LocationListFilters>(
    ({ filters, ...query }) =>
      locationsApi.searchLocations({
        ...query,
        filters: {
          clienteId: client.id,
          ativo: filters.status === 'TODOS' ? undefined : filters.status === 'ATIVOS',
        },
      }),
    { size: 12, sort: LOCATION_SORT_OPTIONS[0].sort, filters: LOCATION_INITIAL_FILTERS, onLoaded: mergeLocations }
  );

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function handleToggleLocationActive(id: string, ativo: boolean) {
    const result = await setLocationActive(id, ativo);
    setLocationsError(result.ok ? null : result.error);
    if (result.ok) {
      setNotice(ativo ? 'Local ativado.' : 'Local inativado.');
      list.reload();
    }
  }

  async function handleCreateLocation(...args: Parameters<typeof createLocation>) {
    const result = await createLocation(...args);
    if (result.ok) {
      setNotice('Local criado.');
      list.reload();
    }
    return result;
  }

  const equipmentCount = (localId: string) => equipment.filter((e) => e.localId === localId).length;

  const emptyProps = list.hasActiveFilters
    ? { title: 'Nenhum local encontrado', description: 'Nenhum resultado para a busca e o filtro atuais.', action: { label: 'Limpar filtros', onClick: list.clear } }
    : { title: 'Nenhum local cadastrado', description: 'Este cliente ainda não tem locais.', action: { label: '+ Novo local', onClick: () => setShowNewLocation(true) } };

  return (
    <section aria-label="Locais do cliente">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-navy-900">
          Locais{list.meta ? ` (${list.meta.totalElements})` : ''}
        </h2>
        <button onClick={() => setShowNewLocation(true)} className="text-sm font-bold text-brandgreen-600">
          + Novo local
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <FilterSelect
          label="Filtrar por status"
          value={list.filters.status}
          options={LOCATION_STATUS_FILTERS}
          onChange={(v) => list.setFilter('status', v)}
        />
        <SortSelect value={list.sort} options={LOCATION_SORT_OPTIONS} onChange={list.setSort} />
        {list.hasActiveFilters && (
          <button onClick={list.clear} className="text-xs font-semibold text-navy-700">Limpar filtros</button>
        )}
        <div className="ml-auto w-full sm:w-auto">
          <SearchBox value={list.input} onChange={list.setInput} placeholder="Buscar por nome, cidade ou estado..." />
        </div>
      </div>

      {notice && (
        <div role="status" className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg px-3 py-2 mb-3">
          {notice}
        </div>
      )}

      {locationsError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg px-3 py-2 mb-3">{locationsError}</div>
      )}

      {list.status === 'loading' && (
        <div className="bg-white border border-slate-200 rounded-2xl">
          <LoadingState label="Carregando locais..." />
        </div>
      )}

      {list.status === 'error' && (
        <div className="bg-white border border-slate-200 rounded-2xl">
          <ErrorState title="Não foi possível carregar os locais" message={list.error ?? 'Tente novamente.'} onRetry={list.reload} />
        </div>
      )}

      {list.status === 'ready' && (
        <>
          {list.items.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl">
              <EmptyState {...emptyProps} />
            </div>
          ) : (
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity ${list.refreshing ? 'opacity-60' : ''}`}
              aria-busy={list.refreshing}
            >
              {list.items.map((l) => (
                <div key={l.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Link href={`/clients/${client.id}/sites/${l.id}`} className="font-bold text-navy-900 hover:underline leading-snug">
                      {l.nome}
                    </Link>
                    <ActiveBadge ativo={l.ativo} />
                  </div>
                  {l.endereco && <p className="text-xs text-slate-400 mb-3">{l.endereco}</p>}
                  <div className="mt-auto flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                      {equipmentCount(l.id)} equipamento{equipmentCount(l.id) === 1 ? '' : 's'}
                    </span>
                    <button
                      onClick={() => handleToggleLocationActive(l.id, !l.ativo)}
                      className={`text-xs font-semibold ${l.ativo ? 'text-slate-500' : 'text-emerald-600'}`}
                    >
                      {l.ativo ? 'Inativar' : 'Ativar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Pagination meta={list.meta} onPage={list.setPage} onSize={list.setSize} sizeOptions={LOCATION_PAGE_SIZE_OPTIONS} />
        </>
      )}

      {showNewLocation && (
        <NewLocationModal clienteId={client.id} onClose={() => setShowNewLocation(false)} onCreate={handleCreateLocation} />
      )}
    </section>
  );
}

function NewLocationModal({
  clienteId,
  onClose,
  onCreate,
}: {
  clienteId: string;
  onClose: () => void;
  onCreate: (clienteId: string, nome: string, endereco?: string) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
}) {
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await onCreate(clienteId, nome, endereco || undefined);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    <Modal title="Novo local" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Nome" required>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required autoFocus />
        </Field>
        <Field label="Endereço (opcional)">
          <input value={endereco} onChange={(e) => setEndereco(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </Field>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg px-3 py-2 mb-3">{error}</div>}
        <button type="submit" disabled={loading} className="w-full bg-brandgreen-600 text-white rounded-xl py-2.5 font-bold mt-1 disabled:opacity-60">
          {loading ? 'Criando...' : 'Criar local'}
        </button>
      </form>
    </Modal>
  );
}
