import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from './app-store';
import { ApiError, NetworkError } from '@/lib/http';
import { getAuthToken, getRefreshToken, notifyUnauthorized, setAuthToken, setRefreshToken } from '@/lib/auth-token';
import type { User } from '@/types';

vi.mock('@/lib/auth-api', () => ({
  login: vi.fn(),
  logout: vi.fn(),
}));

import { login as apiLoginMock, logout as apiLogoutMock } from '@/lib/auth-api';

const ADMIN_USER: User = { id: 'usr-1', nome: 'Admin', email: 'admin@fieldcore.com', role: 'ADMIN', status: 'ATIVO' };

function mockApiLogin(result: { token: string; refreshToken?: string; user: User } | Error) {
  if (result instanceof Error) {
    (apiLoginMock as ReturnType<typeof vi.fn>).mockRejectedValue(result);
  } else {
    (apiLoginMock as ReturnType<typeof vi.fn>).mockResolvedValue(result);
  }
}

describe('useAppStore auth', () => {
  beforeEach(() => {
    useAppStore.setState({ currentUser: null });
    setAuthToken(null);
    setRefreshToken(null);
    vi.clearAllMocks();
    (apiLogoutMock as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('autentica com sucesso, guarda usuário e token', async () => {
    mockApiLogin({ token: 'jwt-abc', refreshToken: 'refresh-xyz', user: ADMIN_USER });

    const result = await useAppStore.getState().login('admin@fieldcore.com', 'senha123');

    expect(result).toEqual({ ok: true });
    expect(useAppStore.getState().currentUser).toEqual(ADMIN_USER);
    expect(getAuthToken()).toBe('jwt-abc');
    expect(getRefreshToken()).toBe('refresh-xyz');
  });

  it('não chama a API com e-mail inválido', async () => {
    const result = await useAppStore.getState().login('nao-e-email', 'senha123');

    expect(result).toEqual({ ok: false, error: 'Informe um e-mail válido.' });
    expect(apiLoginMock).not.toHaveBeenCalled();
  });

  it('não chama a API com senha vazia', async () => {
    const result = await useAppStore.getState().login('admin@fieldcore.com', '   ');

    expect(result).toEqual({ ok: false, error: 'Informe sua senha.' });
    expect(apiLoginMock).not.toHaveBeenCalled();
  });

  it('mostra erro genérico em 401 (credenciais inválidas)', async () => {
    mockApiLogin(new ApiError('Credenciais inválidas.', 401));

    const result = await useAppStore.getState().login('admin@fieldcore.com', 'errada');

    expect(result).toEqual({ ok: false, error: 'E-mail ou senha inválidos.' });
    expect(useAppStore.getState().currentUser).toBeNull();
  });

  it('repassa a mensagem da API em erros que não são 401', async () => {
    mockApiLogin(new ApiError('Serviço indisponível.', 503));

    const result = await useAppStore.getState().login('admin@fieldcore.com', 'senha123');

    expect(result).toEqual({ ok: false, error: 'Serviço indisponível.' });
  });

  it('mostra a mensagem de NetworkError quando a API está fora do ar', async () => {
    mockApiLogin(new NetworkError('Não foi possível conectar à API. Verifique sua conexão e tente novamente.'));

    const result = await useAppStore.getState().login('admin@fieldcore.com', 'senha123');

    expect(result).toEqual({
      ok: false,
      error: 'Não foi possível conectar à API. Verifique sua conexão e tente novamente.',
    });
  });

  it('bloqueia usuário inativo mesmo com credenciais aceitas pela API', async () => {
    mockApiLogin({ token: 'jwt-abc', user: { ...ADMIN_USER, status: 'INATIVO' } });

    const result = await useAppStore.getState().login('admin@fieldcore.com', 'senha123');

    expect(result).toEqual({ ok: false, error: 'Este usuário está inativo ou bloqueado. Procure um administrador.' });
    expect(useAppStore.getState().currentUser).toBeNull();
    expect(getAuthToken()).toBeNull();
  });

  it('bloqueia perfil sem acesso à interface web (ex.: TECHNICIAN)', async () => {
    mockApiLogin({ token: 'jwt-abc', user: { ...ADMIN_USER, role: 'TECHNICIAN' } });

    const result = await useAppStore.getState().login('admin@fieldcore.com', 'senha123');

    expect(result).toEqual({ ok: false, error: 'Este perfil não tem acesso à interface administrativa web.' });
    expect(useAppStore.getState().currentUser).toBeNull();
  });

  it('logout limpa o usuário e os tokens e revoga o refresh token na API', () => {
    useAppStore.setState({ currentUser: ADMIN_USER });
    setAuthToken('jwt-abc');
    setRefreshToken('refresh-xyz');

    useAppStore.getState().logout();

    expect(apiLogoutMock).toHaveBeenCalledWith('refresh-xyz');
    expect(useAppStore.getState().currentUser).toBeNull();
    expect(getAuthToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('logout local acontece mesmo se a chamada de logout à API falhar', async () => {
    (apiLogoutMock as ReturnType<typeof vi.fn>).mockRejectedValue(new NetworkError());
    useAppStore.setState({ currentUser: ADMIN_USER });
    setAuthToken('jwt-abc');
    setRefreshToken('refresh-xyz');

    useAppStore.getState().logout();
    await Promise.resolve();

    expect(useAppStore.getState().currentUser).toBeNull();
    expect(getAuthToken()).toBeNull();
  });

  it('logout sem refresh token não chama a API', () => {
    useAppStore.setState({ currentUser: ADMIN_USER });

    useAppStore.getState().logout();

    expect(apiLogoutMock).not.toHaveBeenCalled();
    expect(useAppStore.getState().currentUser).toBeNull();
  });

  it('uma sessão expirada (401 autenticado) desloga automaticamente', async () => {
    mockApiLogin({ token: 'jwt-abc', user: ADMIN_USER });
    await useAppStore.getState().login('admin@fieldcore.com', 'senha123');
    expect(useAppStore.getState().currentUser).not.toBeNull();

    notifyUnauthorized();

    expect(useAppStore.getState().currentUser).toBeNull();
    expect(apiLogoutMock).not.toHaveBeenCalled();
  });
});
