import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUser, listUsers, searchUsers, setUserStatus, updateUser } from './users-api';
import { setAuthToken } from './auth-token';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const API_USER = {
  id: 'usr-1',
  name: 'Ana Ribeiro',
  email: 'ana@fieldcore.com',
  role: 'ADMIN',
  status: 'ACTIVE',
  phone: null,
  version: 2,
};
const APP_USER = {
  id: 'usr-1',
  nome: 'Ana Ribeiro',
  email: 'ana@fieldcore.com',
  role: 'ADMIN',
  status: 'ATIVO',
  phone: undefined,
  version: 2,
};

describe('users-api', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    setAuthToken(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('listUsers converte campos e status da API (name→nome, ACTIVE→ATIVO)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        items: [API_USER, { ...API_USER, id: 'usr-2', status: 'INACTIVE' }, { ...API_USER, id: 'usr-3', status: 'BLOCKED' }],
        page: { page: 0, size: 100, totalElements: 3, totalPages: 1 },
      })
    );
    global.fetch = fetchMock;

    const users = await listUsers();

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/users\?page=0&size=100$/);
    expect(users).toEqual([
      APP_USER,
      { ...APP_USER, id: 'usr-2', status: 'INATIVO' },
      { ...APP_USER, id: 'usr-3', status: 'BLOQUEADO' },
    ]);
  });

  it('listUsers percorre todas as páginas', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { items: [API_USER], page: { page: 0, size: 100, totalElements: 2, totalPages: 2 } })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { items: [{ ...API_USER, id: 'usr-2' }], page: { page: 1, size: 100, totalElements: 2, totalPages: 2 } })
      );
    global.fetch = fetchMock;

    const users = await listUsers();

    expect(users.map((u) => u.id)).toEqual(['usr-1', 'usr-2']);
    expect(fetchMock.mock.calls[1][0]).toMatch(/page=1&size=100$/);
  });

  it('listUsers com lista vazia devolve []', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { items: [], page: { page: 0, size: 100, totalElements: 0, totalPages: 0 } }));

    expect(await listUsers()).toEqual([]);
  });

  it('searchUsers envia page/size/sort/q e os filtros (status e role) na query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { items: [API_USER], page: { page: 1, size: 10, totalElements: 11, totalPages: 2 } })
    );
    global.fetch = fetchMock;

    const result = await searchUsers({
      page: 1,
      size: 10,
      sort: { field: 'email', dir: 'desc' },
      q: ' ana ',
      filters: { status: 'INATIVO', role: 'SUPERVISOR' },
    });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toMatch(/\/users$/);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '1',
      size: '10',
      sort: 'email,desc',
      q: 'ana',
      status: 'INACTIVE',
      role: 'SUPERVISOR',
    });
    expect(result.items).toEqual([APP_USER]);
    expect(result.page).toEqual({ page: 1, size: 10, totalElements: 11, totalPages: 2 });
  });

  it('searchUsers omite q e filtros quando não há busca nem filtro', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { items: [], page: { page: 0, size: 20, totalElements: 0, totalPages: 0 } })
    );
    global.fetch = fetchMock;

    await searchUsers({ page: 0, size: 20, sort: { field: 'name', dir: 'asc' }, q: '', filters: {} });

    expect(Object.fromEntries(new URL(fetchMock.mock.calls[0][0]).searchParams)).toEqual({
      page: '0',
      size: '20',
      sort: 'name,asc',
    });
  });

  it('ordenação inválida (400 INVALID_SORT) chega como ApiError em português', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(400, { status: 400, code: 'INVALID_SORT', message: 'Sort must use an allowed field' }));

    await expect(
      searchUsers({ page: 0, size: 20, sort: { field: 'phone', dir: 'asc' }, q: '', filters: {} })
    ).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_SORT',
      message: 'Ordenação inválida para esta lista. Escolha outra opção de ordenação.',
    });
  });

  it('createUser envia name/password (contrato da API) e devolve o usuário convertido', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, API_USER));
    global.fetch = fetchMock;

    const user = await createUser('Ana Ribeiro', 'ana@fieldcore.com', 'ADMIN', 'senha1234');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/users$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ name: 'Ana Ribeiro', email: 'ana@fieldcore.com', role: 'ADMIN', password: 'senha1234' });
    expect(user).toEqual(APP_USER);
  });

  it('updateUser envia só os campos alterados e o version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ...API_USER, name: 'Ana Maria', version: 3 }));
    global.fetch = fetchMock;

    const user = await updateUser('usr-1', { nome: 'Ana Maria' }, 2);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/users\/usr-1$/);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ name: 'Ana Maria', version: 2 });
    expect(user.nome).toBe('Ana Maria');
    expect(user.version).toBe(3);
  });

  it('setUserStatus usa /users/{id}/status com o status da API e o version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ...API_USER, status: 'INACTIVE', version: 3 }));
    global.fetch = fetchMock;

    const user = await setUserStatus('usr-1', 'INATIVO', 2);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/users\/usr-1\/status$/);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ status: 'INACTIVE', version: 2 });
    expect(user.status).toBe('INATIVO');
  });

  it('e-mail duplicado (409 EMAIL_ALREADY_EXISTS) chega como ApiError em português', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(409, { status: 409, code: 'EMAIL_ALREADY_EXISTS', message: 'Email is already in use' }));

    await expect(createUser('X', 'x@x.com', 'ADMIN', 'senha1234')).rejects.toMatchObject({
      status: 409,
      code: 'EMAIL_ALREADY_EXISTS',
      message: 'Já existe um usuário com esse e-mail.',
    });
  });
});
