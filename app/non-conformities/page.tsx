'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/store/app-store';
import { EmptyState, InlineError } from '@/components/States';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { CriticidadeTag, NonConformityStatusBadge, StatCard } from '@/components/Badges';
import type { Criticidade, NonConformity, NonConformityStatus } from '@/types';

interface FlatNC extends NonConformity {
  inspectionId: string;
  clienteNome: string;
  localNome: string;
}

const CRITICIDADE_FILTERS: { key: 'TODAS' | Criticidade; label: string }[] = [
  { key: 'TODAS', label: 'Todas' },
  { key: 'CRITICA', label: 'Crítica' },
  { key: 'ALTA', label: 'Alta' },
  { key: 'MEDIA', label: 'Média' },
  { key: 'BAIXA', label: 'Baixa' },
];

/**
 * Painel de não conformidades encontradas em campo (necessidade central da
 * Marina — 04 - Personas). RN-054: criticidade válida. RN-055: crítica
 * exige descrição e evidência (garantido na origem, no app do técnico).
 */
export default function NonConformitiesPage() {
  const inspections = useAppStore((s) => s.inspections);
  const clients = useAppStore((s) => s.clients);
  const locations = useAppStore((s) => s.locations);
  const resolveNonConformity = useAppStore((s) => s.resolveNonConformity);

  const action = useAsyncAction();
  const [criticidadeFilter, setCriticidadeFilter] = useState<(typeof CRITICIDADE_FILTERS)[number]['key']>('TODAS');
  const [statusFilter, setStatusFilter] = useState<'TODAS' | NonConformityStatus>('TODAS');

  const flatList: FlatNC[] = useMemo(() => {
    return inspections.flatMap((i) =>
      Object.values(i.nonConformities).map((nc) => ({
        ...nc,
        inspectionId: i.id,
        clienteNome: clients.find((c) => c.id === i.clienteId)?.nome ?? '—',
        localNome: locations.find((l) => l.id === i.localId)?.nome ?? '—',
      }))
    );
  }, [inspections, clients, locations]);

  const filtered = flatList
    .filter((nc) => criticidadeFilter === 'TODAS' || nc.criticidade === criticidadeFilter)
    .filter((nc) => statusFilter === 'TODAS' || nc.status === statusFilter)
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'ABERTA' ? -1 : 1));

  const abertas = flatList.filter((nc) => nc.status === 'ABERTA').length;
  const criticas = flatList.filter((nc) => nc.criticidade === 'CRITICA' && nc.status === 'ABERTA').length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-navy-900">Não conformidades</h1>
        <p className="text-sm text-slate-500">Itens marcados como não conformes durante a execução das inspeções.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total registradas" value={flatList.length} />
        <StatCard label="Abertas" value={abertas} tone="text-red-600" />
        <StatCard label="Críticas em aberto" value={criticas} tone="text-red-700" />
        <StatCard label="Resolvidas" value={flatList.length - abertas} tone="text-emerald-600" />
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {CRITICIDADE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setCriticidadeFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                criticidadeFilter === f.key ? 'bg-navy-900 border-navy-900 text-white' : 'bg-white border-slate-300 text-slate-500'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 ml-auto"
        >
          <option value="TODAS">Todos os status</option>
          <option value="ABERTA">Abertas</option>
          <option value="RESOLVIDA">Resolvidas</option>
        </select>
      </div>

      {action.error && <div className="mb-4"><InlineError message={action.error} /></div>}

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl">
          <EmptyState title="Nenhuma não conformidade encontrada" description="Ajuste os filtros ou a busca para ver outros resultados." />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((nc) => (
            <div key={`${nc.inspectionId}-${nc.itemId}`} className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                <h2 className="font-bold text-navy-900">{nc.titulo}</h2>
                <div className="flex items-center gap-2">
                  <CriticidadeTag criticidade={nc.criticidade} />
                  <NonConformityStatusBadge status={nc.status} />
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-3">{nc.descricao}</p>
              <div className="flex items-center justify-between flex-wrap gap-3 text-xs text-slate-400">
                <span>
                  {nc.clienteNome} · {nc.localNome} · {nc.evidenceCount} evidência{nc.evidenceCount === 1 ? '' : 's'}
                </span>
                <div className="flex items-center gap-4">
                  <Link href={`/inspections/${nc.inspectionId}`} className="font-semibold text-navy-700">
                    Ver inspeção {nc.inspectionId} →
                  </Link>
                  <button
                    onClick={() => action.run(() => resolveNonConformity(nc.inspectionId, nc.itemId!, nc.status === 'ABERTA' ? 'RESOLVIDA' : 'ABERTA'))}
                    disabled={action.pending}
                    className={`font-semibold disabled:opacity-50 ${nc.status === 'ABERTA' ? 'text-emerald-600' : 'text-slate-500'}`}
                  >
                    {nc.status === 'ABERTA' ? 'Marcar como resolvida' : 'Reabrir'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
