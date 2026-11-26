'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Pagination } from '@/components/ListControls';
import { listNonConformities, type ServerNonConformity } from '@/lib/non-conformities-api';
import type { PageMeta } from '@/lib/paged-list';

const severityLabel: Record<string, string> = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', CRITICAL: 'Crítica' };
const statusLabel: Record<string, string> = { OPEN: 'Aberta', RESOLVED: 'Resolvida', WAIVED: 'Dispensada' };

export default function NonConformitiesPage() {
  const [severity, setSeverity] = useState(''); const [status, setStatus] = useState(''); const [page, setPage] = useState(0); const [size, setSize] = useState(20);
  const [items, setItems] = useState<ServerNonConformity[]>([]); const [meta, setMeta] = useState<PageMeta | null>(null); const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const load = () => { setState('loading'); void listNonConformities(page, size, severity, status).then((data) => { setItems(data.items); setMeta(data.page); setState('ready'); }).catch(() => setState('error')); };
  useEffect(load, [page, size, severity, status]);
  const filter = (setter: (value: string) => void, value: string) => { setter(value); setPage(0); };
  return <div><div className="mb-6"><h1 className="text-2xl font-extrabold text-navy-900">Não conformidades</h1><p className="text-sm text-slate-500">Registros recebidos e mantidos no servidor a partir das inspeções executadas.</p></div>
    <div className="flex gap-3 flex-wrap mb-4"><select value={severity} onChange={(e) => filter(setSeverity, e.target.value)} className="ui-select text-sm"><option value="">Todas as criticidades</option>{Object.entries(severityLabel).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select><select value={status} onChange={(e) => filter(setStatus, e.target.value)} className="ui-select text-sm"><option value="">Todos os status</option>{Object.entries(statusLabel).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></div>
    {state === 'loading' ? <LoadingState label="Carregando não conformidades..." /> : state === 'error' ? <ErrorState title="Não foi possível carregar as não conformidades" message="Tente novamente." onRetry={load} /> : <div className="space-y-3">{items.length === 0 ? <div className="bg-white border border-slate-200 rounded-2xl"><EmptyState title="Nenhuma não conformidade encontrada" description="Não há registros para os filtros selecionados." /></div> : items.map((item) => <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-5"><div className="flex justify-between gap-3 flex-wrap"><h2 className="font-bold text-navy-900">{item.itemTitle}</h2><span className="text-xs font-bold text-slate-600 bg-slate-100 rounded-full px-2.5 py-1">{severityLabel[item.severity]} · {statusLabel[item.status]}</span></div><p className="text-sm text-slate-600 mt-2">{item.description}</p><div className="flex justify-between gap-3 flex-wrap mt-3 text-xs text-slate-400"><span>{item.clientName} · {item.siteName} · {new Date(item.createdAt).toLocaleString('pt-BR')}</span><Link className="font-semibold text-navy-700" href={`/inspections/${item.inspectionId}`}>Ver inspeção →</Link></div></div>)}<Pagination meta={meta} onPage={setPage} onSize={setSize} /></div>}</div>;
}
