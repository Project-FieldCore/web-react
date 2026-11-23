import { ApiError, http } from './http';
import { buildQueryString, type ListQuery } from './paged-list';
import { describeLoadError, type LoadErrorCopy } from './state-copy';
import { usersFilterParams } from './users-api';
import { clientsFilterParams } from './clients-api';
import { equipmentFilterParams } from './equipment-api';
import { inspectionsFilterParams } from './inspections-api';

/**
 * Exportação CSV das listagens administrativas (`GET /{recurso}/export.csv`).
 * A API aceita os mesmos busca/filtros/ordenação da listagem — a tela exporta exatamente o que está filtrado.
 * O nome do arquivo vem em Content-Disposition, que a web não lê do Blob: por isso os nomes são fixos aqui.
 */
type ExportQuery<F> = Pick<ListQuery<F>, 'sort' | 'q' | 'filters'>;

export const CSV_FILE_NAMES = {
  users: 'users.csv',
  clients: 'clients.csv',
  equipment: 'equipment.csv',
  inspections: 'inspections.csv',
} as const;

/** A API corta a exportação de inspeções em 10.000 linhas. */
export const INSPECTIONS_EXPORT_LIMIT = 10000;

export function exportUsersCsv(query: ExportQuery<Parameters<typeof usersFilterParams>[0]['filters']>): Promise<Blob> {
  return http.getBlob(`/users/export.csv${buildQueryString(usersFilterParams(query))}`);
}

export function exportClientsCsv(query: ExportQuery<Parameters<typeof clientsFilterParams>[0]['filters']>): Promise<Blob> {
  return http.getBlob(`/clients/export.csv${buildQueryString(clientsFilterParams(query))}`);
}

export function exportEquipmentCsv(query: ExportQuery<Parameters<typeof equipmentFilterParams>[0]['filters']>): Promise<Blob> {
  return http.getBlob(`/equipment/export.csv${buildQueryString(equipmentFilterParams(query))}`);
}

export function exportInspectionsCsv(query: ExportQuery<Parameters<typeof inspectionsFilterParams>[0]['filters']>): Promise<Blob> {
  return http.getBlob(`/inspections/export.csv${buildQueryString(inspectionsFilterParams(query))}`);
}

export const CSV_FORBIDDEN_MESSAGE = 'Seu perfil não pode exportar esta listagem.';

/** Mensagem de erro da exportação (ErrorResponse padronizado). */
export function describeCsvError(error: unknown): LoadErrorCopy {
  if (error instanceof ApiError && error.status === 403) {
    return { title: 'Acesso não autorizado', message: CSV_FORBIDDEN_MESSAGE, retry: false, status: 403, code: error.code };
  }
  return describeLoadError(error, 'Não foi possível exportar o CSV. Tente novamente.');
}
