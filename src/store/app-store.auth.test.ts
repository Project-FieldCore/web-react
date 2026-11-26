import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from './app-store';
import { ApiError, NetworkError } from '@/lib/http';
import { getAuthToken, getRefreshToken, notifyUnauthorized, setAuthToken, setRefreshToken } from '@/lib/auth-token';
import type { User } from '@/types';

vi.mock('@/lib/auth-api', () => ({
  login: vi.fn(),
  changePassword: vi.fn(),
  logout: vi.fn(),
}));

import { changePassword as apiChangePasswordMock, login as apiLoginMock, logout as apiLogoutMock } from '@/lib/auth-api';

const ADMIN_USER: User = { id: 'usr-1', nome: 'Admin', email: 'admin@fieldcore.com', role: 'ADMIN', status: 'ATIVO' };

function mockApiLogin(result: { token: string; refreshToken?: string; user: User; mustChangePassword?: boolean } | Error) {
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

  it('mostra a mensagem em português de conta inativa (403 ACCOUNT_INACTIVE)', async () => {
    mockApiLogin(
      new ApiError('Este usuário está inativo ou bloqueado. Procure um administrador.', 403, undefined, 'ACCOUNT_INACTIVE')
    );

    const result = await useAppStore.getState().login('admin@fieldcore.com', 'senha123');

    expect(result).toEqual({ ok: false, error: 'Este usuário está inativo ou bloqueado. Procure um administrador.' });
    expect(useAppStore.getState().currentUser).toBeNull();
    expect(getAuthToken()).toBeNull();
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

  describe('resetPassword (RN-007)', () => {
    it('recusa senha menor que o mínimo', () => {
      const result = useAppStore.getState().resetPassword('admin@fieldcore.com', '12345');

      expect(result).toEqual({ ok: false, error: 'A nova senha deve ter ao menos 6 caracteres.' });
    });

    it('sempre retorna ok sem enumerar e-mail e sem gravar senha no cliente', () => {
      useAppStore.setState({
        users: [ADMIN_USER],
        auditEvents: [],
      });

      const result = useAppStore.getState().resetPassword('admin@fieldcore.com', 'novaSenha99');

      expect(result).toEqual({ ok: true });
      expect(useAppStore.getState().auditEvents).toEqual([]);
    });

    it('também retorna ok para e-mail inexistente (sem enumeração)', () => {
      expect(useAppStore.getState().resetPassword('naoexiste@fieldcore.com', 'novaSenha99')).toEqual({ ok: true });
    });
  });

  describe('primeiro acesso', () => {
    it('não abre a sessão quando a API exige a troca de senha', async () => {
      mockApiLogin({ token: 'jwt-provisorio', refreshToken: 'refresh-prov', user: ADMIN_USER, mustChangePassword: true });

      const result = await useAppStore.getState().login('admin@fieldcore.com', 'provisoria-123');

      expect(result).toEqual({ ok: true, mustChangePassword: true });
      expect(useAppStore.getState().currentUser).toBeNull();
      // Os tokens ficam guardados só para a chamada de troca de senha.
      expect(getAuthToken()).toBe('jwt-provisorio');
    });

    it('abre a sessão com os tokens novos depois de redefinir a senha', async () => {
      (apiChangePasswordMock as ReturnType<typeof vi.fn>).mockResolvedValue({
        token: 'jwt-novo',
        refreshToken: 'refresh-novo',
        user: ADMIN_USER,
        mustChangePassword: false,
      });

      const result = await useAppStore.getState().completeFirstAccess('provisoria-123', 'nova-senha-123');

      expect(apiChangePasswordMock).toHaveBeenCalledWith('provisoria-123', 'nova-senha-123');
      expect(result).toEqual({ ok: true });
      expect(useAppStore.getState().currentUser).toEqual(ADMIN_USER);
      expect(getAuthToken()).toBe('jwt-novo');
      expect(getRefreshToken()).toBe('refresh-novo');
    });

    it('recusa senha curta sem chamar a API', async () => {
      const result = await useAppStore.getState().completeFirstAccess('provisoria-123', 'curta');

      expect(result.ok).toBe(false);
      expect(apiChangePasswordMock).not.toHaveBeenCalled();
      expect(useAppStore.getState().currentUser).toBeNull();
    });

    it('mantém o usuário fora do sistema quando a API recusa a troca', async () => {
      (apiChangePasswordMock as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ApiError('A nova senha precisa ser diferente da senha atual.', 400, undefined, 'PASSWORD_UNCHANGED')
      );

      const result = await useAppStore.getState().completeFirstAccess('provisoria-123', 'nova-senha-123');

      expect(result.ok).toBe(false);
      expect(useAppStore.getState().currentUser).toBeNull();
    });
  });
});
