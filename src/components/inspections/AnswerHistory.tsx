import { formatDateTime } from '@/lib/inspection-display';
import { describeSnapshot, EMPTY_HISTORY_MESSAGE } from '@/lib/answer-history-rules';
import type { AnswerRevision } from '@/types';

export type AnswerHistoryStatus = 'loading' | 'error' | 'ready';

interface Props {
  revisions: AnswerRevision[];
  status?: AnswerHistoryStatus;
  error?: string | null;
  onRetry?: () => void;
}

/** Linha do tempo das alterações de uma resposta: quem, quando, de quê para quê. */
export function AnswerHistory({ revisions, status = 'ready', error, onRetry }: Props) {
  if (status === 'loading') {
    return <p role="status" aria-live="polite" className="text-xs text-slate-400 py-2">Carregando histórico...</p>;
  }
  if (status === 'error') {
    return (
      <div role="alert" className="text-xs text-red-600 py-2">
        {error ?? 'Não foi possível carregar o histórico.'}
        {onRetry && <button type="button" onClick={onRetry} className="ml-2 font-bold underline">Tentar novamente</button>}
      </div>
    );
  }
  if (revisions.length === 0) {
    return <p className="text-xs text-slate-400 py-2">{EMPTY_HISTORY_MESSAGE}</p>;
  }
  return (
    <ol aria-label="Histórico de alterações da resposta" className="border-l-2 border-slate-200 ml-1 pl-3 space-y-2.5 py-1">
      {revisions.map((r) => (
        <li key={r.id} className="text-xs">
          <div className="text-slate-700">
            <span className="text-slate-400">{describeSnapshot(r.anterior)}</span>
            <span aria-hidden="true"> → </span>
            <span className="sr-only"> alterado para </span>
            <span className="font-semibold">{describeSnapshot(r.novo)}</span>
          </div>
          <div className="text-slate-400 mt-0.5">{r.autorNome} · {formatDateTime(r.em)}</div>
        </li>
      ))}
    </ol>
  );
}
