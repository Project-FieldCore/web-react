'use client';

import { useState } from 'react';
import { AnswerHistory, type AnswerHistoryStatus } from './AnswerHistory';
import type { AnswerRevision } from '@/types';

/** Botão "Histórico (n)" que abre/fecha a linha do tempo de alterações da resposta. */
interface Props {
  itemId: string;
  revisions: AnswerRevision[];
  status?: AnswerHistoryStatus;
  error?: string | null;
  onRetry?: () => void;
}

export function AnswerHistoryToggle({ itemId, revisions, status = 'ready', error, onRetry }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = `answer-history-${itemId}`;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="text-xs font-bold text-navy-700"
      >
        {open ? 'Ocultar histórico' : status === 'ready' ? `Histórico (${revisions.length})` : 'Histórico'}
      </button>
      {open && (
        <div id={panelId} className="mt-1">
          <AnswerHistory revisions={revisions} status={status} error={error} onRetry={onRetry} />
        </div>
      )}
    </div>
  );
}
