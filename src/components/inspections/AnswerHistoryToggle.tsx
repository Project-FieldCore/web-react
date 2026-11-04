'use client';

import { useState } from 'react';
import { AnswerHistory } from './AnswerHistory';
import type { AnswerRevision } from '@/types';

/** Botão "Histórico (n)" que abre/fecha a linha do tempo de alterações da resposta. */
export function AnswerHistoryToggle({ itemId, revisions }: { itemId: string; revisions: AnswerRevision[] }) {
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
        {open ? 'Ocultar histórico' : `Histórico (${revisions.length})`}
      </button>
      {open && (
        <div id={panelId} className="mt-1">
          <AnswerHistory revisions={revisions} />
        </div>
      )}
    </div>
  );
}
