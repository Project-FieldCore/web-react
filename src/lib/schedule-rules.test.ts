import { describe, expect, it } from 'vitest';
import {
  buildLocalInspection,
  isLocalOnlySchedule,
  missingScheduleFields,
  validateInstructions,
  validateSchedule,
  validateScheduleDate,
  type ScheduleFormValues,
} from './schedule-rules';

const NOW = new Date('2026-10-28T12:00:00.000Z');
const values = (over: Partial<ScheduleFormValues> = {}): ScheduleFormValues => ({
  modeloId: 'mod-1',
  clienteId: 'cli-1',
  localId: 'loc-1',
  tecnicoId: 'tec-1',
  dataPrevista: '2026-11-01T10:00:00.000Z',
  ...over,
});

describe('missingScheduleFields (RN-025)', () => {
  it('formulário completo não falta nada', () => {
    expect(missingScheduleFields(values())).toEqual([]);
  });

  it('lista o que falta, na ordem da tela', () => {
    expect(missingScheduleFields(values({ modeloId: '', clienteId: '', localId: '', tecnicoId: '', dataPrevista: '' }))).toEqual([
      'Modelo',
      'Cliente',
      'Local',
      'Técnico',
      'Data prevista',
    ]);
  });

  it('cada campo é cobrado sozinho', () => {
    expect(missingScheduleFields(values({ tecnicoId: '' }))).toEqual(['Técnico']);
    expect(missingScheduleFields(values({ dataPrevista: '' }))).toEqual(['Data prevista']);
  });
});

describe('validateScheduleDate', () => {
  it('sem data não é erro de data (o campo obrigatório é outro aviso)', () => {
    expect(validateScheduleDate('', NOW)).toBeNull();
  });

  it('data futura é válida', () => {
    expect(validateScheduleDate('2026-10-28T12:00:01.000Z', NOW)).toBeNull();
    expect(validateScheduleDate('2027-01-01T00:00:00.000Z', NOW)).toBeNull();
  });

  it('data passada e o instante atual são recusados (a API exige futuro)', () => {
    expect(validateScheduleDate('2026-10-28T11:59:59.000Z', NOW)).toBe('A data prevista precisa estar no futuro.');
    expect(validateScheduleDate('2026-10-28T12:00:00.000Z', NOW)).toBe('A data prevista precisa estar no futuro.');
  });

  it('data inválida é recusada', () => {
    expect(validateScheduleDate('amanhã', NOW)).toBe('Informe uma data e hora válidas.');
  });

  it('aceita o valor do campo datetime-local (sem fuso)', () => {
    expect(validateScheduleDate('2099-01-01T10:00', NOW)).toBeNull();
    expect(validateScheduleDate('2000-01-01T10:00', NOW)).toBe('A data prevista precisa estar no futuro.');
  });
});

describe('validateInstructions', () => {
  it('até 2000 caracteres (ignorando espaços nas pontas) é válido', () => {
    expect(validateInstructions(undefined)).toBeNull();
    expect(validateInstructions('')).toBeNull();
    expect(validateInstructions('x'.repeat(2000))).toBeNull();
    expect(validateInstructions(`  ${'x'.repeat(2000)}  `)).toBeNull();
  });

  it('acima de 2000 é recusado', () => {
    expect(validateInstructions('x'.repeat(2001))).toBe('As orientações devem ter no máximo 2000 caracteres.');
  });
});

describe('validateSchedule', () => {
  it('tudo certo: nenhum problema', () => {
    expect(validateSchedule(values(), NOW)).toBeNull();
  });

  it('campos obrigatórios vêm primeiro', () => {
    const message = 'Cliente, local e data prevista são obrigatórios (RN-025).';

    expect(validateSchedule(values({ clienteId: '' }), NOW)).toBe(message);
    expect(validateSchedule(values({ localId: '' }), NOW)).toBe(message);
    expect(validateSchedule(values({ dataPrevista: '' }), NOW)).toBe(message);
  });

  it('depois, a data; depois, as orientações', () => {
    expect(validateSchedule(values({ dataPrevista: '2020-01-01T00:00:00.000Z' }), NOW)).toBe('A data prevista precisa estar no futuro.');
    expect(validateSchedule(values({ orientacoes: 'x'.repeat(2001) }), NOW)).toBe('As orientações devem ter no máximo 2000 caracteres.');
    expect(validateSchedule(values({ dataPrevista: '2020-01-01T00:00:00.000Z', orientacoes: 'x'.repeat(2001) }), NOW)).toBe(
      'A data prevista precisa estar no futuro.'
    );
  });
});

describe('isLocalOnlySchedule', () => {
  it('só quem tem o id da versão na API é agendado pela API', () => {
    expect(isLocalOnlySchedule({ templateVersionId: undefined })).toBe(true);
    expect(isLocalOnlySchedule({ templateVersionId: '' })).toBe(true);
    expect(isLocalOnlySchedule(undefined)).toBe(true);
    expect(isLocalOnlySchedule({ templateVersionId: 'ver-1' })).toBe(false);
  });
});

describe('buildLocalInspection', () => {
  const input = {
    modeloId: 'mod-1',
    clienteId: 'cli-1',
    localId: 'loc-1',
    equipamentoId: 'eq-1',
    tecnicoId: 'tec-1',
    prioridade: 'ALTA' as const,
    dataPrevista: '2026-11-01T10:00:00.000Z',
    orientacoes: '  Levar EPI  ',
  };

  it('nasce ATRIBUÍDA, com a versão do modelo e o checklist vazio', () => {
    expect(buildLocalInspection(input, { version: 3 }, 'INS-1234')).toEqual({
      id: 'INS-1234',
      clienteId: 'cli-1',
      localId: 'loc-1',
      equipamentoId: 'eq-1',
      modeloId: 'mod-1',
      modeloVersao: 3,
      tecnicoId: 'tec-1',
      prioridade: 'ALTA',
      dataPrevista: '2026-11-01T10:00:00.000Z',
      orientacoes: 'Levar EPI',
      status: 'ATRIBUIDA',
      answers: {},
      nonConformities: {},
    });
  });

  it('orientações vazias não são guardadas', () => {
    expect(buildLocalInspection({ ...input, orientacoes: '   ' }, { version: 1 }, 'INS-1').orientacoes).toBeUndefined();
  });
});
