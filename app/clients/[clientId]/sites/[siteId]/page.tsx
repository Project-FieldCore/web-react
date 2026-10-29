'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/store/app-store';
import { ActiveBadge } from '@/components/Badges';
import { Field, Modal } from '@/components/Modal';
import { ErrorState, LoadingState } from '@/components/States';

/**
 * Detalhe do local + gestão dos seus equipamentos.
 * RN-010: todo equipamento pertence a um local no MVP (criado sempre a partir daqui).
 * RN-011: QR Code único — validado no store ao criar/editar.
 * RN-013: inativação em vez de exclusão física.
 */
export default function SiteDetailPage() {
  const { clientId, siteId } = useParams<{ clientId: string; siteId: string }>();
  const router = useRouter();

  const client = useAppStore((s) => s.clients.find((c) => c.id === clientId));
  const clientsStatus = useAppStore((s) => s.clientsStatus);
  const loadClients = useAppStore((s) => s.loadClients);
  const location = useAppStore((s) => s.locations.find((l) => l.id === siteId));
  const locationsStatus = useAppStore((s) => s.locationsStatus);
  const locationsError = useAppStore((s) => s.locationsError);
  const loadLocations = useAppStore((s) => s.loadLocations);
  const equipmentList = useAppStore((s) => s.equipment.filter((e) => e.localId === siteId));
  const updateLocation = useAppStore((s) => s.updateLocation);
  const setLocationActive = useAppStore((s) => s.setLocationActive);
  const createEquipment = useAppStore((s) => s.createEquipment);
  const updateEquipment = useAppStore((s) => s.updateEquipment);
  const setEquipmentActive = useAppStore((s) => s.setEquipmentActive);

  const [showNewEquipment, setShowNewEquipment] = useState(false);
  const [nome, setNome] = useState(location?.nome ?? '');
  const [endereco, setEndereco] = useState(location?.endereco ?? '');
  const [editError, setEditError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Cliente e local vêm da API — carrega ao abrir (inclusive em link direto ou refresh).
  useEffect(() => {
    void loadClients();
    void loadLocations();
  }, [loadClients, loadLocations]);

  // Sincroniza os campos quando o local chega (ou muda) da API.
  useEffect(() => {
    setNome(location?.nome ?? '');
    setEndereco(location?.endereco ?? '');
  }, [location?.nome, location?.endereco, location?.version]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const loading =
    (!client && (clientsStatus === 'idle' || clientsStatus === 'loading')) ||
    (!location && (locationsStatus === 'idle' || locationsStatus === 'loading'));
  if (loading) return <LoadingState label="Carregando local..." />;
  if ((!client && clientsStatus === 'error') || (!location && locationsStatus === 'error')) {
    return (
      <ErrorState
        title="Não foi possível carregar o local"
        message={(!location ? locationsError : null) ?? 'Tente novamente.'}
        onRetry={() => {
          void loadClients();
          void loadLocations();
        }}
      />
    );
  }
  if (!client || !location || location.clienteId !== client.id) {
    return <ErrorState title="Local não encontrado" message="Ele pode ter sido removido ou o link está incorreto." />;
  }

  // Salva nome e/ou endereço ao sair do campo, só do que mudou.
  async function handleSave() {
    const patch: { nome?: string; endereco?: string } = {};
    if (nome !== location!.nome) patch.nome = nome;
    if (endereco !== (location!.endereco ?? '')) patch.endereco = endereco;
    if (Object.keys(patch).length === 0) return;
    const result = await updateLocation(location!.id, patch);
    if (!result.ok) {
      setEditError(result.error);
      return;
    }
    setEditError(null);
    setNotice('Alterações salvas.');
  }

  async function handleToggleLocationActive() {
    const result = await setLocationActive(location!.id, !location!.ativo);
    if (!result.ok) {
      setEditError(result.error);
      return;
    }
    setEditError(null);
    setNotice(location!.ativo ? 'Local inativado.' : 'Local ativado.');
  }

  return (
    <div>
      <button onClick={() => router.push(`/clients/${client.id}`)} className="text-sm font-semibold text-slate-500 hover:text-navy-700 mb-4">
        ← Voltar a {client.nome}
      </button>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-5">
        <div className="flex flex-col items-start sm:flex-row justify-between gap-2 sm:gap-3 mb-4">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onBlur={handleSave}
            className="text-lg sm:text-xl font-extrabold text-navy-900 border-b border-transparent focus:border-navy-700 outline-none w-full sm:flex-1 sm:min-w-[200px]"
          />
          <ActiveBadge ativo={location.ativo} />
        </div>
        {editError && <p role="alert" className="text-xs text-red-600 font-semibold mb-3">{editError}</p>}
        {notice && <p role="status" className="text-xs text-emerald-700 font-semibold mb-3">{notice}</p>}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <input
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            onBlur={handleSave}
            placeholder="Endereço não informado"
            aria-label="Endereço"
            className="text-sm text-slate-500 border-b border-transparent focus:border-navy-700 outline-none w-full sm:flex-1 sm:min-w-[240px]"
          />
          <button
            onClick={handleToggleLocationActive}
            className={`text-sm font-semibold ${location.ativo ? 'text-slate-500' : 'text-emerald-600'}`}
          >
            {location.ativo ? 'Inativar local' : 'Ativar local'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-navy-900">Equipamentos</h2>
        <button onClick={() => setShowNewEquipment(true)} className="text-sm font-bold text-brandgreen-600">
          + Novo equipamento
        </button>
      </div>

      {equipmentList.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center text-sm text-slate-400">
          Nenhum equipamento cadastrado para este local ainda.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="hidden xl:table w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[20%]" />
              <col className="w-[22%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead>
              <tr className="text-left text-slate-500 text-xs uppercase border-b border-slate-100">
                <th className="px-5 py-3">Nome</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Código QR</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {equipmentList.map((eq) => (
                <EquipmentRow key={eq.id} eq={eq} onUpdate={updateEquipment} onToggle={(ativo) => setEquipmentActive(eq.id, ativo)} />
              ))}
            </tbody>
          </table>
          <div className="xl:hidden divide-y divide-slate-100">
            {equipmentList.map((eq) => (
              <div key={eq.id} className="p-4">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <span className="font-semibold text-navy-900 truncate min-w-0">{eq.nome}</span>
                  <ActiveBadge ativo={eq.ativo} />
                </div>
                <div className="text-xs text-slate-500 mb-1">{eq.tipo ?? '—'}</div>
                <div className="text-xs font-mono text-slate-400 mb-3">{eq.qrCode}</div>
                <button
                  onClick={() => setEquipmentActive(eq.id, !eq.ativo)}
                  className={`text-xs font-semibold ${eq.ativo ? 'text-slate-500' : 'text-emerald-600'}`}
                >
                  {eq.ativo ? 'Inativar' : 'Ativar'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showNewEquipment && (
        <NewEquipmentModal localId={location.id} onClose={() => setShowNewEquipment(false)} onCreate={createEquipment} />
      )}
    </div>
  );
}

function EquipmentRow({
  eq,
  onUpdate,
  onToggle,
}: {
  eq: { id: string; nome: string; tipo?: string; qrCode: string; ativo: boolean };
  onUpdate: (id: string, patch: { nome?: string; qrCode?: string; tipo?: string }) => { ok: true } | { ok: false; error: string };
  onToggle: (ativo: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  function handleQrBlur(e: React.FocusEvent<HTMLInputElement>) {
    const value = e.target.value;
    if (value === eq.qrCode) return;
    const result = onUpdate(eq.id, { qrCode: value });
    setError(result.ok ? null : result.error);
  }

  return (
    <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50 align-top">
      <td className="px-5 py-3 font-semibold text-navy-900 truncate">{eq.nome}</td>
      <td className="px-5 py-3 text-slate-600 truncate">{eq.tipo ?? '—'}</td>
      <td className="px-5 py-3">
        <input
          defaultValue={eq.qrCode}
          onBlur={handleQrBlur}
          className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono bg-slate-50"
        />
        {error && <p className="text-[11px] text-red-600 font-semibold mt-1">{error}</p>}
      </td>
      <td className="px-5 py-3"><ActiveBadge ativo={eq.ativo} /></td>
      <td className="px-5 py-3">
        <button onClick={() => onToggle(!eq.ativo)} className={`text-xs font-semibold ${eq.ativo ? 'text-slate-500' : 'text-emerald-600'}`}>
          {eq.ativo ? 'Inativar' : 'Ativar'}
        </button>
      </td>
    </tr>
  );
}

function NewEquipmentModal({
  localId,
  onClose,
  onCreate,
}: {
  localId: string;
  onClose: () => void;
  onCreate: (localId: string, nome: string, qrCode: string, tipo?: string) => { ok: true; id: string } | { ok: false; error: string };
}) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = onCreate(localId, nome, qrCode, tipo || undefined);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    <Modal title="Novo equipamento" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Nome" required>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required autoFocus />
        </Field>
        <Field label="Tipo (opcional)">
          <input value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Compressor, painel elétrico, veículo..." />
        </Field>
        <Field label="Código QR" required>
          <input value={qrCode} onChange={(e) => setQrCode(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono" placeholder="QR-XXXXX" required />
        </Field>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg px-3 py-2 mb-3">{error}</div>}
        <button type="submit" className="w-full bg-brandgreen-600 text-white rounded-xl py-2.5 font-bold mt-1">
          Criar equipamento
        </button>
      </form>
    </Modal>
  );
}
