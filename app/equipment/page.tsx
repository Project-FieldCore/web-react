'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/store/app-store';
import { EmptyState } from '@/components/States';
import { ActiveBadge, StatCard } from '@/components/Badges';

/**
 * Catálogo global de equipamentos. A criação acontece a partir do local
 * (RN-010: todo equipamento pertence a um local no MVP) — esta tela é o
 * ponto único de busca/consulta por nome, tipo ou código QR (RN-011).
 */
export default function EquipmentCatalogPage() {
  const equipment = useAppStore((s) => s.equipment);
  const locations = useAppStore((s) => s.locations);
  const clients = useAppStore((s) => s.clients);

  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('TODOS');

  const locationOf = (localId: string) => locations.find((l) => l.id === localId);
  const clientOf = (localId: string) => {
    const loc = locationOf(localId);
    return loc ? clients.find((c) => c.id === loc.clienteId) : undefined;
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return equipment
      .filter((e) => clientFilter === 'TODOS' || locationOf(e.localId)?.clienteId === clientFilter)
      .filter((e) => !term || e.nome.toLowerCase().includes(term) || e.qrCode.toLowerCase().includes(term));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipment, locations, search, clientFilter]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-navy-900">Equipamentos</h1>
        <p className="text-sm text-slate-500">Catálogo consolidado — para cadastrar um novo, acesse o local correspondente (RN-010).</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total de equipamentos" value={equipment.length} />
        <StatCard label="Ativos" value={equipment.filter((e) => e.ativo).length} tone="text-emerald-600" />
        <StatCard label="Locais com equipamento" value={new Set(equipment.map((e) => e.localId)).size} tone="text-navy-700" />
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-600"
        >
          <option value="TODOS">Todos os clientes</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou código QR..."
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-600 placeholder:text-slate-400 ml-auto w-full sm:w-64"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="hidden xl:table w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[16%]" />
            <col className="w-[18%]" />
            <col className="w-[22%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
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
            {filtered.map((eq) => {
              const loc = locationOf(eq.localId);
              const client = clientOf(eq.localId);
              return (
                <tr key={eq.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3 font-semibold text-navy-900 truncate">{eq.nome}</td>
                  <td className="px-5 py-3 text-slate-600 truncate">{eq.tipo ?? '—'}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500 truncate">{eq.qrCode}</td>
                  <td className="px-5 py-3 text-slate-600 truncate">{client?.nome ?? '—'} · {loc?.nome ?? '—'}</td>
                  <td className="px-5 py-3"><ActiveBadge ativo={eq.ativo} /></td>
                  <td className="px-5 py-3 text-right">
                    {client && loc && (
                      <Link href={`/clients/${client.id}/sites/${loc.id}`} className="text-xs font-bold text-navy-700 whitespace-nowrap">
                        Gerenciar →
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6}><EmptyState title="Nenhum equipamento encontrado" description="Ajuste os filtros ou a busca para ver outros resultados." /></td></tr>
            )}
          </tbody>
        </table>

        <div className="xl:hidden divide-y divide-slate-100">
          {filtered.map((eq) => {
            const loc = locationOf(eq.localId);
            const client = clientOf(eq.localId);
            return (
              <Link key={eq.id} href={client && loc ? `/clients/${client.id}/sites/${loc.id}` : '#'} className="block p-4 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <span className="font-semibold text-navy-900 truncate min-w-0">{eq.nome}</span>
                  <ActiveBadge ativo={eq.ativo} />
                </div>
                <div className="text-xs font-mono text-slate-500 mb-1">{eq.qrCode}</div>
                <div className="text-xs text-slate-500">{client?.nome ?? '—'} · {loc?.nome ?? '—'}</div>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <EmptyState title="Nenhum equipamento encontrado" description="Ajuste os filtros ou a busca para ver outros resultados." />
          )}
        </div>
      </div>
    </div>
  );
}
