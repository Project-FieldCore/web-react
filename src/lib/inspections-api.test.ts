import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduleInspection, toInspection, toScheduleBody, type ApiInspection, type ScheduleInspectionInput } from './inspections-api';
import { setAuthToken } from './auth-token';

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
    });
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
});
