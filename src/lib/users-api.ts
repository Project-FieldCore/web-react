import { http } from './http';
import type { User, UserRole, UserStatus } from '@/types';

/**
 * Contrato assumido para a API (ainda não implementado no backend — o
 * OpenAPI do fieldcore_backend só declara GET /api/v1/users, sem schema nem
 * verbos de escrita). Ajustar path/campos quando o contrato real existir.
 */
export function createUser(nome: string, email: string, role: UserRole, senha: string): Promise<User> {
  return http.post<User>('/users', { nome, email, role, senha });
}

export function updateUser(id: string, patch: Partial<Pick<User, 'nome' | 'email' | 'role'>>): Promise<User> {
  return http.patch<User>(`/users/${id}`, patch);
}

export function setUserStatus(id: string, status: UserStatus): Promise<User> {
  return http.patch<User>(`/users/${id}`, { status });
}
