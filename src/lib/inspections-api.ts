import { http } from './http';
import type { Inspection, InspectionStatus, NonConformityStatus, Priority } from '@/types';

/**
 * Agendamento — contrato REAL (openapi/fieldops-v1.yaml + InspectionController,
 * ADMIN e SUPERVISOR; hoje só nas branches `feature/schedule-published-inspections`
 * e `feature/assign-active-technicians` do backend):
 *   POST /inspections -> 201 Inspection
 *     { templateVersionId, clientId, siteId, technicianId, scheduledFor (futura),
 *       title?, instructions? (até 2000), priority? LOW|MEDIUM|HIGH|CRITICAL }
 *   Nasce ATRIBUÍDA (ASSIGNED). Erros: 409 TEMPLATE_VERSION_NOT_PUBLISHED, 409 SITE_CLIENT_MISMATCH,
 *   404 CLIENT_NOT_FOUND / SITE_NOT_FOUND / TECHNICIAN_NOT_FOUND, 409 TECHNICIAN_ROLE_INVALID /
 *   TECHNICIAN_NOT_ACTIVE, 400 (data não futura, tamanhos).
 *   PATCH /inspections/{id}/assignee { technicianId, version } troca o técnico.
 * Não existe equipamento no agendamento da API, nem listagem de inspeções para o supervisor.
 *
 * As demais funções abaixo (revisão, não conformidades, respostas, envio) seguem num
 * contrato assumido (#135) — o OpenAPI não as declara — e precisam de confirmação do backend.
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

type ApiPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type ApiInspectionStatus =
  | 'DRAFT'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELED';

const PRIORITY_TO_API: Record<Priority, ApiPriority> = { ALTA: 'HIGH', MEDIA: 'MEDIUM', BAIXA: 'LOW' };
// A tela só tem três níveis: CRITICAL aparece como Alta.
const PRIORITY_FROM_API: Record<ApiPriority, Priority> = { LOW: 'BAIXA', MEDIUM: 'MEDIA', HIGH: 'ALTA', CRITICAL: 'ALTA' };
// "Devolvida" (para correção) não existe como status na API.
const STATUS_FROM_API: Record<ApiInspectionStatus, InspectionStatus> = {
  DRAFT: 'RASCUNHO',
  ASSIGNED: 'ATRIBUIDA',
  IN_PROGRESS: 'EM_ANDAMENTO',
  SUBMITTED: 'ENVIADA',
  UNDER_REVIEW: 'EM_REVISAO',
  APPROVED: 'APROVADA',
  REJECTED: 'REPROVADA',
  CANCELED: 'CANCELADA',
};

export interface ApiInspection {
  id: string;
  clientId: string;
  siteId: string;
  templateVersionId: string;
  technicianId: string;
  supervisorId?: string | null;
  title: string;
  instructions?: string | null;
  priority: ApiPriority;
  status: ApiInspectionStatus;
  scheduledFor: string;
  version: number;
}

/** Corpo do `POST /inspections`. O título fica de fora: a API usa o do modelo. */
export function toScheduleBody(input: ScheduleInspectionInput, templateVersionId: string) {
  return {
    templateVersionId,
    clientId: input.clienteId,
    siteId: input.localId,
    technicianId: input.tecnicoId,
    scheduledFor: input.dataPrevista,
    instructions: input.orientacoes?.trim() || undefined,
    priority: PRIORITY_TO_API[input.prioridade],
  };
}

/**
 * Resposta da API -> inspeção da tela. A API devolve só o id da versão, então o
 * modelo e a versão vêm do que foi escolhido; o checklist começa sem respostas.
 * O equipamento não é enviado (a API não o recebe), mas fica na inspeção da tela.
 */
export function toInspection(
  api: ApiInspection,
  context: { modeloId: string; modeloVersao: number; equipamentoId?: string }
): Inspection {
  return {
    id: api.id,
    clienteId: api.clientId,
    localId: api.siteId,
    equipamentoId: context.equipamentoId,
    modeloId: context.modeloId,
    modeloVersao: context.modeloVersao,
    tecnicoId: api.technicianId,
    prioridade: PRIORITY_FROM_API[api.priority],
    dataPrevista: api.scheduledFor,
    orientacoes: api.instructions ?? undefined,
    status: STATUS_FROM_API[api.status],
    answers: {},
    nonConformities: {},
  };
}

/** Agenda na API: `templateVersionId` é o id da VERSÃO publicada, não do modelo. */
export async function scheduleInspection(
  input: ScheduleInspectionInput,
  templateVersionId: string,
  modeloVersao: number
): Promise<Inspection> {
  const api = await http.post<ApiInspection>('/inspections', toScheduleBody(input, templateVersionId));
  return toInspection(api, { modeloId: input.modeloId, modeloVersao, equipamentoId: input.equipamentoId });
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
