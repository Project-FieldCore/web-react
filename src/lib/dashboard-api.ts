import { http } from './http';
import type { Criticidade, InspectionStatus } from '@/types';

/** Resposta de `GET /dashboard/indicators` (DashboardIndicators). Todas as chaves vêm, inclusive as zeradas. */
export interface ApiDashboardIndicators {
  generatedAt: string;
  inspectionsByStatus: Record<string, number>;
  openNonConformitiesBySeverity: Record<string, number>;
}

export interface DashboardIndicators {
  generatedAt: string;
  /** "Devolvida" não existe na API: fica ausente (não é exibida como 0 enganoso). */
  inspectionsByStatus: Partial<Record<InspectionStatus, number>>;
  /** Somente não conformidades abertas (OPEN). */
  openNonConformitiesBySeverity: Record<Criticidade, number>;
  totalInspections: number;
  totalOpenNonConformities: number;
}

const STATUS_FROM_API: Record<string, InspectionStatus> = {
  DRAFT: 'RASCUNHO',
  ASSIGNED: 'ATRIBUIDA',
  IN_PROGRESS: 'EM_ANDAMENTO',
  SUBMITTED: 'ENVIADA',
  UNDER_REVIEW: 'EM_REVISAO',
  APPROVED: 'APROVADA',
  REJECTED: 'REPROVADA',
  CANCELED: 'CANCELADA',
};

const SEVERITY_FROM_API: Record<string, Criticidade> = {
  LOW: 'BAIXA',
  MEDIUM: 'MEDIA',
  HIGH: 'ALTA',
  CRITICAL: 'CRITICA',
};

/** Converte a resposta da API para os nomes da tela; chaves desconhecidas são ignoradas. */
export function toDashboardIndicators(api: ApiDashboardIndicators): DashboardIndicators {
  const inspectionsByStatus: Partial<Record<InspectionStatus, number>> = {};
  for (const [key, value] of Object.entries(api.inspectionsByStatus ?? {})) {
    const status = STATUS_FROM_API[key];
    if (status) inspectionsByStatus[status] = value;
  }
  const openNonConformitiesBySeverity: Record<Criticidade, number> = { BAIXA: 0, MEDIA: 0, ALTA: 0, CRITICA: 0 };
  for (const [key, value] of Object.entries(api.openNonConformitiesBySeverity ?? {})) {
    const severity = SEVERITY_FROM_API[key];
    if (severity) openNonConformitiesBySeverity[severity] = value;
  }
  return {
    generatedAt: api.generatedAt,
    inspectionsByStatus,
    openNonConformitiesBySeverity,
    totalInspections: Object.values(inspectionsByStatus).reduce((sum, n) => sum + (n ?? 0), 0),
    totalOpenNonConformities: Object.values(openNonConformitiesBySeverity).reduce((sum, n) => sum + n, 0),
  };
}

/** Indicadores agregados por estado e criticidade (somente ADMIN/SUPERVISOR). */
export async function fetchDashboardIndicators(): Promise<DashboardIndicators> {
  return toDashboardIndicators(await http.get<ApiDashboardIndicators>('/dashboard/indicators'));
}
