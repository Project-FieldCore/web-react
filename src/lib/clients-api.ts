import { http } from './http';
import { buildQueryString, fetchAllPages, listParams, type ListQuery, type Paged } from './paged-list';
import type { Client } from '@/types';

/**
 * Contrato real da API (openapi/fieldops-v1.yaml + ClientController, ADMIN e SUPERVISOR):
 *   GET   /clients?page&size&sort&q&status -> { items: Client[], page: { page, size, totalElements, totalPages } }
 *         sort: name | createdAt ("campo,asc|desc"); q busca nome, razão social, CNPJ e e-mail
 *   POST  /clients                    -> 201 Client          (409 DOCUMENT_ALREADY_EXISTS)
 *   PATCH /clients/{id}               -> Client  { name, legalName, document, email, phone, version }  (409 VERSION_CONFLICT)
 *   PATCH /clients/{id}/status        -> Client  { status: ACTIVE | INACTIVE, version }
 * `version` é a trava otimista: precisa ser a do cliente que a tela carregou.
 * Na tela, `cnpj` é o `document` da API e `ativo` é `status === 'ACTIVE'`.
 */

type ApiClientStatus = 'ACTIVE' | 'INACTIVE';

interface ApiClient {
  id: string;
  name: string;
  document?: string | null;
  status: ApiClientStatus;
  version: number;
}

interface ApiClientPage {
  items: ApiClient[];
  page: { page: number; size: number; totalElements: number; totalPages: number };
}

function toClient(client: ApiClient): Client {
  return {
    id: client.id,
    nome: client.name,
    cnpj: client.document ?? undefined,
    ativo: client.status === 'ACTIVE',
    version: client.version,
  };
}

/** Filtros explícitos da listagem de clientes (undefined = sem filtro). */
export interface ClientFilters {
  ativo?: boolean;
}

/** Uma página da listagem, com busca, filtro e ordenação feitos na API. */
export async function searchClients(query: ListQuery<ClientFilters>): Promise<Paged<Client>> {
  const { ativo } = query.filters;
  const response = await http.get<ApiClientPage>(
    `/clients${buildQueryString({
      ...listParams(query),
      status: ativo === undefined ? undefined : ativo ? 'ACTIVE' : 'INACTIVE',
    })}`
  );
  return { items: response.items.map(toClient), page: response.page };
}

/** Todos os clientes (todas as páginas) — para seletores, nomes e para manter o `version` no store. */
export async function listClients(): Promise<Client[]> {
  return fetchAllPages(async (page, size) => {
    const response = await http.get<ApiClientPage>(`/clients${buildQueryString({ page, size })}`);
    return { items: response.items.map(toClient), page: response.page };
  });
}

export async function createClient(nome: string, cnpj?: string): Promise<Client> {
  return toClient(await http.post<ApiClient>('/clients', { name: nome, document: cnpj }));
}

export async function updateClient(
  id: string,
  patch: Partial<Pick<Client, 'nome' | 'cnpj'>>,
  version: number
): Promise<Client> {
  return toClient(
    await http.patch<ApiClient>(`/clients/${id}`, { name: patch.nome, document: patch.cnpj, version })
  );
}

export async function setClientActive(id: string, ativo: boolean, version: number): Promise<Client> {
  return toClient(
    await http.patch<ApiClient>(`/clients/${id}/status`, { status: ativo ? 'ACTIVE' : 'INACTIVE', version })
  );
}
