import { http } from './http';
import { supportsFailureRules } from './item-rules';
import type { ItemType, ModelItem } from '@/types';

/**
 * Contrato real da API de itens do checklist (openapi/fieldops-v1.yaml +
 * TemplateItemController, ADMIN e SUPERVISOR). Itens sob a SEÇÃO:
 *   GET   /template-sections/{sectionId}/items           -> Item[]
 *   POST  /template-sections/{sectionId}/items           -> 201 Item
 *   PATCH /template-sections/{sectionId}/items/{itemId}  -> Item (parcial; PBI-0021)
 * Flags: required, observationRequiredOnFailure, evidenceRequiredOnFailure
 * (failure flags só persistem para CONFORMITY).
 */

interface ApiItem {
  id: string;
  sectionId: string;
  code?: string | null;
  title: string;
  description?: string | null;
  responseType: ItemType;
  required: boolean;
  observationRequiredOnFailure: boolean;
  evidenceRequiredOnFailure: boolean;
  displayOrder: number;
  /** Alternativas da seleção única, como texto JSON (`["Boa","Regular"]`). */
  optionsJson?: string | null;
}

function parseOptions(optionsJson: string | null | undefined): string[] | undefined {
  if (!optionsJson) return undefined;
  try {
    const parsed: unknown = JSON.parse(optionsJson);
    return Array.isArray(parsed) && parsed.every((o) => typeof o === 'string') ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function toItem(item: ApiItem): ModelItem {
  return {
    id: item.id,
    title: item.title,
    type: item.responseType,
    required: item.required,
    evidenceRequiredOnFailure: item.evidenceRequiredOnFailure,
    observationRequiredOnFailure: item.observationRequiredOnFailure,
    options: parseOptions(item.optionsJson),
  };
}

export async function listItems(sectionId: string): Promise<ModelItem[]> {
  return (await http.get<ApiItem[]>(`/template-sections/${sectionId}/items`)).map(toItem);
}

/**
 * Cria o item na seção. As flags "na falha" só vão ligadas para itens de
 * conformidade, e as alternativas só para seleção única (a API recusa o resto).
 */
export async function createItem(sectionId: string, item: ModelItem, displayOrder: number): Promise<ModelItem> {
  const failureRules = supportsFailureRules(item.type);
  return toItem(
    await http.post<ApiItem>(`/template-sections/${sectionId}/items`, {
      title: item.title,
      responseType: item.type,
      required: item.required,
      observationRequiredOnFailure: failureRules && item.observationRequiredOnFailure,
      evidenceRequiredOnFailure: failureRules && item.evidenceRequiredOnFailure,
      displayOrder,
      options: item.type === 'SINGLE_CHOICE' ? item.options : undefined,
    })
  );
}

/** Atualização parcial (PBI-0021). Campos omitidos mantêm o valor atual na API. */
export async function updateItem(
  sectionId: string,
  itemId: string,
  patch: Partial<Pick<ModelItem, 'title' | 'type' | 'required' | 'observationRequiredOnFailure' | 'evidenceRequiredOnFailure' | 'options'>>,
  displayOrder?: number
): Promise<ModelItem> {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.type !== undefined) body.responseType = patch.type;
  if (patch.required !== undefined) body.required = patch.required;
  if (patch.observationRequiredOnFailure !== undefined) {
    body.observationRequiredOnFailure = patch.observationRequiredOnFailure;
  }
  if (patch.evidenceRequiredOnFailure !== undefined) {
    body.evidenceRequiredOnFailure = patch.evidenceRequiredOnFailure;
  }
  if (patch.options !== undefined) body.options = patch.options;
  if (displayOrder !== undefined) body.displayOrder = displayOrder;

  // Se o tipo muda para fora de CONFORMITY, zera failure flags no payload.
  if (patch.type !== undefined && !supportsFailureRules(patch.type)) {
    body.observationRequiredOnFailure = false;
    body.evidenceRequiredOnFailure = false;
  }

  return toItem(await http.patch<ApiItem>(`/template-sections/${sectionId}/items/${itemId}`, body));
}
