'use client';

import { useCallback, useEffect, useState } from 'react';
import { describeCsvError } from '@/lib/csv-export-api';
import { saveBlobAsFile } from '@/lib/file-download';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success' }
  | { status: 'error'; message: string; retry: boolean };

interface Props {
  /** Texto do botão, ex.: "Exportar CSV". */
  label?: string;
  /** Nome do arquivo salvo, ex.: "users.csv". */
  fileName: string;
  /** Busca o CSV na API com os filtros atuais da lista. */
  onExport: () => Promise<Blob>;
  disabled?: boolean;
  /** Explica por que está desabilitado (aparece ao passar o mouse). */
  disabledReason?: string;
  /** Aviso curto abaixo do botão (ex.: limite de linhas da exportação). */
  note?: string;
}

/** "Exportar CSV" de uma listagem, com estados de carregando, erro e sucesso. */
export function ExportCsvButton({ label = 'Exportar CSV', fileName, onExport, disabled = false, disabledReason, note }: Props) {
  const [state, setState] = useState<State>({ status: 'idle' });

  const run = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      saveBlobAsFile(await onExport(), fileName);
      setState({ status: 'success' });
    } catch (error) {
      const copy = describeCsvError(error);
      setState({ status: 'error', message: copy.message, retry: copy.retry });
    }
  }, [onExport, fileName]);

  useEffect(() => {
    if (state.status !== 'success') return;
    const timer = setTimeout(() => setState({ status: 'idle' }), 4000);
    return () => clearTimeout(timer);
  }, [state.status]);

  const loading = state.status === 'loading';

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void run()}
        disabled={disabled || loading}
        aria-busy={loading}
        title={disabled ? disabledReason : undefined}
        className="bg-white border border-slate-300 hover:border-navy-700 disabled:opacity-50 disabled:cursor-not-allowed text-navy-700 font-bold text-sm rounded-xl px-4 py-2.5 whitespace-nowrap transition-colors"
      >
        {loading ? 'Exportando...' : label}
      </button>
      {note && state.status === 'idle' && <p className="text-[11px] text-slate-400 max-w-[220px]">{note}</p>}
      {state.status === 'success' && (
        <p role="status" aria-live="polite" className="text-xs font-semibold text-emerald-700">CSV exportado.</p>
      )}
      {state.status === 'error' && (
        <p role="alert" className="text-xs font-semibold text-red-600 max-w-[260px]">
          {state.message}
          {state.retry && (
            <button type="button" onClick={() => void run()} className="ml-1.5 font-bold underline">
              Tentar novamente
            </button>
          )}
        </p>
      )}
    </div>
  );
}
