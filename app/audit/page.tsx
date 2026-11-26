'use client';

import { ErrorState, EmptyState, LoadingState } from '@/components/States';
import { Pagination, SearchBox, SortableTh } from '@/components/ListControls';
import { usePagedList } from '@/hooks/usePagedList';
import { listAuditLogs, type AuditLog } from '@/lib/audit-api';

const ACTIONS = ['', 'SCHEDULED', 'ASSIGNED', 'STARTED', 'SUBMITTED', 'CANCELED', 'REVIEW_STARTED', 'REVIEW_APPROVED', 'REVIEW_REJECTED', 'ITEM_REVIEW_COMMENTED'];
const label = (value: string) => value.replaceAll('_', ' ').toLocaleLowerCase('pt-BR').replace(/^./, (letter) => letter.toUpperCase());

function payloadText(payload: string | null) {
  if (!payload) return '—';
  try {
    const parsed: unknown = JSON.parse(payload);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return payload;
    return Object.entries(parsed as Record<string, unknown>).map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`).join(' · ');
  } catch { return payload; }
}

export default function AuditPage() {
  const list = usePagedList(listAuditLogs, { sort: { field: 'createdAt', dir: 'desc' }, filters: { entityType: '', action: '', from: '', to: '' } });
  return <div>
    <div className="mb-6 flex items-start justify-between gap-4 flex-wrap"><div><h1 className="text-2xl font-extrabold text-navy-900">Auditoria</h1><p className="text-sm text-slate-500">Eventos registrados pelo servidor, com origem, entidade e data preservadas.</p></div>{list.meta && <span className="text-sm font-semibold text-slate-500">{list.meta.totalElements} evento{list.meta.totalElements === 1 ? '' : 's'}</span>}</div>
    <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4"><div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
      <SearchBox value={list.input} onChange={list.setInput} placeholder="Buscar ator, ação ou detalhe..." />
      <select value={list.filters.entityType} onChange={(e) => list.setFilter('entityType', e.target.value)} aria-label="Entidade" className="ui-select text-sm"><option value="">Todas as entidades</option><option value="INSPECTION">Inspeção</option></select>
      <select value={list.filters.action} onChange={(e) => list.setFilter('action', e.target.value)} aria-label="Ação" className="ui-select text-sm"><option value="">Todas as ações</option>{ACTIONS.slice(1).map((action) => <option key={action} value={action}>{label(action)}</option>)}</select>
      <input type="datetime-local" value={list.filters.from} onChange={(e) => list.setFilter('from', e.target.value)} aria-label="A partir de" title="A partir de" className="text-sm" />
      <input type="datetime-local" value={list.filters.to} onChange={(e) => list.setFilter('to', e.target.value)} aria-label="Até" title="Até" className="text-sm" />
    </div>{list.hasActiveFilters && <button type="button" onClick={list.clear} className="mt-3 text-xs font-bold text-navy-700 hover:underline">Limpar filtros</button>}</div>
    {list.status === 'loading' ? <LoadingState label="Carregando eventos de auditoria..." /> : list.status === 'error' ? <ErrorState title={list.errorCopy?.title ?? 'Não foi possível carregar a auditoria'} message={list.error ?? ''} onRetry={list.reload} /> : <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <table className="hidden xl:table w-full text-sm table-fixed"><colgroup><col className="w-[17%]" /><col className="w-[17%]" /><col className="w-[17%]" /><col className="w-[20%]" /><col className="w-[29%]" /></colgroup><thead><tr className="text-left text-slate-500 text-xs uppercase border-b border-slate-100"><SortableTh label="Data/hora" field="createdAt" sort={list.sort} onSort={list.sortBy} /><th className="px-5 py-3">Ator</th><SortableTh label="Ação" field="action" sort={list.sort} onSort={list.sortBy} /><th className="px-5 py-3">Entidade</th><th className="px-5 py-3">Dados auditáveis</th></tr></thead><tbody>{list.items.map((event) => <AuditRow key={event.id} event={event} />)}{list.items.length === 0 && <tr><td colSpan={5}><EmptyState title="Nenhum evento encontrado" description="Não há registros para os filtros selecionados." /></td></tr>}</tbody></table>
      <div className="xl:hidden divide-y divide-slate-100">{list.items.map((event) => <AuditCard key={event.id} event={event} />)}{list.items.length === 0 && <EmptyState title="Nenhum evento encontrado" description="Não há registros para os filtros selecionados." />}</div><Pagination meta={list.meta} onPage={list.setPage} onSize={list.setSize} />
    </div>}
  </div>;
}

function AuditRow({ event }: { event: AuditLog }) { return <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50"><td className="px-5 py-3 text-slate-500 font-mono text-xs">{new Date(event.createdAt).toLocaleString('pt-BR')}</td><td className="px-5 py-3 font-semibold text-navy-900 truncate">{event.actorName ?? 'Sistema'}</td><td className="px-5 py-3"><ActionTag action={event.action} /></td><td className="px-5 py-3 text-slate-600 truncate">{label(event.entityType)} · <span className="font-mono text-xs">{event.entityId}</span></td><td className="px-5 py-3 text-slate-500 truncate" title={payloadText(event.payload)}>{payloadText(event.payload)}</td></tr>; }
function AuditCard({ event }: { event: AuditLog }) { return <div className="p-4"><div className="flex items-start justify-between gap-3 mb-2"><span className="font-semibold text-navy-900 truncate">{event.actorName ?? 'Sistema'}</span><ActionTag action={event.action} /></div><p className="text-xs text-slate-500">{label(event.entityType)} · <span className="font-mono">{event.entityId}</span></p><p className="text-xs text-slate-500 mt-1 break-words">{payloadText(event.payload)}</p><p className="text-[11px] font-mono text-slate-400 mt-2">{new Date(event.createdAt).toLocaleString('pt-BR')}</p></div>; }
function ActionTag({ action }: { action: string }) { return <span className="text-[11px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full whitespace-nowrap">{label(action)}</span>; }
