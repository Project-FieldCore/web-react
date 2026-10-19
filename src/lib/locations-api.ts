import { http } from './http';
import type { Location } from '@/types';

/**
 * Contrato assumido para a API (ainda não implementado no backend).
 * O OpenAPI do fieldcore_backend chama esse recurso de "site"
 * (GET /api/v1/sites), não "location" — usamos o path /sites aqui para bater
 * com o nome já declarado lá, mas os campos do payload são só suposição
 * (nenhum schema publicado ainda). Confirmar essa divergência de nome
 * (Location x Site) com o time de backend antes de validar isso de verdade.
 */
export function createLocation(clienteId: string, nome: string, endereco?: string): Promise<Location> {
  return http.post<Location>('/sites', { clienteId, nome, endereco });
}

export function updateLocation(id: string, patch: Partial<Pick<Location, 'nome' | 'endereco'>>): Promise<Location> {
  return http.patch<Location>(`/sites/${id}`, patch);
}

export function setLocationActive(id: string, ativo: boolean): Promise<Location> {
  return http.patch<Location>(`/sites/${id}`, { ativo });
}
