import { http } from './http';
import { buildQueryString, type Paged } from './paged-list';

export interface ServerNonConformity { id: string; inspectionId: string; itemTitle: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; description: string; status: 'OPEN' | 'RESOLVED' | 'WAIVED'; clientName: string; siteName: string; createdAt: string; }
export async function listNonConformities(page: number, size: number, severity: string, status: string): Promise<Paged<ServerNonConformity>> {
  return http.get(`/inspections/non-conformities${buildQueryString({ page, size, severity: severity || undefined, status: status || undefined })}`);
}
