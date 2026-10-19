import { http } from './http';
import type { InspectionModel } from '@/types';

/**
 * Contrato assumido para a API (#134) — o OpenAPI do fieldcore_backend ainda
 * não declara nenhuma rota de modelo de inspeção. Ajustar path/campos quando
 * o contrato real existir. O construtor edita o rascunho localmente (estado
 * do Zustand) e só envia o modelo inteiro ao salvar/publicar.
 */
export function createModel(draft: Pick<InspectionModel, 'title' | 'description' | 'category'>): Promise<InspectionModel> {
  return http.post<InspectionModel>('/models', draft);
}

export function saveModel(model: InspectionModel): Promise<InspectionModel> {
  return http.put<InspectionModel>(`/models/${model.id}`, model);
}

/** RN-020: publicar um modelo já publicado gera nova versão — quem incrementa é a API. */
export function publishModel(id: string): Promise<InspectionModel> {
  return http.post<InspectionModel>(`/models/${id}/publish`);
}
