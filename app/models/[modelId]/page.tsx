'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/store/app-store';
import { ModelStatusBadge } from '@/components/Badges';
import { ErrorState, InlineError, LoadingState } from '@/components/States';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { normalizeSectionOrder, type MoveDirection } from '@/lib/section-order';
import { supportsFailureRules } from '@/lib/item-rules';
import type { ModelIssue } from '@/lib/model-validation';
import { publishState } from '@/lib/publish-state';
import { ModelPreview } from '@/components/checklist/ModelPreview';
import { PublishConfirmDialog, PublishPanel } from '@/components/checklist/PublishPanel';
import type { ItemType } from '@/types';

const ITEM_TYPES: { value: ItemType; label: string }[] = [
  { value: 'TEXT_SHORT', label: 'Texto curto' },
  { value: 'TEXT_LONG', label: 'Texto longo' },
  { value: 'NUMBER', label: 'Número' },
  { value: 'BOOLEAN', label: 'Verdadeiro/Falso' },
  { value: 'CONFORMITY', label: 'Conforme/Não conforme' },
  { value: 'SINGLE_CHOICE', label: 'Seleção única' },
  { value: 'DATE', label: 'Data' },
];

/**
 * UC-04 — Criar modelo de inspeção / UC-05 — Publicar versão do modelo.
 * RN-015: título, categoria e ao menos uma seção com item válido.
 * RN-016: todo item precisa de tipo de resposta.
 * RN-018: modelo em rascunho pode ser alterado livremente.
 * RN-019/020: versão publicada não é alterada destrutivamente — nova
 * publicação gera nova versão, preservando a anterior (histórico simplificado
 * aqui pelo campo `version`).
 */
