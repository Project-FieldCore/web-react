'use client';

import { useCallback, useEffect, useState } from 'react';
import { describeReportError, downloadInspectionReport } from '@/lib/inspection-report-api';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; fileName: string }
  | { status: 'error'; message: string; retry: boolean };

/** "Baixar PDF" do relatório da inspeção aprovada, com estados de carregando, erro e sucesso. */
export function DownloadReportButton({ inspectionId }: { inspectionId: string }) {
  const [state, setState] = useState<State>({ status: 'idle' });

  const download = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const fileName = await downloadInspectionReport(inspectionId);
      setState({ status: 'success', fileName });
    } catch (error) {
      const copy = describeReportError(error);
      setState({ status: 'error', message: copy.message, retry: copy.retry });
    }
  }, [inspectionId]);

  useEffect(() => {
    if (state.status !== 'success') return;
    const timer = setTimeout(() => setState({ status: 'idle' }), 5000);
    return () => clearTimeout(timer);
  }, [state.status]);

  const loading = state.status === 'loading';

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void download()}
        disabled={loading}
        aria-busy={loading}
        className="bg-brandgreen-600 hover:bg-brandgreen-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl px-4 py-2 whitespace-nowrap transition-colors"
      >
        {loading ? 'Gerando PDF...' : 'Baixar PDF'}
      </button>
      {state.status === 'success' && (
        <p role="status" aria-live="polite" className="text-xs font-semibold text-emerald-700">PDF baixado.</p>
      )}
      {state.status === 'error' && (
        <p role="alert" className="text-xs font-semibold text-red-600 max-w-[260px] text-right">
          {state.message}
          {state.retry && (
            <button type="button" onClick={() => void download()} className="ml-1.5 font-bold underline">
              Tentar novamente
            </button>
          )}
        </p>
      )}
    </div>
  );
}
