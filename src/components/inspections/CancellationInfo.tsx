import { formatDateTime } from '@/lib/inspection-display';
import type { Cancellation } from '@/types';

/** Registro do cancelamento (RN-029): quem cancelou, quando e a justificativa. */
export function CancellationInfo({ cancelamento }: { cancelamento: Cancellation }) {
  return (
    <section aria-label="Cancelamento" className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-5">
      <h2 className="text-xs font-bold text-slate-500 uppercase mb-3">Inspeção cancelada</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-slate-400 text-xs uppercase font-bold mb-1">Cancelada por</dt>
          <dd className="text-navy-900 font-semibold">{cancelamento.porNome}</dd>
        </div>
        <div>
          <dt className="text-slate-400 text-xs uppercase font-bold mb-1">Em</dt>
          <dd className="text-navy-900 font-semibold">{formatDateTime(cancelamento.em)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-400 text-xs uppercase font-bold mb-1">Justificativa</dt>
          <dd className="whitespace-pre-wrap break-words text-slate-700">{cancelamento.justificativa}</dd>
        </div>
      </dl>
    </section>
  );
}
