import { http } from './http';
import type { InspectionModel, ModelStatus } from '@/types';

/**
 * Contrato real da API para o rascunho (openapi/fieldops-v1.yaml + InspectionTemplateController,
 * ADMIN e SUPERVISOR). "Modelo de inspeção" na tela é "inspection template" na API:
 *   POST  /inspection-templates        -> 201 { title, category, description? }  sempre DRAFT
 *                                         (409 TEMPLATE_TITLE_ALREADY_EXISTS — o título é único)
 *   GET   /inspection-templates/{id}   -> template        (404 INSPECTION_TEMPLATE_NOT_FOUND)
 *   PATCH /inspection-templates/{id}   -> template  { title, description, category, version }
 *                                         só em DRAFT (409 TEMPLATE_NOT_EDITABLE) e com a versão
 *                                         de edição certa (409 VERSION_CONFLICT)
 * Ainda NÃO existe na API: listar modelos, seções/itens, salvar o modelo inteiro e publicar
 * (saveModel/publishModel abaixo seguem num contrato assumido, até esses cards).
 */

type ApiTemplateStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

interface ApiTemplate {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  status: ApiTemplateStatus;
  /** Versão publicada (nula enquanto é rascunho). */
  currentVersion?: number | null;
  updatedAt: string;
  /** Versão de edição (trava otimista). */
  version: number;
}

const STATUS_FROM_API: Record<ApiTemplateStatus, ModelStatus> = {
  DRAFT: 'RASCUNHO',
  ACTIVE: 'PUBLICADO',
  INACTIVE: 'ARQUIVADO',
};

/** `version` da tela é a versão publicada; a `version` da API vira `lockVersion`. Seções ainda não vêm da API. */
function toModel(template: ApiTemplate): InspectionModel {
  return {
    id: template.id,
    title: template.title,
    description: template.description ?? '',
    category: template.category,
    status: STATUS_FROM_API[template.status],
    version: template.currentVersion ?? 0,
    lockVersion: template.version,
    sections: [],
    updatedAt: template.updatedAt,
  };
}

export interface NewModelInput {
  title: string;
  category: string;
  description?: string;
}

export async function createModel(input: NewModelInput): Promise<InspectionModel> {
  return toModel(
    await http.post<ApiTemplate>('/inspection-templates', {
      title: input.title,
      category: input.category,
      description: input.description || undefined,
    })
  );
}

export async function getModel(id: string): Promise<InspectionModel> {
  return toModel(await http.get<ApiTemplate>(`/inspection-templates/${id}`));
}

/** Edita título, categoria e/ou descrição do rascunho. `lockVersion` é a versão de edição carregada. */
export async function updateModelMeta(
  id: string,
  patch: Partial<Pick<InspectionModel, 'title' | 'description' | 'category'>>,
  lockVersion: number
): Promise<InspectionModel> {
  return toModel(
    await http.patch<ApiTemplate>(`/inspection-templates/${id}`, {
      title: patch.title,
      description: patch.description,
      category: patch.category,
      version: lockVersion,
    })
  );
}

/** Contrato assumido (não existe na API ainda): o construtor envia o modelo inteiro ao salvar. */
export function saveModel(model: InspectionModel): Promise<InspectionModel> {
  return http.put<InspectionModel>(`/models/${model.id}`, model);
}

/** Contrato assumido (não existe na API ainda). RN-020: publicar de novo gera nova versão — quem incrementa é a API. */
export function publishModel(id: string): Promise<InspectionModel> {
  return http.post<InspectionModel>(`/models/${id}/publish`);
}
