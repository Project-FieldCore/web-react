import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CSV_FILE_NAMES,
  CSV_FORBIDDEN_MESSAGE,
  describeCsvError,
  exportClientsCsv,
  exportEquipmentCsv,
  exportInspectionsCsv,
  exportUsersCsv,
} from './csv-export-api';
import { ApiError, NetworkError } from './http';
import { setAuthToken } from './auth-token';

function csvResponse(body = '"id","name"\r\n"1","Ana"\r\n'): Response {
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/csv;charset=UTF-8' } });
}
function errorResponse(status: number, code: string): Response {
  return new Response(JSON.stringify({ timestamp: 'x', status, code, message: 'x', path: '/p', requestId: 'r', fieldErrors: null }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const SORT = { field: 'name', dir: 'asc' as const };

describe('csv-export-api', () => {
  const originalFetch = global.fetch;
  beforeEach(() => setAuthToken('token-teste'));
  afterEach(() => {
    global.fetch = originalFetch;
    setAuthToken(null);
    vi.restoreAllMocks();
  });

  function mockCsv() {
    const fetchMock = vi.fn().mockResolvedValue(csvResponse());
    global.fetch = fetchMock;
    return fetchMock;
  }
  const calledUrl = (fetchMock: ReturnType<typeof vi.fn>) => new URL(String(fetchMock.mock.calls[0][0]));

  it('nomes de arquivo fixos por recurso', () => {
    expect(CSV_FILE_NAMES).toEqual({
      users: 'users.csv', clients: 'clients.csv', equipment: 'equipment.csv', inspections: 'inspections.csv',
    });
  });

  it('usuários: GET /users/export.csv com busca, filtros e ordenação, sem página nem tamanho', async () => {
    const fetchMock = mockCsv();
    const blob = await exportUsersCsv({ sort: SORT, q: '  ana ', filters: { role: 'SUPERVISOR', status: 'ATIVO' } });

    const url = calledUrl(fetchMock);
    expect(url.pathname).toMatch(/\/users\/export\.csv$/);
    expect(Object.fromEntries(url.searchParams)).toEqual({ sort: 'name,asc', q: 'ana', role: 'SUPERVISOR', status: 'ACTIVE' });
    expect(url.searchParams.has('page')).toBe(false);
    expect(url.searchParams.has('size')).toBe(false);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token-teste');
    expect(await blob.text()).toContain('"Ana"');
  });

  it('clientes: filtro de status ativo/inativo', async () => {
    const fetchMock = mockCsv();
    await exportClientsCsv({ sort: SORT, q: '', filters: { ativo: false } });
    const url = calledUrl(fetchMock);
    expect(url.pathname).toMatch(/\/clients\/export\.csv$/);
    expect(Object.fromEntries(url.searchParams)).toEqual({ sort: 'name,asc', status: 'INACTIVE' });
  });

  it('equipamentos: status e local (siteId)', async () => {
    const fetchMock = mockCsv();
    await exportEquipmentCsv({ sort: SORT, q: 'bomba', filters: { ativo: true, localId: 'site-1' } });
    const url = calledUrl(fetchMock);
    expect(url.pathname).toMatch(/\/equipment\/export\.csv$/);
    expect(Object.fromEntries(url.searchParams)).toEqual({ sort: 'name,asc', q: 'bomba', status: 'ACTIVE', siteId: 'site-1' });
  });

  it('inspeções: estado, técnico, cliente e período', async () => {
    const fetchMock = mockCsv();
    await exportInspectionsCsv({
      sort: { field: 'scheduledFor', dir: 'asc' },
      q: '',
      filters: {
        status: 'SUBMITTED', technicianId: 'tec-1', clientId: 'cli-1',
        scheduledFrom: '2026-11-01T00:00:00.000Z', scheduledTo: '2026-11-30T23:59:00.000Z',
      },
    });
    const url = calledUrl(fetchMock);
    expect(url.pathname).toMatch(/\/inspections\/export\.csv$/);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      sort: 'scheduledFor,asc', status: 'SUBMITTED', technicianId: 'tec-1', clientId: 'cli-1',
      scheduledFrom: '2026-11-01T00:00:00.000Z', scheduledTo: '2026-11-30T23:59:00.000Z',
    });
  });

  it('sem filtros ativos: só a ordenação vai na URL', async () => {
    const fetchMock = mockCsv();
    await exportUsersCsv({ sort: SORT, q: '', filters: {} });
    expect(calledUrl(fetchMock).search).toBe('?sort=name%2Casc');
  });

  it('403 (perfil sem acesso, ex.: supervisora exportando usuários) não oferece nova tentativa', async () => {
    global.fetch = vi.fn().mockResolvedValue(errorResponse(403, 'ACCESS_DENIED'));
    const error = await exportUsersCsv({ sort: SORT, q: '', filters: {} }).catch((e: unknown) => e);
    expect(error).toMatchObject({ name: 'ApiError', status: 403, code: 'ACCESS_DENIED' });
    expect(describeCsvError(error)).toMatchObject({ message: CSV_FORBIDDEN_MESSAGE, retry: false, status: 403 });
  });

  it('401 não oferece nova tentativa; 500 e rede permitem', () => {
    expect(describeCsvError(new ApiError('x', 401, undefined, 'UNAUTHORIZED')).retry).toBe(false);
    expect(describeCsvError(new ApiError('x', 500, undefined, 'INTERNAL_ERROR')).retry).toBe(true);
    expect(describeCsvError(new NetworkError()).retry).toBe(true);
  });
});
