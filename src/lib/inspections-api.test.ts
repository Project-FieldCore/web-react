import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assignInspection,
  cancelInspection,
  fetchInspectionChecklist,
  listInspections,
  listReviewQueue,
  scheduleInspection,
  toAssignmentUpdate,
  toInspection,
  toReviewQueueItem,
  toScheduleBody,
  type ApiInspection,
  type ApiReviewQueueItem,
  type ScheduleInspectionInput,
} from './inspections-api';
import { setAuthToken } from './auth-token';
import { ApiError } from './http';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const INPUT: ScheduleInspectionInput = {
  modeloId: 'mod-1',
  clienteId: 'cli-1',
  localId: 'loc-1',
  equipamentoId: 'eq-1',
  tecnicoId: 'tec-1',
  prioridade: 'ALTA',
  dataPrevista: '2026-11-01T10:00:00.000Z',
  orientacoes: '  Levar EPI  ',
};

const API_INSPECTION: ApiInspection = {
  id: 'ins-1',
  clientId: 'cli-1',
  siteId: 'loc-1',
  templateVersionId: 'ver-1',
  technicianId: 'tec-1',
  supervisorId: 'sup-1',
  title: 'Modelo',
  instructions: 'Levar EPI',
  priority: 'HIGH',
  status: 'ASSIGNED',
  scheduledFor: '2026-11-01T10:00:00Z',
  version: 0,
};

describe('toScheduleBody', () => {
  it('converte os nomes da tela para o contrato da API', () => {
    expect(toScheduleBody(INPUT, 'ver-1')).toEqual({
      templateVersionId: 'ver-1',
      clientId: 'cli-1',
      siteId: 'loc-1',
      technicianId: 'tec-1',
      scheduledFor: '2026-11-01T10:00:00.000Z',
      instructions: 'Levar EPI',
      priority: 'HIGH',
    });
  });

  it('usa o id da VERSÃO (não o do modelo) e não envia título nem equipamento', () => {
    const body = toScheduleBody(INPUT, 'ver-9');

    expect(body.templateVersionId).toBe('ver-9');
    expect(body).not.toHaveProperty('title');
    expect(body).not.toHaveProperty('equipmentId');
    expect(JSON.stringify(body)).not.toContain('eq-1');
    expect(JSON.stringify(body)).not.toContain('mod-1');
  });

  it('prioridades: ALTA→HIGH, MEDIA→MEDIUM, BAIXA→LOW', () => {
    expect(toScheduleBody({ ...INPUT, prioridade: 'ALTA' }, 'v').priority).toBe('HIGH');
    expect(toScheduleBody({ ...INPUT, prioridade: 'MEDIA' }, 'v').priority).toBe('MEDIUM');
    expect(toScheduleBody({ ...INPUT, prioridade: 'BAIXA' }, 'v').priority).toBe('LOW');
  });

  it('orientações vazias não são enviadas', () => {
    expect(toScheduleBody({ ...INPUT, orientacoes: '   ' }, 'v').instructions).toBeUndefined();
    expect(toScheduleBody({ ...INPUT, orientacoes: undefined }, 'v').instructions).toBeUndefined();
  });
});

