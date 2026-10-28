import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocation, listLocations, searchLocations, setLocationActive, updateLocation } from './locations-api';
import { setAuthToken } from './auth-token';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const API_SITE = {
  id: 'loc-1',
  clientId: 'cli-1',
  name: 'Matriz',
  addressLine: 'Rua A, 10',
  latitude: -23.5,
  longitude: -46.6,
  status: 'ACTIVE',
  version: 2,
};
const APP_LOCATION = {
  id: 'loc-1',
  clienteId: 'cli-1',
  nome: 'Matriz',
  endereco: 'Rua A, 10',
  ativo: true,
  lat: -23.5,
  lng: -46.6,
  version: 2,
};

describe('locations-api', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    setAuthToken(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const PAGE_META = { page: 0, size: 100, totalElements: 2, totalPages: 1 };

  it('listLocations (API paginada) converte campos e status (name→nome, addressLine→endereco, ACTIVE→ativo)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        items: [API_SITE, { ...API_SITE, id: 'loc-2', addressLine: null, latitude: null, longitude: null, status: 'INACTIVE' }],
        page: PAGE_META,
      })
    );
    global.fetch = fetchMock;

    const locations = await listLocations();

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/sites\?page=0&size=100$/);
    expect(locations).toEqual([
      APP_LOCATION,
      { id: 'loc-2', clienteId: 'cli-1', nome: 'Matriz', endereco: undefined, ativo: false, lat: undefined, lng: undefined, version: 2 },
    ]);
  });

  it('listLocations percorre todas as páginas da API paginada', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { items: [API_SITE], page: { page: 0, size: 100, totalElements: 2, totalPages: 2 } }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [{ ...API_SITE, id: 'loc-2' }], page: { page: 1, size: 100, totalElements: 2, totalPages: 2 } }));
    global.fetch = fetchMock;

    const locations = await listLocations();

    expect(locations.map((l) => l.id)).toEqual(['loc-1', 'loc-2']);
    expect(fetchMock.mock.calls[1][0]).toMatch(/page=1&size=100$/);
  });

  it('listLocations ainda aceita a API antiga (array simples)', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(200, [API_SITE, { ...API_SITE, id: 'loc-2' }]));

    const locations = await listLocations();

    expect(locations.map((l) => l.id)).toEqual(['loc-1', 'loc-2']);
  });

  it('listLocations com lista vazia devolve []', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { items: [], page: { page: 0, size: 100, totalElements: 0, totalPages: 0 } }));

    expect(await listLocations()).toEqual([]);
  });

  it('searchLocations envia page/size/sort/q, o status e o clientId na query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { items: [API_SITE], page: { page: 1, size: 12, totalElements: 13, totalPages: 2 } })
    );
    global.fetch = fetchMock;

    const result = await searchLocations({
      page: 1,
      size: 12,
      sort: { field: 'city', dir: 'asc' },
      q: 'matriz',
      filters: { ativo: true, clienteId: 'cli-1' },
    });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toMatch(/\/sites$/);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '1',
      size: '12',
      sort: 'city,asc',
      q: 'matriz',
      status: 'ACTIVE',
      clientId: 'cli-1',
    });
    expect(result.items).toEqual([APP_LOCATION]);
    expect(result.page).toEqual({ page: 1, size: 12, totalElements: 13, totalPages: 2 });
  });

  it('searchLocations também lê a resposta em array da API antiga (paginando no cliente)', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(200, [API_SITE, { ...API_SITE, id: 'loc-2' }, { ...API_SITE, id: 'loc-3' }])
    );

    const result = await searchLocations({ page: 1, size: 2, sort: { field: 'name', dir: 'asc' }, q: '', filters: {} });

    expect(result.items.map((l) => l.id)).toEqual(['loc-3']);
    expect(result.page).toEqual({ page: 1, size: 2, totalElements: 3, totalPages: 2 });
  });

  it('createLocation cria sob o cliente (POST /clients/{id}/sites) com name/addressLine', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, API_SITE));
    global.fetch = fetchMock;

    const location = await createLocation('cli-1', 'Matriz', 'Rua A, 10');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/clients\/cli-1\/sites$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ name: 'Matriz', addressLine: 'Rua A, 10' });
    expect(location).toEqual(APP_LOCATION);
  });

  it('createLocation sem endereço não envia addressLine', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { ...API_SITE, addressLine: null }));
    global.fetch = fetchMock;

    await createLocation('cli-1', 'Matriz');

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: 'Matriz' });
  });

  it('updateLocation envia só os campos alterados e o version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ...API_SITE, name: 'Matriz SP', version: 3 }));
    global.fetch = fetchMock;

    const location = await updateLocation('loc-1', { nome: 'Matriz SP' }, 2);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/sites\/loc-1$/);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ name: 'Matriz SP', version: 2 });
    expect(location.nome).toBe('Matriz SP');
    expect(location.version).toBe(3);
  });

  it('setLocationActive usa /sites/{id}/status com ACTIVE/INACTIVE e o version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ...API_SITE, status: 'INACTIVE', version: 3 }));
    global.fetch = fetchMock;

    const location = await setLocationActive('loc-1', false, 2);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/sites\/loc-1\/status$/);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ status: 'INACTIVE', version: 2 });
    expect(location.ativo).toBe(false);
  });

  it('nome repetido no cliente (409 SITE_NAME_ALREADY_EXISTS) chega como ApiError em português', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(409, { status: 409, code: 'SITE_NAME_ALREADY_EXISTS', message: 'A site with this name already exists for the client' }));

    await expect(createLocation('cli-1', 'Matriz')).rejects.toMatchObject({
      status: 409,
      code: 'SITE_NAME_ALREADY_EXISTS',
      message: 'Já existe um local com esse nome para este cliente.',
    });
  });
});
