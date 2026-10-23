import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError, http } from './http';
import { onUnauthorized, setAuthToken } from './auth-token';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('http', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    setAuthToken(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('retorna o corpo já parseado quando a resposta é ok', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(200, { id: '1' }));

    const result = await http.get<{ id: string }>('/clients/1');

    expect(result).toEqual({ id: '1' });
  });

  it('retorna undefined em respostas 204', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    const result = await http.delete<undefined>('/clients/1');

    expect(result).toBeUndefined();
  });

  it('lança ApiError com status e mensagem da API quando a resposta não é ok', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(422, { message: 'Dados inválidos.' }));

    await expect(http.post('/clients', { nome: '' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 422,
      message: 'Dados inválidos.',
    });
  });

  it('lança NetworkError quando o fetch falha (sem conexão)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(http.get('/clients')).rejects.toBeInstanceOf(NetworkError);
  });

  it('anexa o token de sessão como Authorization quando presente', async () => {
    setAuthToken('token-123');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    global.fetch = fetchMock;

    await http.get('/me');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer token-123');
  });

  it('dispara notifyUnauthorized em 401 quando a requisição já levava token', async () => {
    setAuthToken('token-123');
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(401, { message: 'Sessão expirada.' }));
    const handler = vi.fn();
    onUnauthorized(handler);

    await expect(http.get('/me')).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('não dispara notifyUnauthorized em 401 sem token (ex.: login com credenciais erradas)', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(401, { message: 'E-mail ou senha inválidos.' }));
    const handler = vi.fn();
    onUnauthorized(handler);

    await expect(http.post('/auth/login', { email: 'a@a.com', senha: 'x' })).rejects.toBeInstanceOf(ApiError);
    expect(handler).not.toHaveBeenCalled();
  });

  it('guarda o code da API no ApiError', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(401, { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' })
    );

    await expect(http.post('/auth/login', {})).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'E-mail ou senha inválidos.',
    });
  });

  it('traduz ACCOUNT_INACTIVE (403) para mensagem em português', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(403, { status: 403, code: 'ACCOUNT_INACTIVE', message: 'Account is inactive' })
    );

    await expect(http.post('/auth/login', {})).rejects.toMatchObject({
      status: 403,
      code: 'ACCOUNT_INACTIVE',
      message: 'Este usuário está inativo ou bloqueado. Procure um administrador.',
    });
  });

  it('403 sem code conhecido vira "sem permissão" e não desloga', async () => {
    setAuthToken('token-123');
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(403, { status: 403, code: 'FORBIDDEN', message: 'Access denied' }));
    const handler = vi.fn();
    onUnauthorized(handler);

    await expect(http.get('/users')).rejects.toMatchObject({
      status: 403,
      message: 'Você não tem permissão para realizar esta ação.',
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('erros de validação listam as mensagens dos fieldErrors', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(400, {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        fieldErrors: [
          { field: 'email', message: 'E-mail inválido.' },
          { field: 'password', message: 'Senha obrigatória.' },
        ],
      })
    );

    await expect(http.post('/auth/login', {})).rejects.toMatchObject({
      status: 400,
      message: 'E-mail inválido. Senha obrigatória.',
    });
  });

  it('resposta de erro sem corpo JSON usa o texto do status', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('boom', { status: 500, statusText: 'Internal Server Error' }));

    await expect(http.get('/clients')).rejects.toMatchObject({ status: 500, message: 'Internal Server Error' });
  });
});