describe('toInspection', () => {
  const context = { modeloId: 'mod-1', modeloVersao: 3, equipamentoId: 'eq-1' };

  it('converte a resposta: nasce ATRIBUÍDA, com o checklist vazio e o modelo escolhido', () => {
    expect(toInspection(API_INSPECTION, context)).toEqual({
      id: 'ins-1',
      clienteId: 'cli-1',
      localId: 'loc-1',
      equipamentoId: 'eq-1',
      modeloId: 'mod-1',
      modeloVersao: 3,
      tecnicoId: 'tec-1',
      prioridade: 'ALTA',
      dataPrevista: '2026-11-01T10:00:00Z',
      orientacoes: 'Levar EPI',
      status: 'ATRIBUIDA',
      answers: {},
      nonConformities: {},
      version: 0,
    });
  });

  it('guarda o version da API (necessário para trocar o técnico)', () => {
    expect(toInspection({ ...API_INSPECTION, version: 4 }, context).version).toBe(4);
  });

  it('converte todos os status da API', () => {
    const expected: Record<ApiInspection['status'], string> = {
      DRAFT: 'RASCUNHO',
      ASSIGNED: 'ATRIBUIDA',
      IN_PROGRESS: 'EM_ANDAMENTO',
      SUBMITTED: 'ENVIADA',
      UNDER_REVIEW: 'EM_REVISAO',
      APPROVED: 'APROVADA',
      REJECTED: 'REPROVADA',
      CANCELED: 'CANCELADA',
    };

    for (const [api, app] of Object.entries(expected)) {
      expect(toInspection({ ...API_INSPECTION, status: api as ApiInspection['status'] }, context).status).toBe(app);
    }
  });

  it('converte as prioridades; CRITICAL aparece como Alta (a tela só tem três níveis)', () => {
    const priority = (p: ApiInspection['priority']) => toInspection({ ...API_INSPECTION, priority: p }, context).prioridade;

    expect(priority('LOW')).toBe('BAIXA');
    expect(priority('MEDIUM')).toBe('MEDIA');
    expect(priority('HIGH')).toBe('ALTA');
    expect(priority('CRITICAL')).toBe('ALTA');
  });

  it('instruções nulas viram "sem orientações"', () => {
    expect(toInspection({ ...API_INSPECTION, instructions: null }, context).orientacoes).toBeUndefined();
  });
});

