import { http } from './http';
import { buildQueryString, listParams, type ListQuery, type Paged } from './paged-list';
import type { Cancellation, Inspection, InspectionStatus, NonConformityStatus, Priority } from '@/types';

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
 *   PATCH /inspections/{id}/cancel { reason, version } cancela com justificativa (RN-029/030).
 *   GET /inspections lista paginada para ADMIN/SUPERVISOR (status, período, técnico, cliente).
 * Não existe equipamento no agendamento da API.
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
  canceledBy?: string | null;
  canceledAt?: string | null;
  canceledReason?: string | null;
  version: number;
}

const STATUS_TO_API: Record<InspectionStatus, ApiInspectionStatus> = {
  RASCUNHO: 'DRAFT',
  ATRIBUIDA: 'ASSIGNED',
  EM_ANDAMENTO: 'IN_PROGRESS',
  ENVIADA: 'SUBMITTED',
  EM_REVISAO: 'UNDER_REVIEW',
  APROVADA: 'APPROVED',
  REPROVADA: 'REJECTED',
  CANCELADA: 'CANCELED',
  DEVOLVIDA: 'REJECTED',
};

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
    cancelamento: toCancellation(api),
    version: api.version,
  };
}

function toCancellation(api: ApiInspection): Cancellation | undefined {
  if (!api.canceledAt && !api.canceledReason) return undefined;
  return {
    porId: api.canceledBy ?? undefined,
    porNome: 'Supervisor',
    em: api.canceledAt ?? new Date().toISOString(),
    justificativa: api.canceledReason?.trim() ?? '',
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

/** O que a troca de técnico altera na inspeção da tela (o resto — respostas, modelo — é preservado). */
export type AssignmentUpdate = Pick<Inspection, 'tecnicoId' | 'status' | 'version'>;

export function toAssignmentUpdate(api: Pick<ApiInspection, 'technicianId' | 'status' | 'version'>): AssignmentUpdate {
  return { tecnicoId: api.technicianId, status: STATUS_FROM_API[api.status], version: api.version };
}

/** Troca o técnico (`PATCH /inspections/{id}/assignee`); só vale em inspeção atribuída ou em rascunho. */
export async function assignInspection(id: string, technicianId: string, version: number): Promise<AssignmentUpdate> {
  return toAssignmentUpdate(await http.patch<ApiInspection>(`/inspections/${id}/assignee`, { technicianId, version }));
}

/** Cancela na API (`PATCH /inspections/{id}/cancel`). Aprovada e já cancelada voltam 409. */
export async function cancelInspection(id: string, reason: string, version: number): Promise<Inspection> {
  const api = await http.patch<ApiInspection>(`/inspections/${id}/cancel`, { reason: reason.trim(), version });
  return toInspection(api, { modeloId: api.templateVersionId, modeloVersao: 0 });
}

export interface InspectionListFilters {
  status?: ApiInspectionStatus;
  technicianId?: string;
  clientId?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
}

/** Listagem administrativa paginada (`GET /inspections`). */
export async function listInspections(query: ListQuery<InspectionListFilters>): Promise<Paged<Inspection>> {
  const path = `/inspections${buildQueryString({
    ...listParams(query),
    status: query.filters.status,
    technicianId: query.filters.technicianId,
    clientId: query.filters.clientId,
    scheduledFrom: query.filters.scheduledFrom,
    scheduledTo: query.filters.scheduledTo,
  })}`;
  const page = await http.get<{ items: ApiInspection[]; page: Paged<Inspection>['page'] }>(path);
  return {
    items: page.items.map((item) => toInspection(item, { modeloId: item.templateVersionId, modeloVersao: 0 })),
    page: page.page,
  };
}

export function inspectionStatusToApi(status: InspectionStatus): ApiInspectionStatus | undefined {
  if (status === 'DEVOLVIDA') return undefined;
  return STATUS_TO_API[status];
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

export interface MonitoringEvidence {
  id: string;
  inspectionItemId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface MonitoringNonConformity {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  status: 'OPEN' | 'RESOLVED' | 'WAIVED';
  createdAt: string;
}

export interface InspectionMonitoring {
  inspectionId: string;
  evidences: MonitoringEvidence[];
  nonConformities: MonitoringNonConformity[];
}

export function fetchInspectionMonitoring(id: string): Promise<InspectionMonitoring> {
  return http.get<InspectionMonitoring>(`/inspections/${id}/monitoring`);
}

/** Conformidade da API de checklist (≠ store `CONFORME`). */
export type ApiChecklistConformity = 'CONFORMING' | 'NON_CONFORMING' | 'NOT_APPLICABLE';

export type ApiChecklistResponseType =
  | 'CONFORMITY'
  | 'BOOLEAN'
  | 'NUMBER'
  | 'DATE'
  | 'TEXT_SHORT'
  | 'TEXT_LONG'
  | 'SINGLE_CHOICE'
  | string;

export interface InspectionChecklistItem {
  id: string;
  title: string;
  description?: string | null;
  responseType: ApiChecklistResponseType;
  required: boolean;
  rulesJson?: string | null;
  optionsJson?: string | null;
  observation?: string | null;
  valueText?: string | null;
  valueNumber?: number | null;
  valueBoolean?: boolean | null;
  valueDate?: string | null;
  conformity?: ApiChecklistConformity | string | null;
}

export interface InspectionChecklistSection {
  title: string;
  order: number;
  items: InspectionChecklistItem[];
}

/** Checklist read-only do supervisor (`GET /inspections/{id}/checklist`). */
export function fetchInspectionChecklist(inspectionId: string): Promise<InspectionChecklistSection[]> {
  return http.get<InspectionChecklistSection[]>(`/inspections/${inspectionId}/checklist`);
}

/** Item da fila de revisão (`GET /inspections/review-queue`) — nomes alinhados ao OpenAPI. */
export interface ApiReviewQueueItem {
  id: string;
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
  technicianId: string;
  technicianName: string;
  title: string;
  priority: ApiPriority;
  submittedAt: string;
  scheduledFor: string;
}

export interface ReviewQueueItem {
  id: string;
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
  technicianId: string;
  technicianName: string;
  title: string;
  prioridade: Priority;
  submittedAt: string;
  scheduledFor: string;
}

export interface ReviewQueueListFilters {
  submittedFrom?: string;
  submittedTo?: string;
  technicianId?: string;
  clientId?: string;
}

export function toReviewQueueItem(api: ApiReviewQueueItem): ReviewQueueItem {
  return {
    id: api.id,
    clientId: api.clientId,
    clientName: api.clientName,
    siteId: api.siteId,
    siteName: api.siteName,
    technicianId: api.technicianId,
    technicianName: api.technicianName,
    title: api.title,
    prioridade: PRIORITY_FROM_API[api.priority],
    submittedAt: api.submittedAt,
    scheduledFor: api.scheduledFor,
  };
}

/** Fila dedicada de inspeções SUBMITTED (`GET /inspections/review-queue`). */
export async function listReviewQueue(query: ListQuery<ReviewQueueListFilters>): Promise<Paged<ReviewQueueItem>> {
  const path = `/inspections/review-queue${buildQueryString({
    ...listParams(query),
    submittedFrom: query.filters.submittedFrom,
    submittedTo: query.filters.submittedTo,
    technicianId: query.filters.technicianId,
    clientId: query.filters.clientId,
  })}`;
  const page = await http.get<{ items: ApiReviewQueueItem[]; page: Paged<ReviewQueueItem>['page'] }>(path);
  return {
    items: page.items.map(toReviewQueueItem),
    page: page.page,
  };
}
