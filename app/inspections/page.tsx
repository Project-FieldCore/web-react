'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/store/app-store';
import { EmptyState } from '@/components/States';
import { InspectionStatusBadge, PriorityTag } from '@/components/Badges';
import { formatDateTime } from '@/lib/inspection-display';
import type { InspectionStatus } from '@/types';

const FILTERS: { key: 'TODAS' | InspectionStatus; label: string }[] = [
  { key: 'TODAS', label: 'Todas' },
  { key: 'ATRIBUIDA', label: 'Atribuídas' },
  { key: 'EM_ANDAMENTO', label: 'Em andamento' },
  { key: 'ENVIADA', label: 'Aguardando revisão' },
  { key: 'DEVOLVIDA', label: 'Devolvidas' },
  { key: 'APROVADA', label: 'Aprovadas' },
  { key: 'REPROVADA', label: 'Reprovadas' },
  { key: 'CANCELADA', label: 'Canceladas' },
];

/**
 * UC-15 — Acompanhar inspeções.
 * Filtros por técnico, cliente, estado e período (doc 08.2 / UC-18/19 parcial).
 */
export default function InspectionsListPage() {
  const inspections = useAppStore((s) => s.inspections);
  const clients = useAppStore((s) => s.clients);
  const users = useAppStore((s) => s.users);
  const technicians = users.filter((u) => u.role === 'TECHNICIAN');

  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('TODAS');
  const [techFilter, setTechFilter] = useState('TODOS');

  const clientName = (id: string) => clients.find((c) => c.id === id)?.nome ?? '—';
  const techName = (id: string) => users.find((u) => u.id === id)?.nome ?? '—';
  const detailHref = (i: (typeof inspections)[number]) => `/inspections/${i.id}`;

  const filtered = useMemo(() => {
    return inspections.filter((i) => {
      if (filter !== 'TODAS' && i.status !== filter) return false;
      if (techFilter !== 'TODOS' && i.tecnicoId !== techFilter) return false;
      return true;
    });
  }, [inspections, filter, techFilter]);

  return (
    <div className="w-full min-w-0">
      <h1 className="text-2xl font-extrabold text-navy-900 mb-1">Inspeções</h1>
      <p className="text-sm text-slate-500 mb-6">Acompanhe o andamento e abra a revisão das inspeções enviadas (UC-15, UC-16)</p>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap ${
                filter === f.key ? 'bg-navy-900 border-navy-900 text-white' : 'bg-white border-slate-300 text-slate-500'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={techFilter}
          onChange={(e) => setTechFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs w-full sm:w-auto sm:ml-auto"
        >
          <option value="TODOS">Todos os técnicos</option>
          {technicians.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {/* Tablet/desktop: tabela ocupa 100% do card, sem largura mínima — nunca gera rolagem lateral */}
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
            {filtered.map((i) => (
              <tr key={i.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3 font-mono text-xs text-slate-400 truncate">{i.id}</td>
                <td className="px-5 py-3 font-semibold text-navy-900 truncate">
                  <Link href={detailHref(i)}>{clientName(i.clienteId)}</Link>
                </td>
                <td className="px-5 py-3 text-slate-600 truncate">{techName(i.tecnicoId)}</td>
                <td className="px-5 py-3"><PriorityTag priority={i.prioridade} /></td>
                <td className="px-5 py-3"><InspectionStatusBadge status={i.status} /></td>
                <td className="px-5 py-3 text-slate-500 font-mono text-xs">{formatDateTime(i.dataPrevista)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6}><EmptyState title="Nenhuma inspeção encontrada" description="Ajuste os filtros ou a busca para ver outros resultados." /></td></tr>
            )}
          </tbody>
        </table>

        {/* Mobile: lista de cards com as mesmas informações, empilhadas e sem cortar conteúdo */}
        <div className="xl:hidden divide-y divide-slate-100">
          {filtered.map((i) => (
            <Link key={i.id} href={detailHref(i)} className="block p-4 hover:bg-slate-50">
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
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-mono text-slate-500">{formatDateTime(i.dataPrevista)}</span>
                <span className="text-xs font-bold text-navy-700 whitespace-nowrap">
                  {i.status === 'ENVIADA' || i.status === 'EM_REVISAO' ? 'Revisar →' : 'Ver →'}
                </span>
              </div>
            </Link>
          ))}
          {filtered.length === 0 && (
            <EmptyState title="Nenhuma inspeção encontrada" description="Ajuste os filtros ou a busca para ver outros resultados." />
          )}
        </div>
      </div>
    </div>
  );
}
