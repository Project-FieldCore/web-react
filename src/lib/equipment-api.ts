import { http } from './http';
import { buildQueryString, fetchAllPages, listParams, type ListQuery, type Paged } from './paged-list';
import type { Equipment } from '@/types';

/**
 * Contrato real da API (openapi/fieldops-v1.yaml + EquipmentController, ADMIN e SUPERVISOR):
 *   GET   /equipment?page&size&sort&q&status&siteId -> { items, page }
 *   GET   /sites/{siteId}/equipment               -> Equipment[]
 *   POST  /sites/{siteId}/equipment               -> 201 Equipment  (409 QR_CODE_ALREADY_EXISTS)
 *   PATCH /equipment/{id}                         -> Equipment { name, assetNumber, …, version }
 *   PATCH /equipment/{id}/status                  -> Equipment { status, version }
 *   PATCH /equipment/{id}/qr-code                 -> Equipment { qrCode, version }  (409 UNIQUE)
 *   GET   /equipment/by-qr/{qrCode}               -> Equipment
 * Na tela: `tipo` ↔ `assetNumber`, `localId` ↔ `siteId`, `ativo` ↔ `status === 'ACTIVE'`.
 */

type ApiStatus = 'ACTIVE' | 'INACTIVE' | 'DECOMMISSIONED';

interface ApiEquipment {
  id: string;
  siteId: string;
  name: string;
  qrCode: string;
  assetNumber?: string | null;
  status: ApiStatus;
  version: number;
}

interface ApiEquipmentPage {
  items: ApiEquipment[];
  page: { page: number; size: number; totalElements: number; totalPages: number };
}

function toEquipment(equipment: ApiEquipment): Equipment {
  return {
    id: equipment.id,
    localId: equipment.siteId,
    nome: equipment.name,
    tipo: equipment.assetNumber ?? undefined,
    qrCode: equipment.qrCode,
    ativo: equipment.status === 'ACTIVE',
    version: equipment.version,
  };
}

/** Filtros explícitos da listagem (undefined = sem filtro). */
export interface EquipmentFilters {
  ativo?: boolean;
  localId?: string;
}

/** Uma página da listagem global, com busca, filtros e ordenação na API. */
export async function searchEquipment(query: ListQuery<EquipmentFilters>): Promise<Paged<Equipment>> {
  const { ativo, localId } = query.filters;
  const response = await http.get<ApiEquipmentPage>(
    `/equipment${buildQueryString({
      ...listParams(query),
      status: ativo === undefined ? undefined : ativo ? 'ACTIVE' : 'INACTIVE',
      siteId: localId,
    })}`
  );
  return { items: response.items.map(toEquipment), page: response.page };
}

/** Todos os equipamentos (todas as páginas) — para contagens e `version` no store. */
export async function listEquipment(): Promise<Equipment[]> {
  return fetchAllPages(async (page, size) => {
    const response = await http.get<ApiEquipmentPage>(`/equipment${buildQueryString({ page, size })}`);
    return { items: response.items.map(toEquipment), page: response.page };
  });
}

/** Equipamentos de um local (array simples, sem paginação). */
export async function listEquipmentBySite(siteId: string): Promise<Equipment[]> {
  return (await http.get<ApiEquipment[]>(`/sites/${siteId}/equipment`)).map(toEquipment);
}

export async function createEquipment(
  siteId: string,
  nome: string,
  qrCode: string,
  tipo?: string
): Promise<Equipment> {
  return toEquipment(
    await http.post<ApiEquipment>(`/sites/${siteId}/equipment`, {
      name: nome,
      qrCode,
      assetNumber: tipo || undefined,
    })
  );
}

export async function updateEquipment(
  id: string,
  patch: Partial<Pick<Equipment, 'nome' | 'tipo'>>,
  version: number
): Promise<Equipment> {
  return toEquipment(
    await http.patch<ApiEquipment>(`/equipment/${id}`, {
      name: patch.nome,
      assetNumber: patch.tipo,
      version,
    })
  );
}

export async function setEquipmentActive(id: string, ativo: boolean, version: number): Promise<Equipment> {
  return toEquipment(
    await http.patch<ApiEquipment>(`/equipment/${id}/status`, {
      status: ativo ? 'ACTIVE' : 'INACTIVE',
      version,
    })
  );
}

/** Atribui/troca o QR (endpoint dedicado; 409 QR_CODE_ALREADY_EXISTS). */
export async function assignEquipmentQrCode(id: string, qrCode: string, version: number): Promise<Equipment> {
  return toEquipment(
    await http.patch<ApiEquipment>(`/equipment/${id}/qr-code`, { qrCode, version })
  );
}

export async function getEquipmentByQrCode(qrCode: string): Promise<Equipment> {
  return toEquipment(await http.get<ApiEquipment>(`/equipment/by-qr/${encodeURIComponent(qrCode)}`));
}
