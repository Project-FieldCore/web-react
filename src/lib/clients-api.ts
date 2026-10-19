import { http } from './http';
import type { Client } from '@/types';

/**
 * Contrato assumido para a API (ainda não implementado no backend — o
 * OpenAPI do fieldcore_backend só declara GET /api/v1/clients, sem schema
 * nem verbos de escrita). Ajustar path/campos quando o contrato real existir.
 */
export function createClient(nome: string, cnpj?: string): Promise<Client> {
  return http.post<Client>('/clients', { nome, cnpj });
}

export function updateClient(id: string, patch: Partial<Pick<Client, 'nome' | 'cnpj'>>): Promise<Client> {
  return http.patch<Client>(`/clients/${id}`, patch);
}

export function setClientActive(id: string, ativo: boolean): Promise<Client> {
  return http.patch<Client>(`/clients/${id}`, { ativo });
}