describe('scheduleInspection (API)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    setAuthToken(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('faz POST /inspections com o corpo da API e devolve a inspeção da tela', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, API_INSPECTION));
    global.fetch = fetchMock;

    const inspection = await scheduleInspection(INPUT, 'ver-1', 3);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/inspections$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(toScheduleBody(INPUT, 'ver-1'));
    expect(inspection).toMatchObject({ id: 'ins-1', status: 'ATRIBUIDA', modeloId: 'mod-1', modeloVersao: 3, equipamentoId: 'eq-1' });
  });

  it('traduz os erros do agendamento para português', async () => {
    const error = (status: number, code: string) => jsonResponse(status, { status, code, message: 'english' });
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(error(409, 'TEMPLATE_VERSION_NOT_PUBLISHED'))
      .mockResolvedValueOnce(error(409, 'SITE_CLIENT_MISMATCH'))
      .mockResolvedValueOnce(error(404, 'TECHNICIAN_NOT_FOUND'))
      .mockResolvedValueOnce(error(409, 'TECHNICIAN_ROLE_INVALID'))
      .mockResolvedValueOnce(error(409, 'TECHNICIAN_NOT_ACTIVE'))
      .mockResolvedValueOnce(error(404, 'CLIENT_NOT_FOUND'))
      .mockResolvedValueOnce(error(404, 'SITE_NOT_FOUND'));

    const messages: string[] = [];
    for (let i = 0; i < 7; i++) {
      messages.push(await scheduleInspection(INPUT, 'ver-1', 3).catch((e) => e.message));
    }

    expect(messages).toEqual([
      'Este modelo não tem uma versão publicada disponível para novas inspeções (RN-024).',
      'O local escolhido não pertence ao cliente selecionado.',
      'Técnico não encontrado. Ele pode ter sido removido.',
      'O usuário escolhido não é um técnico.',
      'Somente técnicos ativos podem receber uma nova atribuição (RN-027).',
      'Cliente não encontrado. Ele pode ter sido removido.',
      'Local não encontrado. Ele pode ter sido removido.',
    ]);
  });

  it('erros de validação (data não futura) usam as mensagens dos campos', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(400, {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        fieldErrors: [{ field: 'scheduledFor', message: 'deve ser uma data futura' }],
      })
    );

    await expect(scheduleInspection(INPUT, 'ver-1', 3)).rejects.toMatchObject({ status: 400, message: 'deve ser uma data futura' });
  });

  describe('troca de técnico', () => {
    it('toAssignmentUpdate converte só o que muda (técnico, status e version)', () => {
      expect(toAssignmentUpdate({ technicianId: 'tec-2', status: 'ASSIGNED', version: 3 })).toEqual({
        tecnicoId: 'tec-2',
        status: 'ATRIBUIDA',
        version: 3,
      });
    });

    it('faz PATCH /inspections/{id}/assignee com technicianId e o version', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ...API_INSPECTION, technicianId: 'tec-2', version: 1 }));
      global.fetch = fetchMock;

      const update = await assignInspection('ins-1', 'tec-2', 0);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toMatch(/\/inspections\/ins-1\/assignee$/);
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body)).toEqual({ technicianId: 'tec-2', version: 0 });
      expect(update).toEqual({ tecnicoId: 'tec-2', status: 'ATRIBUIDA', version: 1 });
    });

    it('traduz os erros da atribuição para português', async () => {
      const error = (status: number, code: string) => jsonResponse(status, { status, code, message: 'english' });
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(error(409, 'INSPECTION_NOT_ASSIGNABLE'))
        .mockResolvedValueOnce(error(409, 'VERSION_CONFLICT'))
        .mockResolvedValueOnce(error(409, 'TECHNICIAN_NOT_ACTIVE'))
        .mockResolvedValueOnce(error(404, 'TECHNICIAN_NOT_FOUND'));

      const messages: string[] = [];
      for (let i = 0; i < 4; i++) messages.push(await assignInspection('ins-1', 'tec-2', 0).catch((e) => e.message));

      expect(messages).toEqual([
        'Esta inspeção já não pode ser reatribuída no estado atual.',
        'Este registro foi alterado por outra pessoa. Os dados foram recarregados — tente de novo.',
        'Somente técnicos ativos podem receber uma nova atribuição (RN-027).',
        'Técnico não encontrado. Ele pode ter sido removido.',
      ]);
    });
  });

  it('cancela com PATCH /inspections/{id}/cancel e lê a trilha', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        ...API_INSPECTION,
        status: 'CANCELED',
        version: 2,
        canceledBy: 'sup-1',
        canceledAt: '2026-11-05T12:00:00Z',
        canceledReason: 'Cliente pediu',
      })
    );
    global.fetch = fetchMock;

    const inspection = await cancelInspection('ins-1', '  Cliente pediu  ', 1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/inspections\/ins-1\/cancel$/);
    expect(JSON.parse(init.body)).toEqual({ reason: 'Cliente pediu', version: 1 });
    expect(inspection.status).toBe('CANCELADA');
    expect(inspection.cancelamento).toMatchObject({ porId: 'sup-1', justificativa: 'Cliente pediu' });
  });

  it('lista inspeções com filtros e paginação', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { items: [API_INSPECTION], page: { page: 0, size: 20, totalElements: 1, totalPages: 1 } })
    );
    global.fetch = fetchMock;

    const page = await listInspections({
      page: 0,
      size: 20,
      sort: { field: 'scheduledFor', dir: 'asc' },
      q: '',
      filters: { status: 'ASSIGNED', clientId: 'cli-1', technicianId: 'tec-1', scheduledFrom: '2026-11-01T00:00:00.000Z' },
    });

    expect(String(fetchMock.mock.calls[0][0])).toContain('status=ASSIGNED');
    expect(String(fetchMock.mock.calls[0][0])).toContain('clientId=cli-1');
    expect(page.items[0]).toMatchObject({ id: 'ins-1', status: 'ATRIBUIDA', clienteId: 'cli-1' });
    expect(page.page.totalElements).toBe(1);
  });
});

