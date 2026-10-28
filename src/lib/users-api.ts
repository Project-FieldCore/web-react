import { http } from './http';
import { buildQueryString, fetchAllPages, listParams, type ListQuery, type Paged } from './paged-list';
import type { User, UserRole, UserStatus } from '@/types';

/**
 * Contrato real da API (openapi/fieldops-v1.yaml + UserController, somente ADMIN):
 *   GET   /users?page&size&sort&q&status&role -> { items: User[], page: { page, size, totalElements, totalPages } }
 *         sort: name | email | createdAt ("campo,asc|desc"); q busca nome e e-mail
 *   POST  /users                      -> 201 User            (409 EMAIL_ALREADY_EXISTS)
 *   PATCH /users/{id}                 -> User  { name, email, role, phone, version }   (409 VERSION_CONFLICT)
 *   PATCH /users/{id}/status          -> User  { status, version }
 * `version` é a trava otimista: precisa ser a do usuário que a tela carregou.
 */

type ApiStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: ApiStatus;
  phone?: string | null;
  version: number;
}

interface ApiUserPage {
  items: ApiUser[];
  page: { page: number; size: number; totalElements: number; totalPages: number };
}

const STATUS_FROM_API: Record<ApiStatus, UserStatus> = {
  ACTIVE: 'ATIVO',
  INACTIVE: 'INATIVO',
  BLOCKED: 'BLOQUEADO',
};

const STATUS_TO_API: Record<UserStatus, ApiStatus> = {
  ATIVO: 'ACTIVE',
  INATIVO: 'INACTIVE',
  BLOQUEADO: 'BLOCKED',
};

function toUser(user: ApiUser): User {
  return {
    id: user.id,
    nome: user.name,
    email: user.email,
    role: user.role,
    status: STATUS_FROM_API[user.status],
    phone: user.phone ?? undefined,
    version: user.version,
  };
}

/** Filtros explícitos da listagem de usuários (undefined = sem filtro). */
export interface UserFilters {
  status?: UserStatus;
  role?: UserRole;
}

/** Uma página da listagem, com busca, filtros e ordenação feitos na API. */
export async function searchUsers(query: ListQuery<UserFilters>): Promise<Paged<User>> {
  const response = await http.get<ApiUserPage>(
    `/users${buildQueryString({
      ...listParams(query),
      status: query.filters.status ? STATUS_TO_API[query.filters.status] : undefined,
      role: query.filters.role,
    })}`
  );
  return { items: response.items.map(toUser), page: response.page };
}

/** Todos os usuários (todas as páginas) — para contagens e para manter o `version` no store. */
export async function listUsers(): Promise<User[]> {
  return fetchAllPages(async (page, size) => {
    const response = await http.get<ApiUserPage>(`/users${buildQueryString({ page, size })}`);
    return { items: response.items.map(toUser), page: response.page };
  });
}

export async function createUser(nome: string, email: string, role: UserRole, senha: string): Promise<User> {
  return toUser(await http.post<ApiUser>('/users', { name: nome, email, role, password: senha }));
}

export async function updateUser(
  id: string,
  patch: Partial<Pick<User, 'nome' | 'email' | 'role'>>,
  version: number
): Promise<User> {
  return toUser(
    await http.patch<ApiUser>(`/users/${id}`, { name: patch.nome, email: patch.email, role: patch.role, version })
  );
}

export async function setUserStatus(id: string, status: UserStatus, version: number): Promise<User> {
  return toUser(await http.patch<ApiUser>(`/users/${id}/status`, { status: STATUS_TO_API[status], version }));
}
