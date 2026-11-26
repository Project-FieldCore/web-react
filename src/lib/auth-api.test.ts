import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changePassword, login, logout, refresh } from './auth-api';
import { setAuthToken } from './auth-token';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('auth-api login', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    setAuthToken(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('envia email/password para /auth/login e mapeia o TokenResponse da API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        accessToken: 'jwt-abc',
        refreshToken: 'refresh-xyz',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: { id: 'usr-1', name: 'Admin', email: 'admin@fieldcore.com', role: 'ADMIN' },
      })
    );
    global.fetch = fetchMock;

    const result = await login('admin@fieldcore.com', 'senha-correta');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/auth\/login$/);
    expect(JSON.parse(init.body)).toEqual({ email: 'admin@fieldcore.com', password: 'senha-correta' });
    expect(result).toEqual({
      token: 'jwt-abc',
      refreshToken: 'refresh-xyz',
      mustChangePassword: false,
      user: { id: 'usr-1', nome: 'Admin', email: 'admin@fieldcore.com', role: 'ADMIN', status: 'ATIVO' },
    });
  });

  it('sinaliza o primeiro acesso quando a API devolve mustChangePassword', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        accessToken: 'jwt-prov',
        refreshToken: 'refresh-prov',
        expiresIn: 900,
        user: { id: 'usr-2', name: 'Novo', email: 'novo@fieldcore.com', role: 'SUPERVISOR', mustChangePassword: true },
      })
    );

    const result = await login('novo@fieldcore.com', 'provisoria-123');

    expect(result.mustChangePassword).toBe(true);
  });

  it('changePassword envia senha atual e nova para /auth/change-password com o access token', async () => {
    setAuthToken('jwt-prov');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        accessToken: 'jwt-novo',
        refreshToken: 'refresh-novo',
        expiresIn: 900,
        user: { id: 'usr-2', name: 'Novo', email: 'novo@fieldcore.com', role: 'SUPERVISOR', mustChangePassword: false },
      })
    );
    global.fetch = fetchMock;

    const result = await changePassword('provisoria-123', 'nova-senha-123');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/auth\/change-password$/);
    expect(init.headers.Authorization).toBe('Bearer jwt-prov');
    expect(JSON.parse(init.body)).toEqual({ currentPassword: 'provisoria-123', newPassword: 'nova-senha-123' });
    expect(result.token).toBe('jwt-novo');
    expect(result.mustChangePassword).toBe(false);
  });

  it('logout envia o refreshToken com o access token e aceita resposta 200 sem corpo', async () => {
    setAuthToken('jwt-abc');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    global.fetch = fetchMock;

    await expect(logout('refresh-xyz')).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/auth\/logout$/);
    expect(init.headers.Authorization).toBe('Bearer jwt-abc');
    expect(JSON.parse(init.body)).toEqual({ refreshToken: 'refresh-xyz' });
  });

  it('logout aceita 204 No Content (contrato atual da API)', async () => {
    setAuthToken('jwt-abc');
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await expect(logout('refresh-xyz')).resolves.toBeUndefined();
  });

  it('refresh envia o refreshToken sem o access token e mapeia o TokenResponse', async () => {
    setAuthToken('jwt-expirado');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        accessToken: 'jwt-novo',
        refreshToken: 'refresh-novo',
        expiresIn: 900,
        user: { id: 'usr-1', name: 'Admin', email: 'admin@fieldcore.com', role: 'ADMIN' },
      })
    );
    global.fetch = fetchMock;

    const result = await refresh('refresh-antigo');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/auth\/refresh$/);
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({ refreshToken: 'refresh-antigo' });
    expect(result.token).toBe('jwt-novo');
    expect(result.refreshToken).toBe('refresh-novo');
    expect(result.user.nome).toBe('Admin');
  });
});
