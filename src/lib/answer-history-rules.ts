import type { Answer, AnswerRevision, AnswerSnapshot, ConformityAnswer, User } from '@/types';

export const NO_ANSWER_LABEL = 'Sem resposta';
export const EMPTY_HISTORY_MESSAGE = 'Nenhuma alteração registrada para esta resposta.';

const CONFORMITY_LABEL: Record<ConformityAnswer, string> = {
  CONFORME: 'Conforme',
  NAO_CONFORME: 'Não conforme',
  NAO_APLICAVEL: 'Não aplicável',
};

/** Só o que é auditável: o que a pessoa respondeu (fotos e contagens ficam de fora). */
export function toSnapshot(answer: Answer | undefined): AnswerSnapshot | undefined {
  if (!answer) return undefined;
  const snapshot: AnswerSnapshot = {};
  if (answer.conformity) snapshot.conformity = answer.conformity;
  if (answer.value?.trim()) snapshot.value = answer.value;
  if (answer.observacao?.trim()) snapshot.observacao = answer.observacao;
  return snapshot;
}

function sameSnapshot(a: AnswerSnapshot | undefined, b: AnswerSnapshot | undefined): boolean {
  return (a?.conformity ?? null) === (b?.conformity ?? null)
    && (a?.value ?? null) === (b?.value ?? null)
    && (a?.observacao ?? null) === (b?.observacao ?? null);
}

/** Resumo legível: "Conforme", "Não conforme · obs: ..." ou o valor digitado. */
export function describeSnapshot(snapshot: AnswerSnapshot | undefined): string {
  if (!snapshot) return NO_ANSWER_LABEL;
  const main = snapshot.conformity ? CONFORMITY_LABEL[snapshot.conformity] : snapshot.value;
  const parts = [main, snapshot.observacao ? `obs: ${snapshot.observacao}` : undefined].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : NO_ANSWER_LABEL;
}

interface BuildRevisionInput {
  id: string;
  inspectionId: string;
  itemId: string;
  previous: Answer | undefined;
  next: Answer;
  autor: Pick<User, 'id' | 'nome'> | null;
  em: string;
}

/** Cria a revisão só quando o conteúdo mudou — salvar igual não gera ruído no histórico. */
export function buildRevision(input: BuildRevisionInput): AnswerRevision | undefined {
  const anterior = toSnapshot(input.previous);
  const novo = toSnapshot(input.next) ?? {};
  if (sameSnapshot(anterior, novo)) return undefined;
  const hadContent = anterior && Object.keys(anterior).length > 0;
  return {
    id: input.id,
    inspectionId: input.inspectionId,
    itemId: input.itemId,
    autorNome: input.autor?.nome ?? 'Sistema',
    autorId: input.autor?.id,
    em: input.em,
    anterior: hadContent ? anterior : undefined,
    novo,
  };
}

/** Revisões de um item, da mais recente para a mais antiga. */
export function historyForItem(revisions: AnswerRevision[] | undefined, itemId: string): AnswerRevision[] {
  return (revisions ?? [])
    .filter((r) => r.itemId === itemId)
    .sort((a, b) => b.em.localeCompare(a.em));
}
