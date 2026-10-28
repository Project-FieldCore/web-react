import { describe, expect, it } from 'vitest';
import { applyItemPatch, missingEvidence, missingObservation, supportsFailureRules } from './item-rules';
import type { Answer, ModelItem } from '@/types';

const item = (over: Partial<ModelItem> = {}): ModelItem => ({
  id: 'i1',
  title: 'Item',
  type: 'CONFORMITY',
  required: false,
  evidenceRequiredOnFailure: false,
  observationRequiredOnFailure: false,
  ...over,
});
const answer = (over: Partial<Answer> = {}): Answer => ({ itemId: 'i1', evidenceCount: 0, ...over });

describe('supportsFailureRules', () => {
  it('só itens de conformidade têm "falha"', () => {
    expect(supportsFailureRules('CONFORMITY')).toBe(true);
    for (const type of ['TEXT_SHORT', 'TEXT_LONG', 'NUMBER', 'BOOLEAN', 'SINGLE_CHOICE', 'DATE'] as const) {
      expect(supportsFailureRules(type)).toBe(false);
    }
  });
});

describe('applyItemPatch', () => {
  it('aplica a alteração sem mexer no resto', () => {
    expect(applyItemPatch(item(), { title: 'Novo', required: true })).toEqual(item({ title: 'Novo', required: true }));
  });

  it('mudar para tipo sem "falha" desliga as duas flags e preserva as demais', () => {
    const result = applyItemPatch(
      item({ required: true, evidenceRequiredOnFailure: true, observationRequiredOnFailure: true }),
      { type: 'NUMBER' }
    );

    expect(result).toMatchObject({ type: 'NUMBER', required: true, evidenceRequiredOnFailure: false, observationRequiredOnFailure: false });
  });

  it('rejeita ligar flag "na falha" junto com um tipo sem "falha"', () => {
    const result = applyItemPatch(item(), { type: 'TEXT_LONG', observationRequiredOnFailure: true });

    expect(result.observationRequiredOnFailure).toBe(false);
  });

  it('não cria objeto novo à toa quando nada precisa mudar', () => {
    const base = item({ type: 'DATE' });
    const result = applyItemPatch(base, {});

    expect(result).toEqual(base);
  });

  it('mantém as alternativas (a limpeza é feita ao enviar à API)', () => {
    const result = applyItemPatch(item({ type: 'SINGLE_CHOICE', options: ['A', 'B'] }), { required: true });

    expect(result.options).toEqual(['A', 'B']);
  });
});

describe('missingObservation', () => {
  const flagged = item({ observationRequiredOnFailure: true });

  it('não conforme sem observação (ou só espaços) falta observação', () => {
    expect(missingObservation(flagged, answer({ conformity: 'NAO_CONFORME' }))).toBe(true);
    expect(missingObservation(flagged, answer({ conformity: 'NAO_CONFORME', observacao: '   ' }))).toBe(true);
  });

  it('com observação, conforme, sem resposta ou sem a flag não falta nada', () => {
    expect(missingObservation(flagged, answer({ conformity: 'NAO_CONFORME', observacao: 'Trinca' }))).toBe(false);
    expect(missingObservation(flagged, answer({ conformity: 'CONFORME' }))).toBe(false);
    expect(missingObservation(flagged, undefined)).toBe(false);
    expect(missingObservation(item(), answer({ conformity: 'NAO_CONFORME' }))).toBe(false);
  });
});

describe('missingEvidence', () => {
  it('exige pelo menos uma evidência quando a flag está ligada', () => {
    const flagged = item({ evidenceRequiredOnFailure: true });

    expect(missingEvidence(flagged, 0)).toBe(true);
    expect(missingEvidence(flagged, undefined)).toBe(true);
    expect(missingEvidence(flagged, 1)).toBe(false);
  });

  it('sem a flag, nunca falta evidência', () => {
    expect(missingEvidence(item(), 0)).toBe(false);
  });
});
