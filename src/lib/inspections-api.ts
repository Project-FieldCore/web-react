import { http } from './http';
import type { Inspection, NonConformityStatus, Priority } from '@/types';

/**
 * Contrato assumido para a API (#135) — o OpenAPI do fieldcore_backend só
 * declara GET /api/v1/inspections (sem schema). Os demais paths/verbos abaixo
 * seguem convenção REST e precisam ser confirmados com o time de backend.
 */
export interface ScheduleInspectionInput {
  modeloId: string;
  clienteId: string;
  localId: string;
  equipamentoId?: string;
  tecnicoId: string;
  prioridade: Priority;
  dataPrevista: string;
  orientacoes?: string;
}

export function scheduleInspection(input: ScheduleInspectionInput): Promise<Inspection> {
  return http.post<Inspection>('/inspections', input);
}

export function startReview(id: string): Promise<Inspection> {
  return http.post<Inspection>(`/inspections/${id}/review/start`);
}

export function approveInspection(id: string, comentario?: string): Promise<Inspection> {
  return http.post<Inspection>(`/inspections/${id}/review/approve`, { comentario });
}

export function rejectInspection(id: string, motivo: string): Promise<Inspection> {
  return http.post<Inspection>(`/inspections/${id}/review/reject`, { motivo });
}

export function returnForCorrection(id: string, comentario: string): Promise<Inspection> {
  return http.post<Inspection>(`/inspections/${id}/review/return`, { comentario });
}

export function setNonConformityStatus(id: string, itemId: string, status: NonConformityStatus): Promise<Inspection> {
  return http.patch<Inspection>(`/inspections/${id}/non-conformities/${itemId}`, { status });
}

/** Execução: envia o que foi preenchido no checklist (respostas, NCs, geolocalização, QR). */
export function syncResponses(
  inspection: Pick<Inspection, 'id' | 'answers' | 'nonConformities' | 'geolocalizacao' | 'qrConfirmadoEm'>
): Promise<Inspection> {
  const { id, answers, nonConformities, geolocalizacao, qrConfirmadoEm } = inspection;
  return http.put<Inspection>(`/inspections/${id}/responses`, { answers, nonConformities, geolocalizacao, qrConfirmadoEm });
}

export function submitInspection(id: string): Promise<Inspection> {
  return http.post<Inspection>(`/inspections/${id}/submit`);
}
