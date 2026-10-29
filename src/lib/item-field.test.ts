import { describe, expect, it } from 'vitest';
import {
  BOOLEAN_CHOICES,
  CONFORMITY_CHOICES,
  choiceOptions,
  failureRequirements,
  fieldKind,
  showsFailureDetails,
} from './item-field';
import type { ItemType, ModelItem } from '@/types';

const item = (over: Partial<ModelItem> = {}): ModelItem => ({
  id: 'i1',
  title: 'Item',
  type: 'CONFORMITY',
  required: false,
  evidenceRequiredOnFailure: false,
  observationRequiredOnFailure: false,
  ...over,
});

describe('fieldKind', () => {
  it('cada um dos 7 tipos de resposta tem um controle próprio', () => {
    const expected: Record<ItemType, string> = {
      TEXT_SHORT: 'text',
      TEXT_LONG: 'textarea',
      NUMBER: 'number',
      DATE: 'date',
      BOOLEAN: 'boolean',
      CONFORMITY: 'conformity',
      SINGLE_CHOICE: 'choice',
    };

    for (const [type, kind] of Object.entries(expected)) {
      expect(fieldKind(type as ItemType)).toBe(kind);
    }
    expect(new Set(Object.values(expected)).size).toBe(7);
  });

  it('tipo desconhecido falha de forma explícita, em vez de renderizar errado', () => {
    expect(() => fieldKind('ASSINATURA' as ItemType)).toThrow('Tipo de resposta sem componente');
  });
});

describe('opções fixas', () => {
  it('conformidade tem as 3 respostas e sim/não tem 2', () => {
    expect(CONFORMITY_CHOICES.map((c) => c.value)).toEqual(['CONFORME', 'NAO_CONFORME', 'NAO_APLICAVEL']);
    expect(BOOLEAN_CHOICES.map((c) => c.value)).toEqual(['true', 'false']);
  });
});

describe('choiceOptions', () => {
  it('apara e descarta alternativas vazias', () => {
    expect(choiceOptions(item({ type: 'SINGLE_CHOICE', options: [' Boa ', '', '  ', 'Ruim'] }))).toEqual(['Boa', 'Ruim']);
  });

  it('sem alternativas devolve lista vazia', () => {
    expect(choiceOptions(item({ type: 'SINGLE_CHOICE' }))).toEqual([]);
  });
});

describe('showsFailureDetails', () => {
  it('só aparece em item de conformidade respondido "não conforme"', () => {
    expect(showsFailureDetails(item(), { conformity: 'NAO_CONFORME' })).toBe(true);
    expect(showsFailureDetails(item(), { conformity: 'CONFORME' })).toBe(false);
    expect(showsFailureDetails(item(), { conformity: 'NAO_APLICAVEL' })).toBe(false);
    expect(showsFailureDetails(item(), undefined)).toBe(false);
  });

  it('nunca aparece em outros tipos, mesmo com a flag ligada', () => {
    const number = item({ type: 'NUMBER', observationRequiredOnFailure: true });

    expect(showsFailureDetails(number, { conformity: 'NAO_CONFORME' })).toBe(false);
  });
});

describe('failureRequirements', () => {
  it('reflete as flags do item', () => {
    expect(failureRequirements(item())).toEqual({ observation: false, evidence: false });
    expect(failureRequirements(item({ observationRequiredOnFailure: true, evidenceRequiredOnFailure: true }))).toEqual({
      observation: true,
      evidence: true,
    });
  });
});
