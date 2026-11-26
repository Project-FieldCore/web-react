import { http } from './http';
import { buildQueryString, listParams, type ListQuery, type Paged } from './paged-list';

export interface AuditLog {
  id: string;
  actorId: string | null;
  actorName: string | null;
  entityType: string;
  entityId: string;
  action: string;
  payload: string | null;
  createdAt: string;
}

export interface AuditFilters {
  entityType: string;
  action: string;
  from: string;
  to: string;
}

export function listAuditLogs(query: ListQuery<AuditFilters>): Promise<Paged<AuditLog>> {
  return http.get(`/audit-events${buildQueryString({
    ...listParams(query),
    entityType: query.filters.entityType || undefined,
    action: query.filters.action || undefined,
    from: query.filters.from ? new Date(query.filters.from).toISOString() : undefined,
    to: query.filters.to ? new Date(query.filters.to).toISOString() : undefined,
  })}`);
}
