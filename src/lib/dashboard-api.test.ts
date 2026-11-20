import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDashboardIndicators, toDashboardIndicators } from './dashboard-api';
import { describeLoadError } from './state-copy';
import { setAuthToken } from './auth-token';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const API_BODY = {
  generatedAt: '2026-11-20T10:00:00Z',
  inspectionsByStatus: {
    DRAFT: 1, ASSIGNED: 3, IN_PROGRESS: 2, SUBMITTED: 4, UNDER_REVIEW: 1, APPROVED: 5, REJECTED: 0, CANCELED: 2,
  },
  openNonConformitiesBySeverity: { LOW: 1, MEDIUM: 2, HIGH: 0, CRITICAL: 3 },
};

describe('toDashboardIndicators', () => {
  it('traduz status e severidade para os nomes da tela e soma os totais', () => {
    const result = toDashboardIndicators(API_BODY);
    expect(result.inspectionsByStatus).toEqual({
      RASCUNHO: 1, ATRIBUIDA: 3, EM_ANDAMENTO: 2, ENVIADA: 4, EM_REVISAO: 1, APROVADA: 5, REPROVADA: 0, CANCELADA: 2,
    });
    expect(result.openNonConformitiesBySeverity).toEqual({ BAIXA: 1, MEDIA: 2, ALTA: 0, CRITICA: 3 });
    expect(result.totalInspections).toBe(18);
    expect(result.totalOpenNonConformities).toBe(6);
  });

  it('"Devolvida" não existe na API: fica ausente, não vira 0', () => {
    expect('DEVOLVIDA' in toDashboardIndicators(API_BODY).inspectionsByStatus).toBe(false);
  });

  it('ignora chaves desconhecidas e completa severidades ausentes com 0', () => {
    const result = toDashboardIndicators({
      generatedAt: 'x',
      inspectionsByStatus: { ASSIGNED: 2, NOVO_STATUS: 9 },
      openNonConformitiesBySeverity: { HIGH: 1, OUTRA: 4 },
    });
    expect(result.inspectionsByStatus).toEqual({ ATRIBUIDA: 2 });
    expect(result.openNonConformitiesBySeverity).toEqual({ BAIXA: 0, MEDIA: 0, ALTA: 1, CRITICA: 0 });
    expect(result.totalInspections).toBe(2);
  });

  it('tudo zerado (sem dados) resulta em totais 0', () => {
    const result = toDashboardIndicators({
      generatedAt: 'x',
      inspectionsByStatus: { DRAFT: 0, ASSIGNED: 0 },
      openNonConformitiesBySeverity: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
    });
    expect(result.totalInspections).toBe(0);
    expect(result.totalOpenNonConformities).toBe(0);
  });
});

describe('fetchDashboardIndicators', () => {
  const originalFetch = global.fetch;
  beforeEach(() => setAuthToken('token-teste'));
  afterEach(() => {
    global.fetch = originalFetch;
    setAuthToken(null);
    vi.restoreAllMocks();
  });

  it('GET /dashboard/indicators e converte a resposta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, API_BODY));
    global.fetch = fetchMock;
    const result = await fetchDashboardIndicators();
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/dashboard\/indicators$/);
    expect(result.totalInspections).toBe(18);
  });

  it('erro padronizado da API (403) vira mensagem sem retry', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(403, { status: 403, code: 'ACCESS_DENIED', message: 'Forbidden', path: '/api/v1/dashboard/indicators' })
    );
    const error = await fetchDashboardIndicators().catch((e: unknown) => e);
    expect(error).toMatchObject({ name: 'ApiError', status: 403, code: 'ACCESS_DENIED' });
    expect(describeLoadError(error).retry).toBe(false);
  });

  it('erro 500 permite nova tentativa', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(500, { status: 500, code: 'INTERNAL_ERROR', message: 'x', path: '/p' }));
    const error = await fetchDashboardIndicators().catch((e: unknown) => e);
    expect(describeLoadError(error).retry).toBe(true);
  });
});
