import type { Answer, ConformityAnswer, ItemType, ModelItem } from '@/types';

/**
 * Como cada tipo de resposta do checklist é renderizado (PBI-0022). Lógica
 * pura, sem React: o componente só traduz estas decisões em marcação.
 */

/** O que a pessoa digita/escolhe na prévia — nada disso é salvo. */
export type PreviewAnswer = Pick<Answer, 'conformity' | 'value' | 'observacao'>;

export type FieldKind = 'text' | 'textarea' | 'number' | 'date' | 'boolean' | 'conformity' | 'choice';

/** Um controle por tipo. O `never` garante que um tipo novo não passe sem decisão aqui. */
export function fieldKind(type: ItemType): FieldKind {
  switch (type) {
    case 'TEXT_SHORT':
      return 'text';
    case 'TEXT_LONG':
      return 'textarea';
    case 'NUMBER':
      return 'number';
    case 'DATE':
      return 'date';
    case 'BOOLEAN':
      return 'boolean';
    case 'CONFORMITY':
      return 'conformity';
    case 'SINGLE_CHOICE':
      return 'choice';
    default: {
      const unreachable: never = type;
      throw new Error(`Tipo de resposta sem componente: ${String(unreachable)}`);
    }
  }
}

export const CONFORMITY_CHOICES: { value: ConformityAnswer; label: string }[] = [
  { value: 'CONFORME', label: 'Conforme' },
  { value: 'NAO_CONFORME', label: 'Não conforme' },
  { value: 'NAO_APLICAVEL', label: 'Não aplicável' },
];

export const BOOLEAN_CHOICES: { value: string; label: string }[] = [
  { value: 'true', label: 'Sim' },
  { value: 'false', label: 'Não' },
];

/** Alternativas da seleção única, sem vazias (a validação do modelo cobra as repetidas). */
export function choiceOptions(item: ModelItem): string[] {
  return (item.options ?? []).map((o) => o.trim()).filter(Boolean);
}

/** O bloco de observação/evidência aparece quando um item de conformidade é respondido "não conforme". */
export function showsFailureDetails(item: ModelItem, answer: PreviewAnswer | undefined): boolean {
  return fieldKind(item.type) === 'conformity' && answer?.conformity === 'NAO_CONFORME';
}

/** O que o item exige quando não conforme (flags do #154). */
export function failureRequirements(item: ModelItem): { observation: boolean; evidence: boolean } {
  return { observation: item.observationRequiredOnFailure, evidence: item.evidenceRequiredOnFailure };
}
