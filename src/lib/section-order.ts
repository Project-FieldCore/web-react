import type { ModelSection } from '@/types';

/**
 * Ordem das seções do checklist (RN-017; doc. 10.15: a ordem é única dentro
 * da versão). Convenção: a ordem é sempre 0, 1, 2… contígua e sem repetição,
 * e o array de seções já está na ordem de exibição. A API exige o mesmo
 * (índice único por versão; reordenar manda a lista completa com ordens únicas).
 * Lógica pura, sem React, para ser testável.
 */

export type MoveDirection = 'up' | 'down';

/** Ordena por `displayOrder` (estável) e renumera 0..n-1 — corrige lacunas e repetições. */
export function normalizeSectionOrder(sections: ModelSection[]): ModelSection[] {
  return [...sections]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((section, index) => (section.displayOrder === index ? section : { ...section, displayOrder: index }));
}

/** Ordem da próxima seção a ser adicionada (no fim da lista). */
export function nextDisplayOrder(sections: ModelSection[]): number {
  return sections.length === 0 ? 0 : Math.max(...sections.map((s) => s.displayOrder)) + 1;
}

/**
 * Troca a seção com a vizinha (acima ou abaixo) e renumera. Na primeira
 * (subir) ou na última (descer), ou com id desconhecido, devolve a MESMA lista.
 */
export function moveSection(sections: ModelSection[], sectionId: string, direction: MoveDirection): ModelSection[] {
  const ordered = normalizeSectionOrder(sections);
  const index = ordered.findIndex((s) => s.id === sectionId);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ordered.length) return sections;
  const next = [...ordered];
  [next[index], next[target]] = [next[target], next[index]];
  return next.map((section, i) => ({ ...section, displayOrder: i }));
}

/** A ordem de cada seção é única (o que a API exige por versão). */
export function hasUniqueOrder(sections: ModelSection[]): boolean {
  return new Set(sections.map((s) => s.displayOrder)).size === sections.length;
}

/** Corpo de `PATCH /template-versions/{id}/sections/order`: lista completa com ordens únicas. */
export function toOrderPayload(sections: ModelSection[]): { sectionId: string; displayOrder: number }[] {
  return normalizeSectionOrder(sections).map((s) => ({ sectionId: s.id, displayOrder: s.displayOrder }));
}
