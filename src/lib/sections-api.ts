import { http } from './http';
import { toOrderPayload } from './section-order';
import type { ModelSection } from '@/types';

/**
 * Contrato real da API de seções do checklist (openapi/fieldops-v1.yaml +
 * TemplateSectionController, ADMIN e SUPERVISOR) — hoje só na branch
 * `feature/checklist-section-ordering` do backend. As seções ficam sob a
 * VERSÃO do modelo, não sob o modelo:
 *   GET   /template-versions/{versionId}/sections        -> Section[] (ordenado por displayOrder)
 *   POST  /template-versions/{versionId}/sections        -> 201 Section { title, description?, displayOrder }
 *                                                           (409 SECTION_ORDER_ALREADY_EXISTS)
 *   PATCH /template-versions/{versionId}/sections/order  -> Section[] { sections: [{ sectionId, displayOrder }] }
 *                                                           lista COMPLETA, ids e ordens únicos (400 INVALID_SECTION_ORDER)
 * Só em modelo em rascunho (409 TEMPLATE_NOT_EDITABLE).
 *
 * PENDENTE NO BACKEND: nenhum endpoint cria ou expõe o `versionId` de um
 * rascunho (POST /inspection-templates não cria a versão). Enquanto isso o
 * construtor ordena as seções só na tela, e este módulo ainda não é chamado.
 * Não há endpoint para editar o título nem remover uma seção.
 */

interface ApiSection {
  id: string;
  templateVersionId: string;
  title: string;
  description?: string | null;
  displayOrder: number;
}

/** Itens do checklist ainda não vêm dessa API: a seção chega sem itens. */
function toSection(section: ApiSection): ModelSection {
  return {
    id: section.id,
    title: section.title,
    description: section.description ?? undefined,
    displayOrder: section.displayOrder,
    items: [],
  };
}

export async function listSections(versionId: string): Promise<ModelSection[]> {
  return (await http.get<ApiSection[]>(`/template-versions/${versionId}/sections`)).map(toSection);
}

export async function createSection(
  versionId: string,
  input: { title: string; description?: string; displayOrder: number }
): Promise<ModelSection> {
  return toSection(
    await http.post<ApiSection>(`/template-versions/${versionId}/sections`, {
      title: input.title,
      description: input.description || undefined,
      displayOrder: input.displayOrder,
    })
  );
}

/** Reordena: envia a lista completa com as ordens novas (a API exige ids e ordens únicos). */
export async function reorderSections(versionId: string, sections: ModelSection[]): Promise<ModelSection[]> {
  return (
    await http.patch<ApiSection[]>(`/template-versions/${versionId}/sections/order`, {
      sections: toOrderPayload(sections),
    })
  ).map(toSection);
}
