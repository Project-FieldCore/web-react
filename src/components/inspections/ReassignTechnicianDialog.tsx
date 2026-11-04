'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { InlineError } from '@/components/States';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { TechnicianField } from './TechnicianField';

type Result = { ok: true } | { ok: false; error: string };

/**
 * Troca o técnico de uma inspeção atribuída (RN-027: só técnico ativo recebe).
 * Fecha com Esc, menos enquanto envia. Quem usa decide o que acontece ao confirmar.
 */
export function ReassignTechnicianDialog({
  inspectionId,
  currentTechnicianName,
  onConfirm,
  onClose,
}: {
  inspectionId: string;
  currentTechnicianName?: string;
  onConfirm: (technicianId: string) => Promise<Result>;
  onClose: () => void;
}) {
  const titleId = useId();
  const fieldId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const submit = useAsyncAction();
  const [technicianId, setTechnicianId] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submit.pending) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, submit.pending]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!technicianId) {
      setFieldError('Escolha o novo técnico.');
      return;
    }
    setFieldError(null);
    const result = await submit.run(() => onConfirm(technicianId));
    if (result.ok) onClose();
  }

  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4 sm:p-6">
      <form onSubmit={handleSubmit} role="dialog" aria-modal="true" aria-labelledby={titleId} className="bg-white rounded-2xl max-w-md w-full p-6">
        <h3 id={titleId} className="font-extrabold text-navy-900 mb-1">
          Alterar técnico
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          {inspectionId}
          {currentTechnicianName ? ` · atualmente com ${currentTechnicianName}` : ''}
        </p>

        <label htmlFor={fieldId} className="text-xs font-bold text-navy-700 uppercase block mb-1">
          Novo técnico <span className="text-red-600">*</span>
        </label>
        <TechnicianField
          id={fieldId}
          value={technicianId}
          onChange={(id) => {
            setTechnicianId(id);
            if (fieldError) setFieldError(null);
          }}
          disabled={submit.pending}
        />
        {fieldError && (
          <p role="alert" className="text-xs text-red-600 font-semibold mt-1">
            {fieldError}
          </p>
        )}

        <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 mt-4 mb-4">
          Só técnicos ativos aparecem (RN-027). A inspeção passa a ser do novo técnico e some da lista do anterior.
        </p>

        {submit.error && (
          <div className="mb-4">
            <InlineError message={submit.error} />
          </div>
        )}

        <div className="flex gap-2">
          <button type="button" ref={cancelRef} onClick={onClose} disabled={submit.pending} className="flex-1 bg-white border border-slate-300 text-slate-600 rounded-xl py-2.5 font-bold disabled:opacity-60">
            Cancelar
          </button>
          <button type="submit" disabled={submit.pending} className="flex-1 bg-navy-900 text-white rounded-xl py-2.5 font-bold disabled:opacity-60">
            {submit.pending ? 'Alterando...' : 'Confirmar'}
          </button>
        </div>
      </form>
    </div>
  );
}
