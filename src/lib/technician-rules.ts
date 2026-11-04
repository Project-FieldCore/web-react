import type { InspectionStatus, User } from '@/types';

/**
 * Atribuição de inspeção a técnico (PBI-0027.1). Lógica pura, sem React, para ser testável.
 * - RN-027: somente técnico ativo recebe nova atribuição.
 * - RN-028: a inspeção aparece para o técnico depois da sincronização (acontece no app de campo).
 */

export const NOT_A_TECHNICIAN_MESSAGE = 'O usuário escolhido não é um técnico.';
export const INACTIVE_TECHNICIAN_MESSAGE = 'Somente técnicos ativos podem receber uma nova atribuição (RN-027).';
export const UNKNOWN_TECHNICIAN_MESSAGE = 'Técnico não encontrado. Recarregue a lista de técnicos e tente de novo.';
export const NOT_REASSIGNABLE_MESSAGE = 'Esta inspeção já não pode ser reatribuída no estado atual.';
export const SAME_TECHNICIAN_MESSAGE = 'Esta inspeção já está atribuída a esse técnico.';

/** Perfil técnico e situação ativa (RN-027). */
export function isAssignable(user: Pick<User, 'role' | 'status'>): boolean {
  return user.role === 'TECHNICIAN' && user.status === 'ATIVO';
}

/** Por que o usuário não pode receber a atribuição (ou null se pode). `undefined` = não está na lista carregada. */
export function assignBlockedReason(user: Pick<User, 'role' | 'status'> | undefined): string | null {
  if (!user) return UNKNOWN_TECHNICIAN_MESSAGE;
  if (user.role !== 'TECHNICIAN') return NOT_A_TECHNICIAN_MESSAGE;
  if (user.status !== 'ATIVO') return INACTIVE_TECHNICIAN_MESSAGE;
  return null;
}

/** Técnicos ativos, em ordem alfabética (pt-BR, sem diferenciar acento nem maiúscula). */
export function activeTechnicians<T extends Pick<User, 'role' | 'status' | 'nome'>>(users: T[]): T[] {
  return users
    .filter(isAssignable)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
}

/** Só inspeção atribuída ou em rascunho pode trocar de técnico (a API recusa nos outros estados). */
export function canReassign(status: InspectionStatus): boolean {
  return status === 'ATRIBUIDA' || status === 'RASCUNHO';
}

/** Por que a inspeção não pode ser reatribuída (ou null se pode). */
export function reassignBlockedReason(inspection: { status: InspectionStatus; tecnicoId: string }, technicianId: string): string | null {
  if (!canReassign(inspection.status)) return NOT_REASSIGNABLE_MESSAGE;
  if (inspection.tecnicoId === technicianId) return SAME_TECHNICIAN_MESSAGE;
  return null;
}

/** Aviso mostrado depois de agendar pela API (RN-028). */
export const SYNC_NOTICE = 'Ela ficará disponível para o técnico no aplicativo depois da sincronização (RN-028).';
