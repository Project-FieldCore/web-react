import type { Answer, ItemType, ModelItem } from '@/types';

/**
 * Regras por item do checklist (PBI-0021.1): obrigatório (`required`),
 * observação obrigatória na falha (`observation_required_on_failure`) e
 * evidência obrigatória na falha (`evidence_required_on_failure`). Lógica pura,
 * sem React, para ser testável.
 */

/**
 * "Falha" só existe em itens de conformidade (resposta "não conforme"). Em
 * texto, número, data etc. não há o que falhar, então as flags "na falha" não
 * se aplicam a esses tipos.
 */
const FAILURE_RULE_TYPES: ItemType[] = ['CONFORMITY'];

export function supportsFailureRules(type: ItemType): boolean {
  return FAILURE_RULE_TYPES.includes(type);
}

/** Aplica uma alteração ao item; se o tipo não aceita regras "na falha", elas voltam para `false`. */
export function applyItemPatch(item: ModelItem, patch: Partial<ModelItem>): ModelItem {
  const next = { ...item, ...patch };
  if (supportsFailureRules(next.type)) return next;
  return next.evidenceRequiredOnFailure || next.observationRequiredOnFailure
    ? { ...next, evidenceRequiredOnFailure: false, observationRequiredOnFailure: false }
    : next;
}

function isNonConforming(answer: Answer | undefined): boolean {
  return answer?.conformity === 'NAO_CONFORME';
}

/** Item que exige observação na falha, respondido "não conforme" sem observação preenchida. */
export function missingObservation(item: ModelItem, answer: Answer | undefined): boolean {
  return item.observationRequiredOnFailure && isNonConforming(answer) && !answer?.observacao?.trim();
}

/** Item que exige evidência na falha, respondido "não conforme" sem nenhuma evidência. */
export function missingEvidence(item: ModelItem, evidenceCount: number | undefined): boolean {
  return item.evidenceRequiredOnFailure && (evidenceCount ?? 0) === 0;
}
