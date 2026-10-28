import { http } from './http';
import { supportsFailureRules } from './item-rules';
import type { ItemType, ModelItem } from '@/types';

/**
 * Contrato real da API de itens do checklist (openapi/fieldops-v1.yaml +
 * TemplateItemController, ADMIN e SUPERVISOR) — hoje só na branch
 * `feature/template-response-items` do backend. Os itens ficam sob a SEÇÃO:
 *   GET  /template-sections/{sectionId}/items  -> Item[] (ordenado por displayOrder)
 *   POST /template-sections/{sectionId}/items  -> 201 Item
 *        { code?, title, description?, responseType, required, observationRequiredOnFailure,
 *          evidenceRequiredOnFailure, displayOrder, options? }
 *   Erros: 400 INVALID_RESPONSE_OPTIONS, 409 ITEM_ORDER_ALREADY_EXISTS,
 *          409 TEMPLATE_NOT_EDITABLE, 404 TEMPLATE_SECTION_NOT_FOUND.
 * Flags (PBI-0021.1): required, observation_required_on_failure, evidence_required_on_failure.
 *
 * PENDENTE NO BACKEND: (1) nenhum endpoint cria ou expõe a versão de um
 * rascunho, então a tela não chega a um id de seção; (2) não existe editar
 * nem remover item — as flags só podem ser definidas na criação. Enquanto
 * isso o construtor edita os itens só na tela e este módulo ainda não é chamado.
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
