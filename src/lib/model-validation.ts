import { normalizeSectionOrder } from './section-order';
import type { InspectionModel } from '@/types';

/**
 * Validação do modelo antes de publicar (RN-015/016 e o que a API exige:
 * título de seção e de item não vazios; seleção única com alternativas únicas).
 * Usada pela prévia, pelo botão Publicar e por `publishModel`, para as três
 * concordarem. Lógica pura, sem React, para ser testável.
 *
 * - `error`: impede publicar.
 * - `warning`: vale a pena corrigir, mas não impede (ex.: seção sem itens).
 */

export type IssueSeverity = 'error' | 'warning';

export interface ModelIssue {
  severity: IssueSeverity;
  message: string;
  sectionId?: string;
  itemId?: string;
}

export function validateModel(model: Pick<InspectionModel, 'title' | 'sections'>): ModelIssue[] {
  const issues: ModelIssue[] = [];
  const error = (message: string, ref: Pick<ModelIssue, 'sectionId' | 'itemId'> = {}) =>
    issues.push({ severity: 'error', message, ...ref });
  const warning = (message: string, ref: Pick<ModelIssue, 'sectionId' | 'itemId'> = {}) =>
    issues.push({ severity: 'warning', message, ...ref });

  if (!model.title.trim()) error('Informe um título para o modelo.');

  const sections = normalizeSectionOrder(model.sections);
  if (sections.length === 0) {
    error('Adicione ao menos uma seção com itens (RN-015).');
  } else if (!sections.some((s) => s.items.length > 0)) {
    error('Adicione ao menos um item válido antes de publicar (RN-015).');
  }

  sections.forEach((section, sectionIndex) => {
    const sectionTitle = section.title.trim();
    const sectionName = sectionTitle ? `"${sectionTitle}"` : `${sectionIndex + 1}`;
    if (!sectionTitle) error(`A seção ${sectionIndex + 1} está sem título.`, { sectionId: section.id });
    if (section.items.length === 0) warning(`A seção ${sectionName} não tem itens.`, { sectionId: section.id });

    section.items.forEach((item, itemIndex) => {
      const ref = { sectionId: section.id, itemId: item.id };
      const itemTitle = item.title.trim();
      const itemName = itemTitle ? `"${itemTitle}"` : `${itemIndex + 1} da seção ${sectionName}`;

      if (!item.type) error('Todo item precisa de um tipo de resposta (RN-016).', ref);
      if (!itemTitle) error(`O item ${itemName} está sem título.`, ref);

      if (item.type === 'SINGLE_CHOICE') {
        const options = (item.options ?? []).map((o) => o.trim()).filter(Boolean);
        if (options.length === 0) {
          error(`O item ${itemName} é de seleção única e precisa de alternativas.`, ref);
        } else if (new Set(options).size !== options.length) {
          error(`O item ${itemName} tem alternativas repetidas.`, ref);
        } else if (options.length === 1) {
          warning(`O item ${itemName} tem uma única alternativa.`, ref);
        }
      }
    });
  });

  return issues;
}

export function blockingIssues(issues: ModelIssue[]): ModelIssue[] {
  return issues.filter((i) => i.severity === 'error');
}
