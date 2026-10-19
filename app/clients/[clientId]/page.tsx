'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/store/app-store';
import { ActiveBadge } from '@/components/Badges';
import { Field, Modal } from '@/components/Modal';

/**
 * Detalhe do cliente + gestão dos seus locais.
 * RN-009: todo local pertence a um cliente (criado sempre a partir daqui).
 * RN-013: inativação em vez de exclusão física.
 */
export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();

  const client = useAppStore((s) => s.clients.find((c) => c.id === clientId));
  const locations = useAppStore((s) => s.locations.filter((l) => l.clienteId === clientId));
  const equipment = useAppStore((s) => s.equipment);
  const updateClient = useAppStore((s) => s.updateClient);
  const setClientActive = useAppStore((s) => s.setClientActive);
  const createLocation = useAppStore((s) => s.createLocation);
  const setLocationActive = useAppStore((s) => s.setLocationActive);

  const [showNewLocation, setShowNewLocation] = useState(false);
  const [nome, setNome] = useState(client?.nome ?? '');
  const [editError, setEditError] = useState<string | null>(null);
  const [locationsError, setLocationsError] = useState<string | null>(null);

  if (!client) return <div className="text-slate-500">Cliente não encontrado.</div>;

  async function handleRename() {
    if (nome === client!.nome) return;
    const result = await updateClient(client!.id, { nome });
    if (!result.ok) setEditError(result.error);
    else setEditError(null);
  }

  async function handleToggleClientActive() {
    const result = await setClientActive(client!.id, !client!.ativo);
    if (!result.ok) setEditError(result.error);
  }

  async function handleToggleLocationActive(id: string, ativo: boolean) {
    const result = await setLocationActive(id, ativo);
    setLocationsError(result.ok ? null : result.error);
  }

  const equipmentCount = (localId: string) => equipment.filter((e) => e.localId === localId).length;

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
            onBlur={handleRename}
            className="text-lg sm:text-xl font-extrabold text-navy-900 border-b border-transparent focus:border-navy-700 outline-none w-full sm:flex-1 sm:min-w-[200px]"
          />
          <ActiveBadge ativo={client.ativo} />
        </div>
        {editError && <p className="text-xs text-red-600 font-semibold mb-3">{editError}</p>}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <span className="text-sm text-slate-500 font-mono">{client.cnpj ?? 'CNPJ não informado'}</span>
          <button
            onClick={handleToggleClientActive}
            className={`text-sm font-semibold ${client.ativo ? 'text-slate-500' : 'text-emerald-600'}`}
          >
            {client.ativo ? 'Inativar cliente' : 'Ativar cliente'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-navy-900">Locais</h2>
        <button onClick={() => setShowNewLocation(true)} className="text-sm font-bold text-brandgreen-600">
          + Novo local
        </button>
      </div>

      {locationsError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg px-3 py-2 mb-3">{locationsError}</div>
      )}

      {locations.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center text-sm text-slate-400">
          Nenhum local cadastrado para este cliente ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((l) => (
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

      {showNewLocation && (
        <NewLocationModal clienteId={client.id} onClose={() => setShowNewLocation(false)} onCreate={createLocation} />
      )}
    </div>
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
