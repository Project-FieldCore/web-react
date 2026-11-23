'use client';

import { useCallback, useEffect, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { ApiError } from '@/lib/http';
import {
  fetchInspectionChecklist,
  type InspectionChecklistItem,
  type InspectionChecklistSection,
  type MonitoringEvidence,
} from '@/lib/inspections-api';
import { formatChecklistAnswer } from '@/lib/inspection-checklist-display';
import { evidencesForItem } from '@/lib/evidence-gallery';
import { historyForItem } from '@/lib/answer-history-rules';
import { fetchResponseHistory } from '@/lib/response-history-api';
import { describeLoadError } from '@/lib/state-copy';
import {
  addItemReviewComment,
  commentsForItem,
  describeCommentError,
  fetchItemReviewComments,
  type ItemReviewComment,
} from '@/lib/item-review-comments-api';
import type { AnswerRevision } from '@/types';
import { AnswerHistoryToggle } from './AnswerHistoryToggle';
import { ItemReviewComments, type CommentSubmitResult, type ItemCommentsStatus } from './ItemReviewComments';
import type { AnswerHistoryStatus } from './AnswerHistory';
import { EvidenceThumbnail } from './EvidenceThumbnail';
import { useEvidenceViewer } from './EvidenceViewerContext';

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

function ChecklistItemCard({
  item,
  inspectionId,
  itemEvidences,
  onOpenEvidence,
  history,
  comments,
}: {
  item: InspectionChecklistItem;
  inspectionId: string;
  itemEvidences: MonitoringEvidence[];
  onOpenEvidence?: (evidenceId: string) => void;
  history: { revisions: AnswerRevision[]; status: AnswerHistoryStatus; error: string | null; onRetry: () => void };
  comments: {
    items: ItemReviewComment[];
    status: ItemCommentsStatus;
    error: string | null;
    onRetry: () => void;
    canComment: boolean;
    onSubmit: (itemId: string, text: string) => Promise<CommentSubmitResult>;
  };
}) {
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

      {itemEvidences.length > 0 && onOpenEvidence ? (
        <div className="mt-2.5">
          <div className="text-xs font-semibold text-slate-500 mb-1.5">{itemEvidences.length} foto(s)</div>
          <div className="flex flex-row gap-2 overflow-x-auto">
            {itemEvidences.map((evidence) => (
              <div key={evidence.id} className="shrink-0">
                <EvidenceThumbnail
                  inspectionId={inspectionId}
                  evidence={evidence}
                  size="mini"
                  onOpen={() => onOpenEvidence(evidence.id)}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <AnswerHistoryToggle
        itemId={item.id}
        revisions={historyForItem(history.revisions, item.id)}
        status={history.status}
        error={history.error}
        onRetry={history.onRetry}
      />

      <ItemReviewComments
        itemId={item.id}
        comments={commentsForItem(comments.items, item.id)}
        status={comments.status}
        error={comments.error}
        onRetry={comments.onRetry}
        canComment={comments.canComment}
        onSubmit={(text) => comments.onSubmit(item.id, text)}
      />

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
export function InspectionReviewChecklist({
  inspectionId,
  canComment = false,
}: {
  inspectionId: string;
  /** Comentar por item só é permitido com a inspeção em revisão (a API recusa o resto com 409). */
  canComment?: boolean;
}) {
  const viewer = useEvidenceViewer();
  const [sections, setSections] = useState<InspectionChecklistSection[]>([]);
  const [status, setStatus] = useState<ChecklistStatus>('loading');
  const [errorTitle, setErrorTitle] = useState('Não foi possível carregar as respostas');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const [revisions, setRevisions] = useState<AnswerRevision[]>([]);
  const [historyStatus, setHistoryStatus] = useState<AnswerHistoryStatus>('loading');
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyToken, setHistoryToken] = useState(0);

  const [comments, setComments] = useState<ItemReviewComment[]>([]);
  const [commentsStatus, setCommentsStatus] = useState<ItemCommentsStatus>('loading');
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentsToken, setCommentsToken] = useState(0);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);
  const reloadComments = useCallback(() => setCommentsToken((n) => n + 1), []);
  const reloadHistory = useCallback(() => setHistoryToken((n) => n + 1), []);
  const sortedEvidences = viewer?.status === 'ready' ? viewer.sortedEvidences : [];
  const openEvidence = viewer?.openEvidence;

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

  // Histórico de respostas: falha aqui não bloqueia o checklist nem aprovar/reprovar.
  useEffect(() => {
    let active = true;
    setHistoryStatus('loading');
    setHistoryError(null);
    void fetchResponseHistory(inspectionId)
      .then((next) => {
        if (!active) return;
        setRevisions(next);
        setHistoryStatus('ready');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setHistoryError(describeLoadError(error, 'Não foi possível carregar o histórico.').message);
        setHistoryStatus('error');
      });
    return () => {
      active = false;
    };
  }, [inspectionId, historyToken]);

  // Comentários de revisão: falha aqui não bloqueia o checklist nem aprovar/reprovar.
  useEffect(() => {
    let active = true;
    setCommentsStatus('loading');
    setCommentsError(null);
    void fetchItemReviewComments(inspectionId)
      .then((next) => {
        if (!active) return;
        setComments(next);
        setCommentsStatus('ready');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCommentsError(describeCommentError(error).message);
        setCommentsStatus('error');
      });
    return () => {
      active = false;
    };
  }, [inspectionId, commentsToken]);

  const submitComment = useCallback(
    async (itemId: string, text: string): Promise<CommentSubmitResult> => {
      try {
        const created = await addItemReviewComment(inspectionId, itemId, text);
        setComments((prev) => [...prev, created]);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: describeCommentError(error).message };
      }
    },
    [inspectionId]
  );

  const commentsProps = {
    items: comments,
    status: commentsStatus,
    error: commentsError,
    onRetry: reloadComments,
    canComment,
    onSubmit: submitComment,
  };

  const history = { revisions, status: historyStatus, error: historyError, onRetry: reloadHistory };

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
              section.items.map((item) => (
                <ChecklistItemCard
                  key={item.id}
                  item={item}
                  inspectionId={inspectionId}
                  itemEvidences={evidencesForItem(sortedEvidences, item.id)}
                  onOpenEvidence={openEvidence}
                  history={history}
                  comments={commentsProps}
                />
              ))
            )}
          </div>
        ))}
    </div>
  );
}