const API_REVIEW_QUEUE_ITEM: ApiReviewQueueItem = {
  id: 'ins-rev-1',
  clientId: 'cli-1',
  clientName: 'Cliente Alpha',
  siteId: 'site-1',
  siteName: 'Planta Norte',
  technicianId: 'tec-1',
  technicianName: 'Ana Técnica',
  title: 'Checklist elétrico',
  priority: 'HIGH',
  submittedAt: '2026-11-09T12:00:00Z',
  scheduledFor: '2026-11-10T08:00:00Z',
};

describe('toReviewQueueItem', () => {
  it('mantém nomes da API e mapeia prioridade para a UI', () => {
    expect(toReviewQueueItem(API_REVIEW_QUEUE_ITEM)).toMatchObject({
      id: 'ins-rev-1',
      clientName: 'Cliente Alpha',
      siteName: 'Planta Norte',
      technicianName: 'Ana Técnica',
      title: 'Checklist elétrico',
      prioridade: 'ALTA',
      submittedAt: '2026-11-09T12:00:00Z',
    });
  });
});

describe('listReviewQueue', () => {
  beforeEach(() => setAuthToken('token-test'));
  afterEach(() => {
    setAuthToken(null);
    vi.unstubAllGlobals();
  });

  it('chama GET /inspections/review-queue com filtros e ordenação', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        items: [API_REVIEW_QUEUE_ITEM],
        page: { page: 0, size: 20, totalElements: 1, totalPages: 1 },
      })
    );
    global.fetch = fetchMock;

    const page = await listReviewQueue({
      page: 0,
      size: 20,
      sort: { field: 'submittedAt', dir: 'asc' },
      q: '',
      filters: {
        technicianId: 'tec-1',
        clientId: 'cli-1',
        submittedFrom: '2026-11-01T00:00:00.000Z',
        submittedTo: '2026-11-30T23:59:59.000Z',
      },
    });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/inspections/review-queue?');
    expect(url).toContain('sort=submittedAt%2Casc');
    expect(url).toContain('technicianId=tec-1');
    expect(url).toContain('clientId=cli-1');
    expect(url).toContain('submittedFrom=');
    expect(page.items[0]).toMatchObject({ id: 'ins-rev-1', clientName: 'Cliente Alpha', prioridade: 'ALTA' });
    expect(page.page.totalElements).toBe(1);
  });

  it('propaga 403 da fila', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(403, { status: 403, code: 'ACCESS_DENIED', message: 'Forbidden' }));
    await expect(
      listReviewQueue({ page: 0, size: 20, sort: { field: 'submittedAt', dir: 'asc' }, q: '', filters: {} })
    ).rejects.toMatchObject({ status: 403 } satisfies Partial<ApiError>);
  });
});

describe('fetchInspectionChecklist', () => {
  beforeEach(() => setAuthToken('token-test'));
  afterEach(() => {
    setAuthToken(null);
    vi.unstubAllGlobals();
  });

  it('chama GET /inspections/{id}/checklist e devolve as seções', async () => {
    const sections = [
      {
        title: 'Estrutura',
        order: 1,
        items: [
          {
            id: 'item-1',
            title: 'Sem trincas',
            responseType: 'CONFORMITY',
            required: true,
            conformity: 'CONFORMING',
            observation: 'Ok',
          },
        ],
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, sections));
    global.fetch = fetchMock;

    const result = await fetchInspectionChecklist('ins-1');

    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/inspections\/ins-1\/checklist$/);
    expect(result).toEqual(sections);
  });

  it('propaga 403 e 404', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(403, { status: 403, code: 'ACCESS_DENIED', message: 'Forbidden' }))
      .mockResolvedValueOnce(jsonResponse(404, { status: 404, code: 'INSPECTION_NOT_FOUND', message: 'Missing' }));

    await expect(fetchInspectionChecklist('ins-1')).rejects.toMatchObject({ status: 403 } satisfies Partial<ApiError>);
    await expect(fetchInspectionChecklist('ins-missing')).rejects.toMatchObject({ status: 404 } satisfies Partial<ApiError>);
  });
});
