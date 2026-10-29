import type { UserRole } from '@/types';

/**
 * Áreas restritas ao perfil ADMIN (05 - Perfis de Usuário: "menor privilégio").
 * Isto é apenas conveniência de navegação — a API é sempre a decisão final
 * de autorização (RN-003); o painel só evita expor ações que o back-end
 * rejeitaria de qualquer forma. Clientes não entram aqui: a API libera
 * ADMIN e SUPERVISOR em /clients.
 */
export const ADMIN_ONLY_PREFIXES = ['/users', '/equipment', '/audit'];

/** Rotas de autenticação — acessíveis sem sessão, e que dispensam a Sidebar (UC-01, "Solicitar acesso", "Esqueci minha senha"). */
export const PUBLIC_ROUTES = ['/login', '/signup', '/forgot-password'];

export function isAllowed(pathname: string, role: UserRole): boolean {
  if (role === 'ADMIN') return true;
  return !ADMIN_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
