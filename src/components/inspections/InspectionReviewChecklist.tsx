'use client';

import { useCallback, useEffect, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { ApiError } from '@/lib/http';
import {
  fetchInspectionChecklist,
  type InspectionChecklistItem,
  type InspectionChecklistSection,
} from '@/lib/inspections-api';
import { formatChecklistAnswer } from '@/lib/inspection-checklist-display';

type ChecklistStatus = 'loading' | 'ready' | 'error';

function checklistErrorCopy(error: unknown): { title: string; message: string; retry: boolean } {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return {
        title: 'Acesso não autorizado',
        message: 'Seu perfil não pode consultar o checklist desta inspeção.',
        retry: false,
      };
    }
    if (error.status === 404) {
      return {
        title: 'Inspeção não encontrada',
        message: 'Ela pode ter sido removida ou o link está incorreto.',
        retry: false,
      };
    }
    if (error.status === 401) {
      return {
        title: 'Não foi possível carregar as respostas',
        message: 'Sessão expirada. Entre novamente.',
        retry: false,
      };
    }
    return {
      title: 'Não foi possível carregar as respostas',
      message: error.message,
      retry: true,
    };
  }
  return {
    title: 'Não foi possível carregar as respostas',
    message: error instanceof Error ? error.message : 'Não foi possível carregar as respostas.',
    retry: true,
  };
}

function ChecklistItemCard({ item }: { item: InspectionChecklistItem }) {
  const answer = formatChecklistAnswer(item);
  const observation = item.observation?.trim() ? item.observation.trim() : null;

  return (
    <div className="border border-slate-100 rounded-xl p-3.5 mb-2">
      <div className="text-sm font-semibold text-navy-900">
        {item.title}
        {item.required ? <span className="text-red-600"> *</span> : null}
      </div>
      {item.description ? <div className="text-xs text-slate-500 mt-0.5">{item.description}</div> : null}

      {answer.kind === 'unanswered' && (
        <>
          <div className="mt-1.5 text-sm font-semibold text-slate-400">Sem resposta</div>
          {item.required ? <div className="text-xs text-amber-700 mt-1">Obrigatório sem resposta</div> : null}
        </>
      )}

      {answer.kind === 'conformity' && (
        <div className={`flex items-center gap-1.5 mt-1.5 text-sm font-semibold ${answer.chrome.text}`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${answer.chrome.dot}`} aria-hidden="true" />
          {answer.chrome.label}
        </div>
      )}

      {answer.kind === 'value' && (
        <div className="mt-1.5 text-sm font-semibold text-navy-900" title={answer.title}>
          {answer.label}
        </div>
      )}

      {observation ? (
        <div className="text-xs text-slate-500 mt-1.5">
          <span className="font-semibold text-slate-600">Observação</span>
          <div className="mt-0.5">{observation}</div>
        </div>
      ) : null}

      {process.env.NODE_ENV === 'development' && (item.rulesJson || item.optionsJson) ? (
        <div className="mt-2 text-[10px] font-mono text-slate-400 break-all">
          {item.rulesJson ? `rulesJson: ${item.rulesJson}` : null}
          {item.optionsJson ? ` optionsJson: ${item.optionsJson}` : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Bloco “Respostas do checklist” — GET /inspections/{id}/checklist (somente leitura, RN-084).
 * Falhas aqui não bloqueiam aprovar/reprovar na página.
 */
export function InspectionReviewChecklist({ inspectionId }: { inspectionId: string }) {
  const [sections, setSections] = useState<InspectionChecklistSection[]>([]);
  const [status, setStatus] = useState<ChecklistStatus>('loading');
  const [errorTitle, setErrorTitle] = useState('Não foi possível carregar as respostas');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setErrorMessage(null);
    void fetchInspectionChecklist(inspectionId)
      .then((next) => {
        if (!active) return;
        setSections(next);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (!active) return;
        const copy = checklistErrorCopy(error);
        setErrorTitle(copy.title);
        setErrorMessage(copy.message);
        setCanRetry(copy.retry);
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [inspectionId, reloadToken]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-5" aria-busy={status === 'loading'}>
      <h2 className="font-bold text-navy-900 mb-1">Respostas do checklist</h2>
      <p className="text-xs text-slate-500 mb-4">Somente leitura — respostas do técnico.</p>

      {status === 'loading' && <LoadingState label="Carregando respostas do checklist..." />}

      {status === 'error' && errorMessage && (
        <ErrorState title={errorTitle} message={errorMessage} onRetry={canRetry ? reload : undefined} />
      )}

      {status === 'ready' && sections.length === 0 && (
        <EmptyState
          title="Checklist indisponível"
          description="Não há seções ou itens para esta inspeção."
        />
      )}

      {status === 'ready' &&
        sections.map((section) => (
          <div key={`${section.order}-${section.title}`} className="mb-5">
            <h3 className="text-xs font-extrabold text-navy-700 uppercase mb-2">{section.title}</h3>
            {section.items.length === 0 ? (
              <p className="text-sm text-slate-400 mb-2">Nenhum item nesta seção.</p>
            ) : (
              section.items.map((item) => <ChecklistItemCard key={item.id} item={item} />)
            )}
          </div>
        ))}
    </div>
  );
}
