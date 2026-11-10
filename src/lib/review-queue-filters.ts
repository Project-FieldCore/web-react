/**
 * Helpers puros da fila de revisão (PBI-0056.2) — validação de período antes do GET.
 */

/** Converte `datetime-local` para ISO; vazio/inválido → undefined. */
export function toSubmittedIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** true quando ambos estão preenchidos e início > fim (não chama a API). */
export function isSubmittedPeriodInvalid(submittedFrom: string, submittedTo: string): boolean {
  if (!submittedFrom || !submittedTo) return false;
  const from = new Date(submittedFrom);
  const to = new Date(submittedTo);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return false;
  return from.getTime() > to.getTime();
}

export const SUBMITTED_PERIOD_ORDER_MESSAGE = 'O início do período não pode ser depois do fim.';
