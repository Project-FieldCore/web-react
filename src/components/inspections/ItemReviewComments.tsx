'use client';

import { useId, useState } from 'react';
import { formatDateTime } from '@/lib/inspection-display';
import {
  EMPTY_COMMENTS_MESSAGE,
  MAX_COMMENT_LENGTH,
  validateCommentText,
  type ItemReviewComment,
} from '@/lib/item-review-comments-api';

export type ItemCommentsStatus = 'loading' | 'error' | 'ready';
export type CommentSubmitResult = { ok: true } | { ok: false; error: string };

interface Props {
  itemId: string;
  comments: ItemReviewComment[];
  status?: ItemCommentsStatus;
  error?: string | null;
  onRetry?: () => void;
  /** Só com a inspeção em revisão (a API recusa nos outros status com 409). */
  canComment: boolean;
  onSubmit: (text: string) => Promise<CommentSubmitResult>;
}

type PanelProps = Omit<Props, 'itemId'> & { panelId: string };

/** Conteúdo do painel: estados carregando/erro/vazio, lista (autor, data, texto) e formulário. */
export function ItemCommentsPanel({ panelId, comments, status = 'ready', error, onRetry, canComment, onSubmit }: PanelProps) {
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fieldId = useId();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const invalid = validateCommentText(text);
    if (invalid) {
      setFormError(invalid);
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      const result = await onSubmit(text);
      if (result.ok) setText('');
      else setFormError(result.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <div id={panelId} className="mt-1.5">
      {status === 'loading' && (
        <p role="status" aria-live="polite" className="text-xs text-slate-400 py-2">Carregando comentários...</p>
      )}

      {status === 'error' && (
        <div role="alert" className="text-xs text-red-600 py-2">
          {error ?? 'Não foi possível carregar os comentários.'}
          {onRetry && <button type="button" onClick={onRetry} className="ml-2 font-bold underline">Tentar novamente</button>}
        </div>
      )}

      {status === 'ready' && comments.length === 0 && (
        <p className="text-xs text-slate-400 py-2">{EMPTY_COMMENTS_MESSAGE}</p>
      )}

      {status === 'ready' && comments.length > 0 && (
        <ul aria-label="Comentários de revisão do item" className="space-y-2 py-1">
          {comments.map((c) => (
            <li key={c.id} className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs">
              <div className="text-slate-700 whitespace-pre-wrap break-words">{c.texto}</div>
              <div className="text-slate-400 mt-1">{c.autorNome} · {formatDateTime(c.em)}</div>
            </li>
          ))}
        </ul>
      )}

      {canComment && (
        <form onSubmit={submit} className="mt-2">
          <label htmlFor={fieldId} className="sr-only">Novo comentário de revisão</label>
          <textarea
            id={fieldId}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
            rows={2}
            maxLength={MAX_COMMENT_LENGTH}
            placeholder="Escreva um comentário sobre este item..."
            disabled={pending}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400"
          />
          <div className="flex items-center justify-between gap-3 mt-1">
            <span className="text-[11px] text-slate-400">{text.length}/{MAX_COMMENT_LENGTH}</span>
            <button
              type="submit"
              disabled={pending || !text.trim()}
              aria-busy={pending}
              className="bg-navy-700 hover:bg-navy-900 disabled:opacity-50 text-white font-bold text-xs rounded-lg px-3 py-1.5 transition-colors"
            >
              {pending ? 'Enviando...' : 'Comentar'}
            </button>
          </div>
          {formError && <p role="alert" className="text-xs font-semibold text-red-600 mt-1">{formError}</p>}
        </form>
      )}
    </div>
  );
}

/** Botão "Comentários (n)" que abre/fecha o painel de comentários de revisão do item. */
export function ItemReviewComments({ itemId, ...panel }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = `item-comments-${itemId}`;
  const { status = 'ready', comments } = panel;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="text-xs font-bold text-navy-700"
      >
        {open ? 'Ocultar comentários' : status === 'ready' ? `Comentários (${comments.length})` : 'Comentários'}
      </button>
      {open && <ItemCommentsPanel panelId={panelId} {...panel} />}
    </div>
  );
}
