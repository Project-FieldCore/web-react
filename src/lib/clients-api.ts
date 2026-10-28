import { http } from './http';
import type { Client } from '@/types';

/**
 * Contrato real da API (openapi/fieldops-v1.yaml + ClientController, ADMIN e SUPERVISOR):
 *   GET   /clients?page&size          -> { items: Client[], page: { page, size, totalElements, totalPages } }
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

const PAGE_SIZE = 100; // máximo aceito pela API

/** Busca todas as páginas — o cadastro é pequeno e a tela filtra/busca localmente. */
export async function listClients(): Promise<Client[]> {
  const clients: Client[] = [];
  let page = 0;
  let totalPages = 1;
  while (page < totalPages) {
    const response = await http.get<ApiClientPage>(`/clients?page=${page}&size=${PAGE_SIZE}`);
    clients.push(...response.items.map(toClient));
    totalPages = response.page.totalPages;
    page += 1;
  }
  return clients;
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
