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
  /** Problema do modelo em si (não de uma seção/item): qual campo ou área corrigir. */
  field?: 'title' | 'category' | 'sections';
}

/** Limites da API (título do modelo 160, categoria 100, título de seção 255, título de item 500). */
const MAX_TITLE = 160;
const MAX_CATEGORY = 100;
const MAX_SECTION_TITLE = 255;
const MAX_ITEM_TITLE = 500;

export function validateModel(model: Pick<InspectionModel, 'title' | 'category' | 'sections'>): ModelIssue[] {
  const issues: ModelIssue[] = [];
  type Ref = Pick<ModelIssue, 'sectionId' | 'itemId' | 'field'>;
  const error = (message: string, ref: Ref = {}) => issues.push({ severity: 'error', message, ...ref });
  const warning = (message: string, ref: Ref = {}) => issues.push({ severity: 'warning', message, ...ref });

  if (!model.title.trim()) error('Informe um título para o modelo.', { field: 'title' });
  else if (model.title.trim().length > MAX_TITLE) {
    error(`O título do modelo deve ter no máximo ${MAX_TITLE} caracteres.`, { field: 'title' });
  }
  if (!model.category.trim()) error('Informe a categoria do modelo.', { field: 'category' });
  else if (model.category.trim().length > MAX_CATEGORY) {
    error(`A categoria deve ter no máximo ${MAX_CATEGORY} caracteres.`, { field: 'category' });
  }

  const sections = normalizeSectionOrder(model.sections);
  if (sections.length === 0) {
    error('Adicione ao menos uma seção com itens (RN-015).', { field: 'sections' });
  } else if (!sections.some((s) => s.items.length > 0)) {
    error('Adicione ao menos um item válido antes de publicar (RN-015).', { field: 'sections' });
  }

  sections.forEach((section, sectionIndex) => {
    const sectionTitle = section.title.trim();
    const sectionName = sectionTitle ? `"${sectionTitle}"` : `${sectionIndex + 1}`;
    if (!sectionTitle) error(`A seção ${sectionIndex + 1} está sem título.`, { sectionId: section.id });
    else if (sectionTitle.length > MAX_SECTION_TITLE) {
      error(`O título da seção ${sectionName} deve ter no máximo ${MAX_SECTION_TITLE} caracteres.`, { sectionId: section.id });
    }
    if (section.items.length === 0) warning(`A seção ${sectionName} não tem itens.`, { sectionId: section.id });

    section.items.forEach((item, itemIndex) => {
      const ref = { sectionId: section.id, itemId: item.id };
      const itemTitle = item.title.trim();
      const itemName = itemTitle ? `"${itemTitle}"` : `${itemIndex + 1} da seção ${sectionName}`;

      if (!item.type) error('Todo item precisa de um tipo de resposta (RN-016).', ref);
      if (!itemTitle) error(`O item ${itemName} está sem título.`, ref);
      else if (itemTitle.length > MAX_ITEM_TITLE) {
        error(`O título do item ${itemName} deve ter no máximo ${MAX_ITEM_TITLE} caracteres.`, ref);
      }

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
