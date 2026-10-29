import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient, listClients, searchClients, setClientActive, updateClient } from './clients-api';
import { setAuthToken } from './auth-token';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const API_CLIENT = {
  id: 'cli-1',
  name: 'Acme',
  legalName: 'Acme Ltda',
  document: '12.345.678/0001-00',
  email: null,
  phone: null,
  status: 'ACTIVE',
  version: 2,
};
const APP_CLIENT = { id: 'cli-1', nome: 'Acme', cnpj: '12.345.678/0001-00', ativo: true, version: 2 };

describe('clients-api', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    setAuthToken(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('listClients converte campos e status da API (name→nome, document→cnpj, ACTIVE→ativo)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        items: [API_CLIENT, { ...API_CLIENT, id: 'cli-2', document: null, status: 'INACTIVE' }],
        page: { page: 0, size: 100, totalElements: 2, totalPages: 1 },
      })
    );
    global.fetch = fetchMock;

    const clients = await listClients();

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/clients\?page=0&size=100$/);
    expect(clients).toEqual([APP_CLIENT, { id: 'cli-2', nome: 'Acme', cnpj: undefined, ativo: false, version: 2 }]);
  });

  it('listClients percorre todas as páginas', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { items: [API_CLIENT], page: { page: 0, size: 100, totalElements: 2, totalPages: 2 } })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { items: [{ ...API_CLIENT, id: 'cli-2' }], page: { page: 1, size: 100, totalElements: 2, totalPages: 2 } })
      );
    global.fetch = fetchMock;

    const clients = await listClients();

    expect(clients.map((c) => c.id)).toEqual(['cli-1', 'cli-2']);
    expect(fetchMock.mock.calls[1][0]).toMatch(/page=1&size=100$/);
  });

  it('listClients com lista vazia devolve []', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { items: [], page: { page: 0, size: 100, totalElements: 0, totalPages: 0 } }));

    expect(await listClients()).toEqual([]);
  });

  it('searchClients envia page/size/sort/q e o filtro de status na query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { items: [API_CLIENT], page: { page: 2, size: 12, totalElements: 30, totalPages: 3 } })
    );
    global.fetch = fetchMock;

    const result = await searchClients({
      page: 2,
      size: 12,
      sort: { field: 'createdAt', dir: 'desc' },
      q: 'acme',
      filters: { ativo: false },
    });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toMatch(/\/clients$/);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '2',
      size: '12',
      sort: 'createdAt,desc',
      q: 'acme',
      status: 'INACTIVE',
    });
    expect(result.items).toEqual([APP_CLIENT]);
    expect(result.page.totalElements).toBe(30);
  });

  it('searchClients: ativo=true vira ACTIVE e sem filtro não envia status', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () =>
        jsonResponse(200, { items: [], page: { page: 0, size: 12, totalElements: 0, totalPages: 0 } })
      );
    global.fetch = fetchMock;
    const base = { page: 0, size: 12, sort: { field: 'name', dir: 'asc' as const }, q: '' };

    await searchClients({ ...base, filters: { ativo: true } });
    await searchClients({ ...base, filters: {} });

    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('status')).toBe('ACTIVE');
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.has('status')).toBe(false);
  });

  it('createClient envia name/document (contrato da API) e devolve o cliente convertido', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, API_CLIENT));
    global.fetch = fetchMock;

    const client = await createClient('Acme', '12.345.678/0001-00');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/clients$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ name: 'Acme', document: '12.345.678/0001-00' });
    expect(client).toEqual(APP_CLIENT);
  });

  it('createClient sem CNPJ não envia document', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { ...API_CLIENT, document: null }));
    global.fetch = fetchMock;

    await createClient('Acme');

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: 'Acme' });
  });

  it('updateClient envia só os campos alterados e o version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ...API_CLIENT, name: 'Acme Ltda', version: 3 }));
    global.fetch = fetchMock;

    const client = await updateClient('cli-1', { nome: 'Acme Ltda' }, 2);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/clients\/cli-1$/);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ name: 'Acme Ltda', version: 2 });
    expect(client.nome).toBe('Acme Ltda');
    expect(client.version).toBe(3);
  });

  it('setClientActive usa /clients/{id}/status com ACTIVE/INACTIVE e o version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ...API_CLIENT, status: 'INACTIVE', version: 3 }));
    global.fetch = fetchMock;

    const client = await setClientActive('cli-1', false, 2);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/clients\/cli-1\/status$/);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ status: 'INACTIVE', version: 2 });
    expect(client.ativo).toBe(false);
  });

  it('CNPJ duplicado (409 DOCUMENT_ALREADY_EXISTS) chega como ApiError em português', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(409, { status: 409, code: 'DOCUMENT_ALREADY_EXISTS', message: 'Document is already in use' }));

    await expect(createClient('X', '1')).rejects.toMatchObject({
      status: 409,
      code: 'DOCUMENT_ALREADY_EXISTS',
      message: 'Já existe um cliente com esse CNPJ.',
    });
  });
});
