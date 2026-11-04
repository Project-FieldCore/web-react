import { http } from './http';
import { toOrderPayload } from './section-order';
import type { ModelSection } from '@/types';

/**
 * Contrato real da API de seções (openapi/fieldops-v1.yaml + TemplateSectionController):
 *   GET   /template-versions/{versionId}/sections        -> Section[]
 *   POST  /template-versions/{versionId}/sections        -> 201 Section
 *   PATCH /template-versions/{versionId}/sections/order  -> Section[]
 * `versionId` = `draftVersionId` do InspectionTemplate (DRAFT).
 * Itens vêm de `items-api` por sectionId — a seção chega sem itens.
 */

interface ApiSection {
  id: string;
  templateVersionId: string;
  title: string;
  description?: string | null;
  displayOrder: number;
}

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
