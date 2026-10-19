'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/app-store';
import { ModelStatusBadge, StatCard } from '@/components/Badges';
import { EmptyState, InlineError } from '@/components/States';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import type { ModelStatus } from '@/types';

const STATUS_FILTERS: { key: 'TODOS' | ModelStatus; label: string }[] = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'PUBLICADO', label: 'Publicados' },
  { key: 'RASCUNHO', label: 'Rascunhos' },
];

/**
 * UC-04 — Criar modelo de inspeção / UC-05 — Publicar versão do modelo.
 */
export default function ModelsPage() {
  const models = useAppStore((s) => s.models);
  const createDraftModel = useAppStore((s) => s.createDraftModel);
  const router = useRouter();
  const create = useAsyncAction();

  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]['key']>('TODOS');
  const [categoryFilter, setCategoryFilter] = useState('TODAS');
  const [search, setSearch] = useState('');

  const categories = useMemo(() => Array.from(new Set(models.map((m) => m.category))).sort(), [models]);
  const publishedCount = models.filter((m) => m.status === 'PUBLICADO').length;
  const draftCount = models.length - publishedCount;
  const totalItems = models.reduce((sum, m) => sum + m.sections.reduce((s2, sec) => s2 + sec.items.length, 0), 0);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...models]
      .filter((m) => statusFilter === 'TODOS' || m.status === statusFilter)
      .filter((m) => categoryFilter === 'TODAS' || m.category === categoryFilter)
      .filter((m) => !term || m.title.toLowerCase().includes(term))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [models, statusFilter, categoryFilter, search]);

  async function handleNew() {
    const result = await create.run(() => createDraftModel());
    if (result.ok) router.push(`/models/${result.id}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">Modelos de inspeção</h1>
          <p className="text-sm text-slate-500">Crie, organize e publique versões de checklist (UC-04, UC-05)</p>
        </div>
        <button
          onClick={handleNew}
          disabled={create.pending}
          className="bg-brandgreen-600 text-white font-bold text-sm rounded-xl px-4 py-2.5 whitespace-nowrap disabled:opacity-60"
        >
          {create.pending ? 'Criando...' : '+ Novo modelo'}
        </button>
      </div>

      {create.error && <div className="mb-4"><InlineError message={create.error} /></div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total de modelos" value={models.length} />
        <StatCard label="Publicados" value={publishedCount} tone="text-emerald-600" />
        <StatCard label="Em rascunho" value={draftCount} tone="text-slate-500" />
        <StatCard label="Itens de checklist" value={totalItems} tone="text-navy-700" />
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                statusFilter === f.key ? 'bg-navy-900 border-navy-900 text-white' : 'bg-white border-slate-300 text-slate-500'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-600"
        >
          <option value="TODAS">Todas as categorias</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título..."
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-600 placeholder:text-slate-400 ml-auto w-full sm:w-56"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl">
          <EmptyState title="Nenhum modelo encontrado" description="Ajuste os filtros ou a busca para ver outros resultados." />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((m) => {
            const itemCount = m.sections.reduce((sum, s) => sum + s.items.length, 0);
            return (
              <Link
                key={m.id}
                href={`/models/${m.id}`}
                className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-navy-700 hover:shadow-sm transition-all flex flex-col"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h2 className="font-bold text-navy-900 leading-snug">{m.title}</h2>
                  <ModelStatusBadge status={m.status} />
                </div>
                <p className="text-sm text-slate-500 mb-4 line-clamp-2">{m.description || 'Sem descrição.'}</p>
                <div className="mt-auto flex items-center gap-2 flex-wrap">
                  <Tag>{m.category}</Tag>
                  <Tag>v{m.version}</Tag>
                  <Tag>{m.sections.length} seç{m.sections.length === 1 ? 'ão' : 'ões'}</Tag>
                  <Tag>{itemCount} it{itemCount === 1 ? 'em' : 'ens'}</Tag>
                </div>
                <div className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-100">
                  Atualizado em {new Date(m.updatedAt).toLocaleDateString('pt-BR')}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{children}</span>;
}
