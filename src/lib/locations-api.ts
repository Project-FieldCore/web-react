import { http } from './http';
import { buildQueryString, fetchAllPages, listParams, type ListQuery, type Paged, type PageMeta } from './paged-list';
import type { Location } from '@/types';

/**
 * Contrato real da API (openapi/fieldops-v1.yaml + SiteController, ADMIN e SUPERVISOR).
 * O recurso se chama "site" no backend; na tela é "local" (Location).
 *   GET   /sites?page&size&sort&q&status&clientId -> { items: Site[], page }  (paginado)
 *         sort: name | city | createdAt; q busca nome, cidade e estado
 *         (versões antigas da API devolviam um array simples — ainda aceito)
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

interface ApiSitePage {
  items: ApiSite[];
  page: PageMeta;
}

/** Filtros explícitos da listagem de locais (undefined = sem filtro). */
export interface LocationFilters {
  ativo?: boolean;
  clienteId?: string;
}

function toStatusParam(ativo: boolean | undefined) {
  return ativo === undefined ? undefined : ativo ? 'ACTIVE' : 'INACTIVE';
}

/** Compatível com a API antiga (array) e com a paginada (`{ items, page }`). */
function toPaged(response: ApiSite[] | ApiSitePage, requested: { page: number; size: number }): Paged<Location> {
  if (Array.isArray(response)) {
    const start = requested.page * requested.size;
    return {
      items: response.slice(start, start + requested.size).map(toLocation),
      page: {
        page: requested.page,
        size: requested.size,
        totalElements: response.length,
        totalPages: Math.ceil(response.length / requested.size),
      },
    };
  }
  return { items: response.items.map(toLocation), page: response.page };
}

/** Uma página da listagem, com busca, filtros e ordenação feitos na API. */
export async function searchLocations(query: ListQuery<LocationFilters>): Promise<Paged<Location>> {
  const response = await http.get<ApiSite[] | ApiSitePage>(
    `/sites${buildQueryString({
      ...listParams(query),
      status: toStatusParam(query.filters.ativo),
      clientId: query.filters.clienteId,
    })}`
  );
  return toPaged(response, query);
}

/** Todos os locais (todas as páginas) — para seletores, contagens e para manter o `version` no store. */
export async function listLocations(): Promise<Location[]> {
  return fetchAllPages(async (page, size) => {
    const response = await http.get<ApiSite[] | ApiSitePage>(`/sites${buildQueryString({ page, size })}`);
    return toPaged(response, { page, size });
  });
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
