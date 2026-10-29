import { cancelBlockedReason } from '@/lib/cancel-rules';
import type { InspectionStatus } from '@/types';

/**
 * Ponto de entrada do cancelamento na tela da inspeção: o botão aparece quando
 * dá para cancelar; numa aprovada, explica que não cancela pelo fluxo comum
 * (RN-030); numa já cancelada, não mostra nada (o registro do cancelamento já aparece).
 */
export function CancelInspectionAction({ status, onCancel }: { status: InspectionStatus; onCancel: () => void }) {
  const blocked = cancelBlockedReason(status);

  if (blocked === null) {
    return (
      <div className="mb-5 flex justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-bold text-red-600 border border-red-200 bg-white rounded-xl px-4 py-2.5 hover:bg-red-50"
        >
          Cancelar inspeção
        </button>
      </div>
    );
  }

  if (status === 'APROVADA') {
    return <p className="mb-5 text-xs text-slate-500 text-right">{blocked}</p>;
  }

  return null;
}
