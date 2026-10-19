'use client';

import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { EmptyState } from '@/components/States';
import { StatCard } from '@/components/Badges';

/**
 * Trilha de auditoria (RN-086: alterações críticas registram usuário, data,
 * ação e entidade; RN-088: nenhuma entidade histórica é excluída fisicamente
 * — inativação e versionamento substituem a exclusão em todo o sistema).
 */
export default function AuditPage() {
  const auditEvents = useAppStore((s) => s.auditEvents);

  const [entityFilter, setEntityFilter] = useState('TODAS');
  const [search, setSearch] = useState('');

  const entities = useMemo(() => Array.from(new Set(auditEvents.map((e) => e.entity))).sort(), [auditEvents]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...auditEvents]
      .filter((e) => entityFilter === 'TODAS' || e.entity === entityFilter)
      .filter((e) => !term || e.userNome.toLowerCase().includes(term) || (e.details ?? '').toLowerCase().includes(term))
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  }, [auditEvents, entityFilter, search]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-navy-900">Auditoria</h1>
        <p className="text-sm text-slate-500">Histórico de ações críticas do painel (RN-086) — nada aqui é apagado (RN-088).</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Eventos registrados" value={auditEvents.length} />
        <StatCard label="Nas últimas 24h" value={auditEvents.filter((e) => Date.now() - new Date(e.timestamp).getTime() < 86_400_000).length} tone="text-navy-700" />
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-600"
        >
          <option value="TODAS">Todas as entidades</option>
          {entities.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por usuário ou detalhe..."
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-600 placeholder:text-slate-400 ml-auto w-full sm:w-64"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="hidden xl:table w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[18%]" />
            <col className="w-[16%]" />
            <col className="w-[16%]" />
            <col className="w-[34%]" />
          </colgroup>
          <thead>
            <tr className="text-left text-slate-500 text-xs uppercase border-b border-slate-100">
              <th className="px-5 py-3">Data/hora</th>
              <th className="px-5 py-3">Usuário</th>
              <th className="px-5 py-3">Ação</th>
              <th className="px-5 py-3">Entidade</th>
              <th className="px-5 py-3">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3 text-slate-500 font-mono text-xs">{new Date(e.timestamp).toLocaleString('pt-BR')}</td>
                <td className="px-5 py-3 font-semibold text-navy-900 truncate">{e.userNome}</td>
                <td className="px-5 py-3">
                  <span className="text-[11px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{e.action}</span>
                </td>
                <td className="px-5 py-3 text-slate-600 truncate">{e.entity}{e.entityId ? ` · ${e.entityId}` : ''}</td>
                <td className="px-5 py-3 text-slate-500 truncate">{e.details ?? '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5}><EmptyState title="Nenhum evento encontrado" description="Ajuste os filtros ou a busca para ver outros resultados." /></td></tr>
            )}
          </tbody>
        </table>

        <div className="xl:hidden divide-y divide-slate-100">
          {filtered.map((e) => (
            <div key={e.id} className="p-4">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <span className="font-semibold text-navy-900 truncate min-w-0">{e.userNome}</span>
                <span className="text-[11px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full whitespace-nowrap">{e.action}</span>
              </div>
              <div className="text-xs text-slate-500 mb-1">{e.entity}{e.entityId ? ` · ${e.entityId}` : ''}</div>
              {e.details && <div className="text-xs text-slate-400 mb-1">{e.details}</div>}
              <div className="text-[11px] font-mono text-slate-400">{new Date(e.timestamp).toLocaleString('pt-BR')}</div>
            </div>
          ))}
          {filtered.length === 0 && (
            <EmptyState title="Nenhum evento encontrado" description="Ajuste os filtros ou a busca para ver outros resultados." />
          )}
        </div>
      </div>
    </div>
  );
}
