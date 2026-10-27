import { http } from './http';
import type { User, UserRole, UserStatus } from '@/types';

/**
 * Contrato real da API (openapi/fieldops-v1.yaml + UserController, somente ADMIN):
 *   GET   /users?page&size            -> { items: User[], page: { page, size, totalElements, totalPages } }
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

const PAGE_SIZE = 100; // máximo aceito pela API

/** Busca todas as páginas — o cadastro é pequeno e a tela filtra/busca localmente. */
export async function listUsers(): Promise<User[]> {
  const users: User[] = [];
  let page = 0;
  let totalPages = 1;
  while (page < totalPages) {
    const response = await http.get<ApiUserPage>(`/users?page=${page}&size=${PAGE_SIZE}`);
    users.push(...response.items.map(toUser));
    totalPages = response.page.totalPages;
    page += 1;
  }
  return users;
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
