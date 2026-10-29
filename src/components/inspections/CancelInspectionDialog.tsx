'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { InlineError } from '@/components/States';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { MAX_JUSTIFICATION, validateJustification } from '@/lib/cancel-rules';

type CancelResult = { ok: true } | { ok: false; error: string };

/**
 * Confirmação do cancelamento: a justificativa é obrigatória (RN-029) e o
 * aviso deixa claro que ficam registrados quem cancelou, quando e por quê.
 * Fecha com Esc (menos enquanto envia). Quem usa decide o que fazer ao confirmar.
 */
export function CancelInspectionDialog({
  inspectionId,
  clientName,
  locationName,
  onConfirm,
  onClose,
}: {
  inspectionId: string;
  clientName?: string;
  locationName?: string;
  onConfirm: (justification: string) => Promise<CancelResult>;
  onClose: () => void;
}) {
  const titleId = useId();
  const fieldId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submit = useAsyncAction();
  const [justification, setJustification] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
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
    const invalid = validateJustification(justification);
    setFieldError(invalid);
    if (invalid) return;
    const result = await submit.run(() => onConfirm(justification));
    if (result.ok) onClose();
  }

  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4 sm:p-6">
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded-2xl max-w-md w-full p-6"
      >
        <h3 id={titleId} className="font-extrabold text-navy-900 mb-1">
          Cancelar inspeção
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          {inspectionId}
          {clientName ? ` · ${clientName}` : ''}
          {locationName ? ` · ${locationName}` : ''}
        </p>

        <label htmlFor={fieldId} className="text-xs font-bold text-navy-700 uppercase block mb-1">
          Justificativa <span className="text-red-600">*</span>
        </label>
        <textarea
          id={fieldId}
          ref={textareaRef}
          value={justification}
          onChange={(e) => {
            setJustification(e.target.value);
            if (fieldError) setFieldError(null);
          }}
          rows={4}
          maxLength={MAX_JUSTIFICATION}
          disabled={submit.pending}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? `${fieldId}-error` : undefined}
          placeholder="Explique por que esta inspeção está sendo cancelada."
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50"
        />
        <div className="flex items-start justify-between gap-3 mt-1 mb-3">
          {fieldError ? (
            <p id={`${fieldId}-error`} role="alert" className="text-xs text-red-600 font-semibold">
              {fieldError}
            </p>
          ) : (
            <span />
          )}
          <span className="text-[11px] text-slate-400 shrink-0">
            {justification.length}/{MAX_JUSTIFICATION}
          </span>
        </div>

        <p className="text-xs text-slate-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-4">
          O cancelamento registra seu nome, a data e a justificativa e <strong>não pode ser desfeito</strong>.
        </p>

        {submit.error && (
          <div className="mb-4">
            <InlineError message={submit.error} />
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submit.pending}
            className="flex-1 bg-white border border-slate-300 text-slate-600 rounded-xl py-2.5 font-bold disabled:opacity-60"
          >
            Voltar
          </button>
          <button
            type="submit"
            disabled={submit.pending}
            className="flex-1 bg-red-600 text-white rounded-xl py-2.5 font-bold disabled:opacity-60"
          >
            {submit.pending ? 'Cancelando...' : 'Confirmar cancelamento'}
          </button>
        </div>
      </form>
    </div>
  );
}
