'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/app-store';
import { ModelStatusBadge, StatCard } from '@/components/Badges';
import { EmptyState, InlineError } from '@/components/States';
import { Field, Modal } from '@/components/Modal';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import type { ModelStatus } from '@/types';
import type { NewModelInput } from '@/lib/models-api';

const STATUS_FILTERS: { key: 'TODOS' | ModelStatus; label: string }[] = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'PUBLICADO', label: 'Publicados' },
  { key: 'RASCUNHO', label: 'Rascunhos' },
  { key: 'ARQUIVADO', label: 'Arquivados' },
];

/**
 * UC-04 — Criar modelo de inspeção / UC-05 — Publicar versão do modelo.
 */
export default function ModelsPage() {
  const models = useAppStore((s) => s.models);
  const createDraftModel = useAppStore((s) => s.createDraftModel);
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);

  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]['key']>('TODOS');
  const [categoryFilter, setCategoryFilter] = useState('TODAS');
  const [search, setSearch] = useState('');

  const categories = useMemo(() => Array.from(new Set(models.map((m) => m.category))).sort(), [models]);
  const publishedCount = models.filter((m) => m.status === 'PUBLICADO').length;
  const draftCount = models.filter((m) => m.status === 'RASCUNHO').length;
  const totalItems = models.reduce((sum, m) => sum + m.sections.reduce((s2, sec) => s2 + sec.items.length, 0), 0);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...models]
      .filter((m) => statusFilter === 'TODOS' || m.status === statusFilter)
      .filter((m) => categoryFilter === 'TODAS' || m.category === categoryFilter)
      .filter((m) => !term || m.title.toLowerCase().includes(term))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [models, statusFilter, categoryFilter, search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">Modelos de inspeção</h1>
          <p className="text-sm text-slate-500">Crie, organize e publique versões de checklist (UC-04, UC-05)</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="bg-brandgreen-600 text-white font-bold text-sm rounded-xl px-4 py-2.5 whitespace-nowrap"
        >
          + Novo modelo
        </button>
      </div>

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
                  {m.status !== 'RASCUNHO' && <Tag>v{m.version}</Tag>}
                  {m.editingNewVersion && <Tag>Nova versão em edição</Tag>}
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

      {showNew && (
        <NewModelModal
          categories={categories}
          onClose={() => setShowNew(false)}
          onCreate={async (input) => {
            const result = await createDraftModel(input);
            if (result.ok) router.push(`/models/${result.id}`);
            return result;
          }}
        />
      )}
    </div>
  );
}

/**
 * RN-015: o modelo nasce em rascunho com título e categoria (descrição opcional).
 * O título é único — a API devolve 409 se já existir outro igual.
 */
function NewModelModal({
  categories,
  onClose,
  onCreate,
}: {
  categories: string[];
  onClose: () => void;
  onCreate: (input: NewModelInput) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const create = useAsyncAction();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await create.run(() => onCreate({ title, category, description }));
    // Em caso de sucesso a tela navega para o construtor; o modal só fecha se continuar montado.
    if (result.ok) onClose();
  }

  return (
    <Modal title="Novo modelo de inspeção" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Título" required>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            required
            autoFocus
          />
        </Field>
        <Field label="Categoria" required>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            list="model-categories"
            maxLength={100}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Ex.: Segurança, Manutenção"
            required
          />
          <datalist id="model-categories">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </Field>
        <Field label="Descrição (opcional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={3}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </Field>
        {create.error && <div className="mb-3"><InlineError message={create.error} /></div>}
        <button
          type="submit"
          disabled={create.pending}
          className="w-full bg-brandgreen-600 text-white rounded-xl py-2.5 font-bold mt-1 disabled:opacity-60"
        >
          {create.pending ? 'Criando...' : 'Criar rascunho'}
        </button>
      </form>
    </Modal>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{children}</span>;
}
