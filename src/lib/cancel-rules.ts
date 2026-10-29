import type { Cancellation, InspectionStatus } from '@/types';

/**
 * Cancelamento de inspeção (PBI-0029.1). Lógica pura, sem React, para ser testável.
 * - RN-029: o cancelamento registra usuário, data e justificativa.
 * - RN-030: inspeção aprovada não é cancelada pelo fluxo comum.
 */

/** Limite da justificativa na API (`canceled_reason` tem 1000 caracteres). */
export const MAX_JUSTIFICATION = 1000;

/** Por que a inspeção não pode ser cancelada agora (ou null se pode). */
export function cancelBlockedReason(status: InspectionStatus): string | null {
  if (status === 'APROVADA') return 'Inspeção aprovada não pode ser cancelada pelo fluxo comum (RN-030).';
  if (status === 'CANCELADA') return 'Esta inspeção já está cancelada.';
  return null;
}

export function canCancel(status: InspectionStatus): boolean {
  return cancelBlockedReason(status) === null;
}

/** A justificativa é obrigatória (RN-029) e cabe no limite. */
export function validateJustification(text: string): string | null {
  const justification = text.trim();
  if (!justification) return 'Informe a justificativa do cancelamento (RN-029).';
  if (justification.length > MAX_JUSTIFICATION) {
    return `A justificativa deve ter no máximo ${MAX_JUSTIFICATION} caracteres.`;
  }
  return null;
}

/** O registro de cancelamento: quem, quando e por quê. */
export function buildCancellation(user: { id?: string; nome: string }, justification: string, now: Date = new Date()): Cancellation {
  return {
    porNome: user.nome,
    porId: user.id,
    em: now.toISOString(),
    justificativa: justification.trim(),
  };
}
