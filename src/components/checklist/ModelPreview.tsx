'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChecklistItemField } from './ChecklistItemField';
import { EmptyState } from '@/components/States';
import { ModelStatusBadge } from '@/components/Badges';
import { normalizeSectionOrder } from '@/lib/section-order';
import { validateModel } from '@/lib/model-validation';
import type { PreviewAnswer } from '@/lib/item-field';
import type { InspectionModel } from '@/types';

/**
 * Prévia do checklist antes de publicar (PBI-0022): cada item usa o componente
 * real do seu tipo de resposta. O que se preenche aqui fica só na tela. Não
 * simula o aplicativo de campo (câmera, QR, geolocalização), e o aviso diz isso.
 */
export function ModelPreview({ model, onClose }: { model: InspectionModel; onClose: () => void }) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [answers, setAnswers] = useState<Record<string, PreviewAnswer>>({});

  const sections = normalizeSectionOrder(model.sections);
  const issues = validateModel(model);
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const change = (itemId: string, patch: PreviewAnswer) =>
    setAnswers((current) => ({ ...current, [itemId]: { ...current[itemId], ...patch } }));

  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto p-6"
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 id={titleId} className="font-extrabold text-navy-900">
            {model.title.trim() || 'Modelo sem título'}
          </h3>
          <ModelStatusBadge status={model.status} />
        </div>
        <p className="text-xs text-slate-500 mb-3">{model.category || 'Sem categoria'}</p>

        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-4">
          Prévia no painel web. O aplicativo de campo pode ter outra aparência. O que você preencher aqui não é salvo.
        </p>

        {errors.length > 0 && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2.5 mb-3">
            <p className="font-bold mb-1">
              {errors.length === 1 ? '1 problema impede a publicação' : `${errors.length} problemas impedem a publicação`}
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              {errors.map((issue, index) => (
                <li key={`${issue.message}-${index}`}>{issue.message}</li>
              ))}
            </ul>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2.5 mb-3">
            <p className="font-bold mb-1">Atenção</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {warnings.map((issue, index) => (
                <li key={`${issue.message}-${index}`}>{issue.message}</li>
              ))}
            </ul>
          </div>
        )}

        {model.description.trim() && <p className="text-sm text-slate-600 mb-4">{model.description}</p>}

        {sections.length === 0 ? (
          <div className="border-2 border-dashed border-slate-300 rounded-xl">
            <EmptyState
              title="Este modelo ainda não tem seções"
              description="Adicione seções e itens no construtor para ver a prévia do checklist."
            />
          </div>
        ) : (
          sections.map((section, index) => (
            <section key={section.id} aria-label={section.title.trim() || `Seção ${index + 1}`} className="mb-5">
              <h4 className="text-xs font-extrabold text-navy-700 uppercase mb-2">
                {index + 1}. {section.title.trim() || 'Seção sem título'}
              </h4>
              {section.items.length === 0 ? (
                <p className="text-xs text-slate-400 border border-dashed border-slate-300 rounded-lg px-3 py-3">
                  Nenhum item nesta seção.
                </p>
              ) : (
                <div className="space-y-2">
                  {section.items.map((item) => (
                    <ChecklistItemField key={item.id} item={item} answer={answers[item.id]} onChange={(patch) => change(item.id, patch)} />
                  ))}
                </div>
              )}
            </section>
          ))
        )}

        <div className="flex gap-2 mt-2">
          {Object.keys(answers).length > 0 && (
            <button
              type="button"
              onClick={() => setAnswers({})}
              className="px-4 bg-white border border-slate-300 text-slate-600 rounded-xl py-2.5 font-bold text-sm"
            >
              Limpar respostas
            </button>
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex-1 bg-navy-900 text-white rounded-xl py-2.5 font-bold"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
