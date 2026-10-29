import { describe, expect, it } from 'vitest';
import { MAX_JUSTIFICATION, buildCancellation, canCancel, cancelBlockedReason, validateJustification } from './cancel-rules';
import type { InspectionStatus } from '@/types';

const ALL: InspectionStatus[] = ['RASCUNHO', 'ATRIBUIDA', 'EM_ANDAMENTO', 'ENVIADA', 'EM_REVISAO', 'DEVOLVIDA', 'APROVADA', 'REPROVADA', 'CANCELADA'];

describe('cancelBlockedReason / canCancel', () => {
  it('aprovada não cancela pelo fluxo comum (RN-030)', () => {
    expect(cancelBlockedReason('APROVADA')).toBe('Inspeção aprovada não pode ser cancelada pelo fluxo comum (RN-030).');
    expect(canCancel('APROVADA')).toBe(false);
  });

  it('já cancelada não cancela de novo', () => {
    expect(cancelBlockedReason('CANCELADA')).toBe('Esta inspeção já está cancelada.');
    expect(canCancel('CANCELADA')).toBe(false);
  });

  it('os demais estados podem ser cancelados', () => {
    for (const status of ALL.filter((s) => s !== 'APROVADA' && s !== 'CANCELADA')) {
      expect(cancelBlockedReason(status)).toBeNull();
      expect(canCancel(status)).toBe(true);
    }
  });

  it('só dois estados bloqueiam (nenhum estado novo fica de fora sem decisão)', () => {
    expect(ALL.filter((s) => !canCancel(s))).toEqual(['APROVADA', 'CANCELADA']);
  });
});

describe('validateJustification (RN-029)', () => {
  it('é obrigatória: vazia ou só com espaços e quebras de linha é recusada', () => {
    const message = 'Informe a justificativa do cancelamento (RN-029).';

    expect(validateJustification('')).toBe(message);
    expect(validateJustification('   ')).toBe(message);
    expect(validateJustification('\n \t\n')).toBe(message);
  });

  it('texto preenchido é válido', () => {
    expect(validateJustification('Cliente pediu o cancelamento.')).toBeNull();
    expect(validateJustification('x')).toBeNull();
  });

  it('respeita o limite de 1000 caracteres, sem contar espaços nas pontas', () => {
    expect(MAX_JUSTIFICATION).toBe(1000);
    expect(validateJustification('x'.repeat(1000))).toBeNull();
    expect(validateJustification(`  ${'x'.repeat(1000)}  `)).toBeNull();
    expect(validateJustification('x'.repeat(1001))).toBe('A justificativa deve ter no máximo 1000 caracteres.');
  });
});

describe('buildCancellation (RN-029)', () => {
  const NOW = new Date('2026-10-30T15:20:00.000Z');

  it('registra quem, quando e a justificativa aparada', () => {
    expect(buildCancellation({ id: 'usr-1', nome: 'Marina Costa' }, '  Equipamento desativado.  ', NOW)).toEqual({
      porNome: 'Marina Costa',
      porId: 'usr-1',
      em: '2026-10-30T15:20:00.000Z',
      justificativa: 'Equipamento desativado.',
    });
  });

  it('preserva as quebras de linha internas', () => {
    expect(buildCancellation({ nome: 'Ana' }, 'Linha 1\nLinha 2', NOW).justificativa).toBe('Linha 1\nLinha 2');
  });

  it('usa a hora atual quando não recebe uma', () => {
    const before = Date.now();
    const { em } = buildCancellation({ nome: 'Ana' }, 'Motivo');

    expect(new Date(em).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(em).getTime()).toBeLessThanOrEqual(Date.now());
  });
});
