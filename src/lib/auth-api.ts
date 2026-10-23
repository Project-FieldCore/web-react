import { http } from './http';
import type { User, UserRole } from '@/types';

interface ApiProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

/** Contrato real da API (openapi/fieldops-v1.yaml, TokenResponse). */
interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
  expiresIn: number;
  user: ApiProfile;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: User;
}

/**
 * POST /v1/auth/login { email, password } -> 200 TokenResponse
 *   | 401 INVALID_CREDENTIALS | 403 ACCOUNT_INACTIVE
 * A API só emite token para usuário ACTIVE, então o status do usuário
 * retornado é sempre ATIVO (conta inativa chega como 403, não como 200).
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await http.post<TokenResponse>('/auth/login', { email, password });
  return {
    token: response.accessToken,
    refreshToken: response.refreshToken,
    user: {
      id: response.user.id,
      nome: response.user.name,
      email: response.user.email,
      role: response.user.role,
      status: 'ATIVO',
    },
  };
}

/**
 * POST /v1/auth/logout { refreshToken } -> 200 (sem corpo). Exige o access
 * token no header (a rota não é pública) e revoga o refresh token.
 */
export function logout(refreshToken: string): Promise<void> {
  return http.post<void>('/auth/logout', { refreshToken });
}
