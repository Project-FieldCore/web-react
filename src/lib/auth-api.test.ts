import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { login, logout, refresh } from './auth-api';
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
      user: { id: 'usr-1', nome: 'Admin', email: 'admin@fieldcore.com', role: 'ADMIN', status: 'ATIVO' },
    });
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
