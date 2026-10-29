'use client';

import { useEffect, useId, useRef } from 'react';
import type { ModelIssue } from '@/lib/model-validation';
import type { PublishState } from '@/lib/publish-state';
import type { InspectionModel } from '@/types';

/**
 * Painel "Antes de publicar": em que versão o modelo está (publicada e imutável,
 * nova versão em edição ou rascunho), as pendências reais — cada uma com "Ir
 * para" — e o botão de publicar, que diz por que está desabilitado.
 */
export function PublishPanel({
  model,
  state,
  publishing,
  busy,
  onJump,
  onPublish,
  onStartNewVersion,
  onDiscard,
}: {
  model: InspectionModel;
  state: PublishState;
  publishing: boolean;
  /** Outra ação em andamento (ex.: salvando) — desabilita publicar. */
  busy: boolean;
  onJump: (issue: ModelIssue) => void;
  onPublish: () => void;
  onStartNewVersion: () => void;
  onDiscard: () => void;
}) {
  const reasonId = useId();
  const { errors, warnings } = state;

  return (
    <section aria-label="Antes de publicar" className="bg-white border border-slate-200 rounded-2xl p-5">
      <h2 className="text-xs font-bold text-navy-700 uppercase mb-3">Antes de publicar</h2>

      {state.mode === 'published' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2.5 mb-3">
          <p className="font-bold">
            {model.status === 'ARQUIVADO' ? 'Modelo arquivado' : `Versão v${model.version} publicada e imutável (RN-019)`}
          </p>
          {model.status === 'PUBLICADO' && <p className="mt-0.5">Para alterar o checklist, crie uma nova versão (RN-020).</p>}
        </div>
      )}

      {state.mode === 'editing' && (
        <div className="bg-sky-50 border border-sky-200 text-sky-800 text-xs rounded-lg px-3 py-2.5 mb-3">
          <p className="font-bold">Editando a nova versão (a partir da v{model.version})</p>
          <p className="mt-0.5">
            {state.hasChanges
              ? 'Há alterações ainda não publicadas. A v' + model.version + ' continua valendo até você publicar.'
              : 'Nenhuma alteração ainda. A v' + model.version + ' continua valendo.'}
          </p>
        </div>
      )}

      {!state.locked && (
        <>
          {errors.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700 font-semibold mb-2">
              <span aria-hidden="true" className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center text-[10px]">✓</span>
              Nenhuma pendência
            </p>
          ) : (
            <div role="alert" className="mb-3">
              <p className="text-xs font-bold text-red-700 mb-1.5">
                {errors.length === 1 ? '1 pendência impede a publicação' : `${errors.length} pendências impedem a publicação`}
              </p>
              <ul className="space-y-1.5">
                {errors.map((issue, index) => (
                  <IssueRow key={`${issue.message}-${index}`} issue={issue} tone="error" onJump={onJump} />
                ))}
              </ul>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-bold text-amber-700 mb-1.5">Atenção</p>
              <ul className="space-y-1.5">
                {warnings.map((issue, index) => (
                  <IssueRow key={`${issue.message}-${index}`} issue={issue} tone="warning" onJump={onJump} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="flex flex-col gap-2 mt-3">
        {state.canStartNewVersion && (
          <button
            type="button"
            onClick={onStartNewVersion}
            className="w-full bg-navy-900 text-white rounded-xl py-3 font-bold"
          >
            Criar nova versão
          </button>
        )}

        {state.mode === 'editing' && (
          <button
            type="button"
            onClick={onDiscard}
            className="w-full bg-white border border-slate-300 rounded-xl py-3 font-bold text-slate-600"
          >
            Descartar alterações
          </button>
        )}

        {!state.locked && (
          <>
            <button
              type="button"
              onClick={onPublish}
              disabled={!state.canPublish || publishing || busy}
              aria-describedby={state.reason ? reasonId : undefined}
              className="w-full bg-brandgreen-600 text-white rounded-xl py-3 font-bold transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              {publishing ? 'Publicando...' : state.publishLabel}
            </button>
            {state.reason && (
              <p id={reasonId} className="text-xs text-slate-500">
                {state.reason}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function IssueRow({
  issue,
  tone,
  onJump,
}: {
  issue: ModelIssue;
  tone: 'error' | 'warning';
  onJump: (issue: ModelIssue) => void;
}) {
  const canJump = Boolean(issue.itemId || issue.sectionId || issue.field);
  return (
    <li className={`text-xs rounded-lg px-2.5 py-2 ${tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
      <span>{issue.message}</span>
      {canJump && (
        <button type="button" onClick={() => onJump(issue)} className="ml-2 font-bold underline whitespace-nowrap">
          Ir para
        </button>
      )}
    </li>
  );
}

/** Confirmação antes de publicar: a versão publicada não poderá mais ser alterada (RN-019). */
export function PublishConfirmDialog({
  model,
  state,
  publishing,
  error,
  onConfirm,
  onCancel,
}: {
  model: InspectionModel;
  state: PublishState;
  publishing: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const sections = model.sections.length;
  const items = model.sections.reduce((sum, s) => sum + s.items.length, 0);
  const required = model.sections.reduce((sum, s) => sum + s.items.filter((it) => it.required).length, 0);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !publishing) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel, publishing]);

  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4 sm:p-6">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="bg-white rounded-2xl max-w-md w-full p-6">
        <h3 id={titleId} className="font-extrabold text-navy-900 mb-1">
          {state.publishLabel}
        </h3>
        <p className="text-sm text-slate-600 mb-4">{model.title.trim()}</p>

        <dl className="grid grid-cols-3 gap-3 text-center mb-4">
          {[
            ['Seções', sections],
            ['Itens', items],
            ['Obrigatórios', required],
          ].map(([label, value]) => (
            <div key={label} className="bg-slate-50 border border-slate-200 rounded-lg py-2">
              <dd className="text-lg font-extrabold text-navy-900">{value}</dd>
              <dt className="text-[11px] font-semibold text-slate-500">{label}</dt>
            </div>
          ))}
        </dl>

        <p className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-4">
          Depois de publicada, esta versão <strong>não poderá ser alterada</strong> (RN-019). Para mudar o checklist, você
          criará uma nova versão (RN-020).
        </p>

        {error && (
          <p role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-lg px-3 py-2.5 mb-4">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={publishing}
            className="flex-1 bg-white border border-slate-300 text-slate-600 rounded-xl py-2.5 font-bold disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={publishing}
            className="flex-1 bg-brandgreen-600 text-white rounded-xl py-2.5 font-bold disabled:opacity-60"
          >
            {publishing ? 'Publicando...' : 'Confirmar publicação'}
          </button>
        </div>
      </div>
    </div>
  );
}
