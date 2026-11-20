import type { AnswerRevision, AnswerSnapshot, ConformityAnswer } from '@/types';

export const NO_ANSWER_LABEL = 'Sem resposta';
export const EMPTY_HISTORY_MESSAGE = 'Nenhuma alteração registrada para esta resposta.';

const CONFORMITY_LABEL: Record<ConformityAnswer, string> = {
  CONFORME: 'Conforme',
  NAO_CONFORME: 'Não conforme',
  NAO_APLICAVEL: 'Não aplicável',
};

const API_CONFORMITY: Record<string, ConformityAnswer> = {
  CONFORMING: 'CONFORME',
  NON_CONFORMING: 'NAO_CONFORME',
  NOT_APPLICABLE: 'NAO_APLICAVEL',
};

/** Valores de uma resposta como a API devolve no histórico (InspectionResponseHistoryValues). */
export interface ApiHistoryValues {
  valueText?: string | null;
  valueNumber?: number | null;
  valueBoolean?: boolean | null;
  valueDate?: string | null;
  conformity?: string | null;
  observation?: string | null;
}

/** Entrada do histórico (InspectionResponseHistoryEntry — GET /inspections/{id}/response-history). */
export interface ApiResponseHistoryEntry {
  id: string;
  inspectionItemId: string;
  action: 'CREATED' | 'UPDATED';
  previous?: ApiHistoryValues | null;
  current: ApiHistoryValues;
  changedBy: string;
  changedByName: string;
  changedAt: string;
}

/** Converte os valores da API no resumo exibido (conformidade, valor e observação). */
export function snapshotFromApi(values: ApiHistoryValues | null | undefined): AnswerSnapshot | undefined {
  if (!values) return undefined;
  const snapshot: AnswerSnapshot = {};
  const conformity = values.conformity ? API_CONFORMITY[values.conformity] : undefined;
  if (conformity) snapshot.conformity = conformity;
  const value =
    values.valueText?.trim() ? values.valueText
    : values.valueNumber != null ? String(values.valueNumber)
    : values.valueBoolean != null ? (values.valueBoolean ? 'Sim' : 'Não')
    : values.valueDate ? values.valueDate
    : undefined;
  if (value) snapshot.value = value;
  if (values.observation?.trim()) snapshot.observacao = values.observation;
  return snapshot;
}

/** Entrada da API → revisão da tela. A primeira resposta (CREATED) não tem "antes". */
export function toRevision(inspectionId: string, entry: ApiResponseHistoryEntry): AnswerRevision {
  const anterior = entry.action === 'CREATED' ? undefined : snapshotFromApi(entry.previous);
  return {
    id: entry.id,
    inspectionId,
    itemId: entry.inspectionItemId,
    autorNome: entry.changedByName,
    autorId: entry.changedBy,
    em: entry.changedAt,
    anterior: anterior && Object.keys(anterior).length > 0 ? anterior : undefined,
    novo: snapshotFromApi(entry.current) ?? {},
  };
}

/** Resumo legível: "Conforme", "Não conforme · obs: ..." ou o valor digitado. */
export function describeSnapshot(snapshot: AnswerSnapshot | undefined): string {
  if (!snapshot) return NO_ANSWER_LABEL;
  const main = snapshot.conformity ? CONFORMITY_LABEL[snapshot.conformity] : snapshot.value;
  const parts = [main, snapshot.observacao ? `obs: ${snapshot.observacao}` : undefined].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : NO_ANSWER_LABEL;
}

/** Revisões de um item, da mais recente para a mais antiga. */
export function historyForItem(revisions: AnswerRevision[] | undefined, itemId: string): AnswerRevision[] {
  return (revisions ?? [])
    .filter((r) => r.itemId === itemId)
    .sort((a, b) => b.em.localeCompare(a.em));
}