export default function ModelBuilderPage() {
  const { modelId } = useParams<{ modelId: string }>();
  const router = useRouter();
  const model = useAppStore((s) => s.models.find((m) => m.id === modelId));
  const modelLoad = useAppStore((s) => s.modelLoad);
  const loadModel = useAppStore((s) => s.loadModel);
  const saveModelMeta = useAppStore((s) => s.saveModelMeta);
  const addSection = useAppStore((s) => s.addSection);
  const removeSection = useAppStore((s) => s.removeSection);
  const moveSection = useAppStore((s) => s.moveSection);
  const updateSectionTitle = useAppStore((s) => s.updateSectionTitle);
  const addItem = useAppStore((s) => s.addItem);
  const removeItem = useAppStore((s) => s.removeItem);
  const updateItem = useAppStore((s) => s.updateItem);
  const publishModel = useAppStore((s) => s.publishModel);
  const startNewModelVersion = useAppStore((s) => s.startNewModelVersion);
  const discardNewModelVersion = useAppStore((s) => s.discardNewModelVersion);
  const saveModel = useAppStore((s) => s.saveModel);

  const publish = useAsyncAction();
  const save = useAsyncAction();

  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [confirmingPublish, setConfirmingPublish] = useState(false);

  // Título, categoria e descrição ficam em campos locais e são salvos na API ao sair do campo.
  const [title, setTitle] = useState(model?.title ?? '');
  const [category, setCategory] = useState(model?.category ?? '');
  const [description, setDescription] = useState(model?.description ?? '');
  const [orderNotice, setOrderNotice] = useState<string | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaNotice, setMetaNotice] = useState<string | null>(null);

  // Carrega o modelo pela API (link direto/refresh). Modelos locais (dados de exemplo) não existem na API.
  useEffect(() => {
    const local = useAppStore.getState().models.find((m) => m.id === modelId);
    if (!local || local.lockVersion !== undefined) void loadModel(modelId);
  }, [modelId, loadModel]);

  // Sincroniza os campos quando o modelo chega (ou é recarregado) da API.
  useEffect(() => {
    setTitle(model?.title ?? '');
    setCategory(model?.category ?? '');
    setDescription(model?.description ?? '');
  }, [model?.title, model?.category, model?.description, model?.lockVersion]);

  useEffect(() => {
    if (!orderNotice) return;
    const timer = setTimeout(() => setOrderNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [orderNotice]);

  useEffect(() => {
    if (!metaNotice) return;
    const timer = setTimeout(() => setMetaNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [metaNotice]);

  if (!model) {
    const loadingThis = modelLoad.id !== modelId || modelLoad.status === 'idle' || modelLoad.status === 'loading';
    if (loadingThis) return <LoadingState label="Carregando modelo..." />;
    if (modelLoad.status === 'error') {
      return (
        <ErrorState
          title="Não foi possível carregar o modelo"
          message={modelLoad.error ?? 'Tente novamente.'}
          onRetry={() => void loadModel(modelId)}
        />
      );
    }
    return <ErrorState title="Modelo não encontrado" message="Ele pode ter sido removido ou o link está incorreto." />;
  }

  // RN-018/019: rascunho (ou nova versão em edição) pode ser alterado; versão publicada, não.
  const state = publishState(model);
  const locked = state.locked;

  // RN-017: as seções são exibidas na ordem explícita (displayOrder).
  const orderedSections = normalizeSectionOrder(model.sections);

  function handleMoveSection(sectionId: string, title: string, index: number, direction: MoveDirection) {
    moveSection(model!.id, sectionId, direction);
    const position = direction === 'up' ? index : index + 2;
    setOrderNotice(`Seção "${title}" movida para a posição ${position}.`);
  }

  async function handleSaveMeta() {
    const patch: { title?: string; category?: string; description?: string } = {};
    if (title.trim() !== model!.title) patch.title = title;
    if (category.trim() !== model!.category) patch.category = category;
    if (description.trim() !== model!.description) patch.description = description;
    if (Object.keys(patch).length === 0) return;
    const result = await saveModelMeta(model!.id, patch);
    if (!result.ok) {
      setMetaNotice(null);
      setMetaError(result.error);
      return;
    }
    setMetaError(null);
    setMetaNotice('Alterações salvas.');
  }

  const totalItems = model.sections.reduce((sum, s) => sum + s.items.length, 0);
  const requiredItems = model.sections.reduce((sum, s) => sum + s.items.filter((it) => it.required).length, 0);
  const criticalItems = model.sections.reduce((sum, s) => sum + s.items.filter((it) => it.evidenceRequiredOnFailure).length, 0);
  const observationItems = model.sections.reduce((sum, s) => sum + s.items.filter((it) => it.observationRequiredOnFailure).length, 0);

  function handleJump(issue: ModelIssue) {
    const id = issue.itemId
      ? `item-${issue.itemId}`
      : issue.sectionId
        ? `section-${issue.sectionId}`
        : issue.field === 'category'
          ? 'model-category'
          : issue.field === 'sections'
            ? 'add-section'
            : 'model-title';
    const element = document.getElementById(id);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.focus({ preventScroll: true });
  }

  async function handleConfirmPublish() {
    setPublishSuccess(null);
    const result = await publish.run(() => publishModel(model!.id));
    if (!result.ok) return; // o diálogo continua aberto mostrando o erro
    setConfirmingPublish(false);
    const published = useAppStore.getState().models.find((m) => m.id === model!.id);
    setPublishSuccess(published && published.version > 0 ? `Versão v${published.version} publicada.` : 'Modelo publicado com sucesso.');
  }

  function handleStartNewVersion() {
    setPublishSuccess(null);
    publish.setError(null);
    startNewModelVersion(model!.id);
  }

  function handleDiscard() {
    setPublishSuccess(null);
    publish.setError(null);
    discardNewModelVersion(model!.id);
  }

  async function handleSave() {
    setPublishSuccess(null);
    const result = await save.run(() => saveModel(model!.id));
    if (result.ok) setPublishSuccess('Rascunho salvo.');
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <button onClick={() => router.push('/models')} className="text-sm font-semibold text-slate-500 hover:text-navy-700">
          ← Voltar aos modelos
        </button>
        <ModelStatusBadge status={model.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="min-w-0">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-4">
            {locked && (
              <div className="bg-slate-50 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl px-4 py-3 mb-4">
                A versão publicada é imutável (RN-019). Crie uma nova versão para alterar o título, a categoria, a descrição ou o checklist.
              </div>
            )}
            <label className="text-xs font-bold text-navy-700 uppercase block mb-1" htmlFor="model-title">Título</label>
            <input
              id="model-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSaveMeta}
              maxLength={160}
              disabled={locked}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-lg font-bold text-navy-900 mb-4 disabled:bg-slate-50 disabled:text-slate-500"
            />
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-bold text-navy-700 uppercase block mb-1" htmlFor="model-category">Categoria</label>
                <input
                  id="model-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  onBlur={handleSaveMeta}
                  maxLength={100}
                  disabled={locked}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-navy-700 uppercase block mb-1">Versão atual</label>
                <div className="border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm font-mono text-slate-500">
                  {model.status === 'RASCUNHO' ? 'Rascunho' : `v${model.version}`}
                </div>
              </div>
            </div>
            <label className="text-xs font-bold text-navy-700 uppercase block mb-1" htmlFor="model-description">Descrição</label>
            <textarea
              id="model-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSaveMeta}
              maxLength={1000}
              rows={2}
              disabled={locked}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
            {metaError && <div className="mt-3"><InlineError message={metaError} /></div>}
            {metaNotice && (
              <p role="status" className="text-xs text-emerald-700 font-semibold mt-3">{metaNotice}</p>
            )}
          </div>

          {model.sections.length === 0 && (
            <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center mb-4">
              <p className="text-sm font-semibold text-slate-500 mb-1">Nenhuma seção ainda</p>
              <p className="text-xs text-slate-400">Adicione a primeira seção abaixo para começar a montar o checklist (RN-015).</p>
            </div>
          )}

          <fieldset disabled={locked} className="min-w-0 border-0 p-0 m-0">
            {orderedSections.length > 1 && (
              <p role="status" aria-live="polite" className="text-xs text-emerald-700 font-semibold mb-2 min-h-4">
                {orderNotice}
              </p>
            )}

            {orderedSections.map((section, sIdx) => (
              <div key={section.id} id={`section-${section.id}`} tabIndex={-1} className="bg-white border border-slate-200 rounded-2xl p-5 mb-4 outline-none focus-visible:ring-2 focus-visible:ring-navy-700">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-6 h-6 rounded-full bg-navy-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {sIdx + 1}
                  </span>
                  <input
                    value={section.title}
                    onChange={(e) => updateSectionTitle(model.id, section.id, e.target.value)}
                    className="flex-1 border-b border-slate-200 focus:border-navy-700 outline-none font-bold text-navy-900 py-1 min-w-0"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveSection(section.id, section.title, sIdx, 'up')}
                      disabled={sIdx === 0}
                      aria-label={`Mover a seção ${section.title} para cima`}
                      title="Mover para cima"
                      className="w-7 h-7 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveSection(section.id, section.title, sIdx, 'down')}
                      disabled={sIdx === orderedSections.length - 1}
                      aria-label={`Mover a seção ${section.title} para baixo`}
                      title="Mover para baixo"
                      className="w-7 h-7 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                  <span className="text-xs font-semibold text-slate-400 shrink-0 whitespace-nowrap">
                    {section.items.length} {section.items.length === 1 ? 'item' : 'itens'}
                  </span>
                  <button onClick={() => removeSection(model.id, section.id)} className="text-xs font-semibold text-red-600 shrink-0">
                    Remover seção
                  </button>
                </div>

                <div className="space-y-3">
                  {section.items.map((item) => (
                    <div key={item.id} id={`item-${item.id}`} tabIndex={-1} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 outline-none focus-visible:ring-2 focus-visible:ring-navy-700">
                      <div className="flex items-center gap-2 mb-2.5">
                        <input
                          value={item.title}
                          onChange={(e) => updateItem(model.id, section.id, item.id, { title: e.target.value })}
                          className="flex-1 border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm bg-white"
                        />
                        <button onClick={() => removeItem(model.id, section.id, item.id)} className="text-xs font-semibold text-red-600 px-2 shrink-0">
                          Remover
                        </button>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        <select
                          value={item.type}
                          onChange={(e) => updateItem(model.id, section.id, item.id, { type: e.target.value as ItemType })}
                          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                        >
                          {ITEM_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <input
                            type="checkbox"
                            checked={item.required}
                            onChange={(e) => updateItem(model.id, section.id, item.id, { required: e.target.checked })}
                          />
                          Obrigatório
                        </label>
                        {supportsFailureRules(item.type) && (
                          <>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                              <input
                                type="checkbox"
                                checked={item.observationRequiredOnFailure}
                                onChange={(e) => updateItem(model.id, section.id, item.id, { observationRequiredOnFailure: e.target.checked })}
                              />
                              Exige observação se não conforme
                            </label>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                              <input
                                type="checkbox"
                                checked={item.evidenceRequiredOnFailure}
                                onChange={(e) => updateItem(model.id, section.id, item.id, { evidenceRequiredOnFailure: e.target.checked })}
                              />
                              Exige evidência se não conforme (RN-039)
                            </label>
                          </>
                        )}
                      </div>
                      {!supportsFailureRules(item.type) && (
                        <p className="mt-2 text-[11px] text-slate-400">
                          Observação e evidência por falha só se aplicam a itens do tipo Conforme/Não conforme.
                        </p>
                      )}
                      {item.type === 'SINGLE_CHOICE' && (
                        <div className="mt-2.5">
                          <label className="text-xs font-semibold text-slate-600 block mb-1">Alternativas (separadas por vírgula)</label>
                          <input
                            value={(item.options ?? []).join(', ')}
                            onChange={(e) =>
                              updateItem(model.id, section.id, item.id, {
                                options: e.target.value
                                  .split(',')
                                  .map((o) => o.trim())
                                  .filter(Boolean),
                              })
                            }
                            placeholder="Ex.: Boa, Regular, Ruim"
                            className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  <button onClick={() => addItem(model.id, section.id)} className="text-sm font-semibold text-navy-700">
                    + Adicionar item
                  </button>
                </div>
              </div>
            ))}

            <button
              id="add-section"
              onClick={() => addSection(model.id)}
              className="w-full border-2 border-dashed border-slate-300 rounded-2xl py-4 text-sm font-bold text-slate-500 hover:border-navy-700 hover:text-navy-700 transition-colors"
            >
              + Adicionar seção
            </button>
          </fieldset>
        </div>

        <div className="lg:sticky lg:top-6 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-xs font-bold text-navy-700 uppercase mb-3">Resumo</h2>
            <dl className="space-y-2.5 text-sm">
              <SummaryRow label="Seções" value={model.sections.length} />
              <SummaryRow label="Itens" value={totalItems} />
              <SummaryRow label="Obrigatórios" value={requiredItems} />
              <SummaryRow label="Exigem observação" value={observationItems} />
              <SummaryRow label="Críticos (RN-039)" value={criticalItems} />
            </dl>
          </div>

          <PublishPanel
            model={model}
            state={state}
            publishing={publish.pending}
            busy={save.pending}
            onJump={handleJump}
            onPublish={() => {
              publish.setError(null);
              setConfirmingPublish(true);
            }}
            onStartNewVersion={handleStartNewVersion}
            onDiscard={handleDiscard}
          />

          <div className="bg-navy-900 text-white rounded-2xl p-5">
            <h2 className="text-xs font-bold text-brandgreen-500 uppercase mb-2">Regras de negócio</h2>
            <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
              <li><strong className="text-white">RN-015</strong> — Título, categoria e ao menos uma seção com item válido.</li>
              <li><strong className="text-white">RN-016</strong> — Todo item precisa de um tipo de resposta.</li>
              <li><strong className="text-white">RN-018</strong> — Modelo em rascunho pode ser alterado livremente.</li>
              <li><strong className="text-white">RN-019/020</strong> — Versão publicada é imutável; alterar gera nova versão.</li>
              <li><strong className="text-white">RN-039</strong> — Itens críticos exigem evidência quando não conformes.</li>
            </ul>
          </div>

          <InlineError message={confirmingPublish ? save.error : (publish.error ?? save.error)} />
          {publishSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold rounded-xl px-4 py-3">
              {publishSuccess}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button onClick={() => setShowPreview(true)} className="w-full bg-white border border-slate-300 rounded-xl py-3 font-bold text-navy-800">
              Ver prévia do checklist{state.errors.length + state.warnings.length > 0 ? ` (${state.errors.length + state.warnings.length})` : ''}
            </button>
            {!locked && (
              <button
                onClick={handleSave}
                disabled={save.pending || publish.pending}
                className="w-full bg-white border border-slate-300 rounded-xl py-3 font-bold text-navy-800 disabled:opacity-60"
              >
                {save.pending ? 'Salvando...' : 'Salvar rascunho'}
              </button>
            )}
          </div>
        </div>
      </div>

      {showPreview && <ModelPreview model={model} onClose={() => setShowPreview(false)} />}
      {confirmingPublish && (
        <PublishConfirmDialog
          model={model}
          state={state}
          publishing={publish.pending}
          error={publish.error}
          onConfirm={handleConfirmPublish}
          onCancel={() => {
            publish.setError(null);
            setConfirmingPublish(false);
          }}
        />
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500 font-semibold">{label}</dt>
      <dd className="text-navy-900 font-bold">{value}</dd>
    </div>
  );
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${ok ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
        {ok ? '✓' : '·'}
      </span>
      <span className={ok ? 'text-navy-900 font-semibold' : 'text-slate-400'}>{label}</span>
    </div>
  );
}
