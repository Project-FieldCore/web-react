import { http } from './http';
import type { Location } from '@/types';

/**
 * Contrato real da API (openapi/fieldops-v1.yaml + SiteController, ADMIN e SUPERVISOR).
 * O recurso se chama "site" no backend; na tela é "local" (Location).
 *   GET   /sites                         -> Site[]  (array simples, sem paginação)
 *   POST  /clients/{clientId}/sites      -> 201 Site { name, addressLine, ... }  (409 SITE_NAME_ALREADY_EXISTS)
 *   PATCH /sites/{id}                    -> Site    { name, addressLine, ..., version }  (409 VERSION_CONFLICT)
 *   PATCH /sites/{id}/status             -> Site    { status: ACTIVE | INACTIVE, version }
 * `version` é a trava otimista: precisa ser a do local que a tela carregou.
 * Todo local pertence a um cliente (RN-009) — por isso é criado sob /clients/{id}.
 */

type ApiSiteStatus = 'ACTIVE' | 'INACTIVE';

interface ApiSite {
  id: string;
  clientId: string;
  name: string;
  addressLine?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: ApiSiteStatus;
  version: number;
}

function toLocation(site: ApiSite): Location {
  return {
    id: site.id,
    clienteId: site.clientId,
    nome: site.name,
    endereco: site.addressLine ?? undefined,
    ativo: site.status === 'ACTIVE',
    lat: site.latitude ?? undefined,
    lng: site.longitude ?? undefined,
    version: site.version,
  };
}

export async function listLocations(): Promise<Location[]> {
  return (await http.get<ApiSite[]>('/sites')).map(toLocation);
}

export async function createLocation(clienteId: string, nome: string, endereco?: string): Promise<Location> {
  return toLocation(await http.post<ApiSite>(`/clients/${clienteId}/sites`, { name: nome, addressLine: endereco }));
}

export async function updateLocation(
  id: string,
  patch: Partial<Pick<Location, 'nome' | 'endereco'>>,
  version: number
): Promise<Location> {
  return toLocation(
    await http.patch<ApiSite>(`/sites/${id}`, { name: patch.nome, addressLine: patch.endereco, version })
  );
}

export async function setLocationActive(id: string, ativo: boolean, version: number): Promise<Location> {
  return toLocation(
    await http.patch<ApiSite>(`/sites/${id}/status`, { status: ativo ? 'ACTIVE' : 'INACTIVE', version })
  );
}
