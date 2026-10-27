import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError, http } from './http';
import { getAuthToken, getRefreshToken, onRefresh, onUnauthorized, setAuthToken, setRefreshToken } from './auth-token';

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
    setRefreshToken(null);
    onRefresh(null);
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

  it('409 genérico (CONFLICT) vira mensagem em português, não "Conflict"', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(409, { status: 409, code: 'CONFLICT', message: 'Conflict' }));

    await expect(http.post('/users', {})).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'Não foi possível salvar: os dados conflitam com um registro existente.',
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

  describe('renovação automática da sessão (401 com token)', () => {
    /** Simula a API: só aceita o token 'novo'; qualquer outro recebe 401. */
    function apiAcceptingOnly(valid: string) {
      return vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        const auth = (init.headers as Record<string, string>).Authorization;
        return auth === `Bearer ${valid}` ? jsonResponse(200, { ok: true }) : jsonResponse(401, { message: 'Unauthorized' });
      });
    }

    function renewingTo(token: string, refreshToken: string) {
      return vi.fn().mockImplementation(async () => {
        setAuthToken(token);
        setRefreshToken(refreshToken);
        return true;
      });
    }

    it('renova a sessão e repete a requisição com o token novo', async () => {
      setAuthToken('expirado');
      setRefreshToken('refresh-1');
      global.fetch = apiAcceptingOnly('novo');
      const refresh = renewingTo('novo', 'refresh-2');
      onRefresh(refresh);
      const unauthorized = vi.fn();
      onUnauthorized(unauthorized);

      const result = await http.get('/clients');

      expect(result).toEqual({ ok: true });
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(getAuthToken()).toBe('novo');
      expect(getRefreshToken()).toBe('refresh-2');
      expect(unauthorized).not.toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('requisições simultâneas com 401 compartilham uma única renovação', async () => {
      setAuthToken('expirado');
      setRefreshToken('refresh-1');
      global.fetch = apiAcceptingOnly('novo');
      const refresh = renewingTo('novo', 'refresh-2');
      onRefresh(refresh);

      const results = await Promise.all([http.get('/a'), http.get('/b'), http.get('/c')]);

      expect(results).toHaveLength(3);
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('requisição que chega com 401 depois de outra já ter renovado só repete, sem novo refresh', async () => {
      setAuthToken('expirado');
      setRefreshToken('refresh-1');
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const refresh = vi.fn().mockImplementation(async () => {
        setAuthToken('novo');
        setRefreshToken('refresh-2');
        return true;
      });
      onRefresh(refresh);
      global.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        const auth = (init.headers as Record<string, string>).Authorization;
        if (auth === 'Bearer novo') return jsonResponse(200, { ok: true });
        await gate; // esta resposta 401 só chega depois da renovação
        return jsonResponse(401, { message: 'Unauthorized' });
      });

      const first = http.get('/a');
      const second = http.get('/b');
      await Promise.resolve();
      release();
      await Promise.all([first, second]);

      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('se o refresh falha, encerra a sessão e propaga o 401', async () => {
      setAuthToken('expirado');
      setRefreshToken('refresh-1');
      global.fetch = apiAcceptingOnly('novo');
      onRefresh(vi.fn().mockResolvedValue(false));
      const unauthorized = vi.fn();
      onUnauthorized(unauthorized);

      await expect(http.get('/clients')).rejects.toMatchObject({ status: 401 });
      expect(unauthorized).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('se a repetição também recebe 401, encerra a sessão sem entrar em loop', async () => {
      setAuthToken('expirado');
      setRefreshToken('refresh-1');
      global.fetch = apiAcceptingOnly('nunca-aceito');
      const refresh = renewingTo('novo', 'refresh-2');
      onRefresh(refresh);
      const unauthorized = vi.fn();
      onUnauthorized(unauthorized);

      await expect(http.get('/clients')).rejects.toMatchObject({ status: 401 });
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(unauthorized).toHaveBeenCalledTimes(1);
    });

    it('sem refresh token salvo, não tenta renovar e encerra a sessão', async () => {
      setAuthToken('expirado');
      global.fetch = apiAcceptingOnly('novo');
      const refresh = vi.fn().mockResolvedValue(true);
      onRefresh(refresh);
      const unauthorized = vi.fn();
      onUnauthorized(unauthorized);

      await expect(http.get('/clients')).rejects.toMatchObject({ status: 401 });
      expect(refresh).not.toHaveBeenCalled();
      expect(unauthorized).toHaveBeenCalledTimes(1);
    });

    it('erro de rede durante o refresh propaga e não encerra a sessão', async () => {
      setAuthToken('expirado');
      setRefreshToken('refresh-1');
      global.fetch = apiAcceptingOnly('novo');
      onRefresh(vi.fn().mockRejectedValue(new NetworkError()));
      const unauthorized = vi.fn();
      onUnauthorized(unauthorized);

      await expect(http.get('/clients')).rejects.toBeInstanceOf(NetworkError);
      expect(unauthorized).not.toHaveBeenCalled();
    });

    it('401 sem token (login) não tenta renovar', async () => {
      setRefreshToken('refresh-1');
      global.fetch = vi.fn().mockResolvedValue(jsonResponse(401, { message: 'Invalid' }));
      const refresh = vi.fn().mockResolvedValue(true);
      onRefresh(refresh);

      await expect(http.post('/auth/login', {})).rejects.toBeInstanceOf(ApiError);
      expect(refresh).not.toHaveBeenCalled();
    });

    it('skipRefresh: 401 encerra a sessão sem renovar (ex.: logout)', async () => {
      setAuthToken('expirado');
      setRefreshToken('refresh-1');
      global.fetch = vi.fn().mockResolvedValue(jsonResponse(401, { message: 'Unauthorized' }));
      const refresh = vi.fn().mockResolvedValue(true);
      onRefresh(refresh);

      await expect(http.post('/auth/logout', {}, { skipRefresh: true })).rejects.toBeInstanceOf(ApiError);
      expect(refresh).not.toHaveBeenCalled();
    });

    it('anonymous: não envia o token e não trata 401 como sessão expirada', async () => {
      setAuthToken('expirado');
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { message: 'Invalid' }));
      global.fetch = fetchMock;
      const unauthorized = vi.fn();
      onUnauthorized(unauthorized);

      await expect(http.post('/auth/refresh', {}, { anonymous: true })).rejects.toMatchObject({ status: 401 });
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
      expect(unauthorized).not.toHaveBeenCalled();
    });
  });
});
