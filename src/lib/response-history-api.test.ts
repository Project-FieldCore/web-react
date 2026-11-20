import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchResponseHistory } from './response-history-api';
import { ApiError } from './http';
import { setAuthToken } from './auth-token';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('response-history-api', () => {
  const originalFetch = global.fetch;

  beforeEach(() => setAuthToken('token-teste'));
  afterEach(() => {
    global.fetch = originalFetch;
    setAuthToken(null);
    vi.restoreAllMocks();
  });

  it('GET /inspections/{id}/response-history e converte as entradas em revisões', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, [
        {
          id: 'h1', inspectionResponseId: 'r1', inspectionItemId: 'it1', sectionTitle: 'S', itemTitle: 'I',
          action: 'CREATED', previous: null, current: { conformity: 'CONFORMING', version: 0 },
          changedBy: 'u1', changedByName: 'Carlos', responseVersion: 0, changedAt: '2026-11-04T10:00:00Z',
        },
        {
          id: 'h2', inspectionResponseId: 'r1', inspectionItemId: 'it1', sectionTitle: 'S', itemTitle: 'I',
          action: 'UPDATED', previous: { conformity: 'CONFORMING', version: 0 },
          current: { conformity: 'NON_CONFORMING', observation: 'vazamento', version: 1 },
          changedBy: 'u1', changedByName: 'Carlos', responseVersion: 1, changedAt: '2026-11-04T11:00:00Z',
        },
      ])
    );
    global.fetch = fetchMock;

    const revisions = await fetchResponseHistory('insp-1');

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/inspections\/insp-1\/response-history$/);
    expect(revisions).toHaveLength(2);
    expect(revisions[0]).toMatchObject({ itemId: 'it1', autorNome: 'Carlos', anterior: undefined, novo: { conformity: 'CONFORME' } });
    expect(revisions[1]).toMatchObject({ anterior: { conformity: 'CONFORME' }, novo: { conformity: 'NAO_CONFORME', observacao: 'vazamento' } });
  });

  it('propaga o erro padronizado da API (403 para técnico)', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(403, { status: 403, code: 'ACCESS_DENIED', message: 'Forbidden', path: '/x' })
    );
    await expect(fetchResponseHistory('insp-1')).rejects.toMatchObject({ name: 'ApiError', status: 403, code: 'ACCESS_DENIED' });
    expect(ApiError).toBeDefined();
  });
});
