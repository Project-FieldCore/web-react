'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/store/app-store';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { ActiveBadge, StatCard } from '@/components/Badges';
import { Field, Modal } from '@/components/Modal';

/**
 * Cadastro de clientes (05 - Perfis; RN-013: inativação, nunca exclusão física).
 * Cada cliente concentra seus locais em /clients/[clientId].
 */
export default function ClientsPage() {
  const clients = useAppStore((s) => s.clients);
  const clientsStatus = useAppStore((s) => s.clientsStatus);
  const clientsError = useAppStore((s) => s.clientsError);
  const loadClients = useAppStore((s) => s.loadClients);
  const locations = useAppStore((s) => s.locations);
  const createClient = useAppStore((s) => s.createClient);
  const setClientActive = useAppStore((s) => s.setClientActive);

  const [search, setSearch] = useState('');
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // A lista vem da API — recarrega a cada visita à tela.
  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const ready = clientsStatus === 'ready';

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clients
      .filter((c) => !showOnlyActive || c.ativo)
      .filter((c) => !term || c.nome.toLowerCase().includes(term));
  }, [clients, search, showOnlyActive]);

  const emptyProps =
    clients.length === 0
      ? { title: 'Nenhum cliente cadastrado', description: 'Crie o primeiro cliente para começar.', action: { label: '+ Novo cliente', onClick: () => setShowNew(true) } }
      : { title: 'Nenhum cliente encontrado', description: 'Ajuste os filtros ou a busca para ver outros resultados.' };

  const locationCount = (clienteId: string) => locations.filter((l) => l.clienteId === clienteId).length;

  async function handleToggleActive(id: string, ativo: boolean) {
    const result = await setClientActive(id, ativo);
    setActionError(result.ok ? null : result.error);
    if (result.ok) setNotice(ativo ? 'Cliente ativado.' : 'Cliente inativado.');
  }

  async function handleCreate(...args: Parameters<typeof createClient>) {
    const result = await createClient(...args);
    if (result.ok) setNotice('Cliente criado.');
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

      {clientsStatus === 'error' && (
        <div className="bg-white border border-slate-200 rounded-2xl mb-6">
          <ErrorState
            title="Não foi possível carregar os clientes"
            message={clientsError ?? 'Tente novamente.'}
            onRetry={() => void loadClients()}
          />
        </div>
      )}

      {(clientsStatus === 'idle' || clientsStatus === 'loading') && (
        <div className="bg-white border border-slate-200 rounded-2xl mb-6">
          <LoadingState label="Carregando clientes..." />
        </div>
      )}

      {ready && (
        <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Clientes cadastrados" value={clients.length} />
          <StatCard label="Ativos" value={clients.filter((c) => c.ativo).length} tone="text-emerald-600" />
          <StatCard label="Locais no total" value={locations.length} tone="text-navy-700" />
        </div>

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <button
            onClick={() => setShowOnlyActive((v) => !v)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              showOnlyActive ? 'bg-navy-900 border-navy-900 text-white' : 'bg-white border-slate-300 text-slate-500'
            }`}
          >
            Somente ativos
          </button>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome..."
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-600 placeholder:text-slate-400 ml-auto w-full sm:w-64"
          />
        </div>

        {actionError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg px-3 py-2 mb-4">{actionError}</div>
        )}

        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl">
            <EmptyState {...emptyProps} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c) => (
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
                    {locationCount(c.id)} {locationCount(c.id) === 1 ? 'local' : 'locais'}
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
