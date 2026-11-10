import { describe, expect, it } from 'vitest';
import {
  formatChecklistAnswer,
  isChecklistUnanswered,
  TEXT_DISPLAY_MAX,
} from './inspection-checklist-display';
import type { InspectionChecklistItem } from './inspections-api';

function item(over: Partial<InspectionChecklistItem> = {}): InspectionChecklistItem {
  return {
    id: 'item-1',
    title: 'Item',
    responseType: 'TEXT_SHORT',
    required: false,
    ...over,
  };
}

describe('isChecklistUnanswered', () => {
  it('exige todos os campos de valor nulos', () => {
    expect(isChecklistUnanswered(item())).toBe(true);
    expect(isChecklistUnanswered(item({ valueText: 'ok' }))).toBe(false);
    expect(isChecklistUnanswered(item({ conformity: 'CONFORMING' }))).toBe(false);
  });
});

describe('formatChecklistAnswer', () => {
  it('formata conformidade com enums da API', () => {
    expect(formatChecklistAnswer(item({ responseType: 'CONFORMITY', conformity: 'CONFORMING' }))).toEqual({
      kind: 'conformity',
      chrome: { label: 'Conforme', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    });
    expect(formatChecklistAnswer(item({ responseType: 'CONFORMITY', conformity: 'NON_CONFORMING' }))).toMatchObject({
      kind: 'conformity',
      chrome: { label: 'Não conforme' },
    });
    expect(formatChecklistAnswer(item({ responseType: 'CONFORMITY', conformity: 'NOT_APPLICABLE' }))).toMatchObject({
      kind: 'conformity',
      chrome: { label: 'Não aplicável' },
    });
  });

  it('formata boolean, número e data em pt-BR', () => {
    expect(formatChecklistAnswer(item({ responseType: 'BOOLEAN', valueBoolean: true }))).toEqual({
      kind: 'value',
      label: 'Sim',
    });
    expect(formatChecklistAnswer(item({ responseType: 'BOOLEAN', valueBoolean: false }))).toEqual({
      kind: 'value',
      label: 'Não',
    });
    expect(formatChecklistAnswer(item({ responseType: 'NUMBER', valueNumber: 12.5 }))).toEqual({
      kind: 'value',
      label: (12.5).toLocaleString('pt-BR'),
    });
    expect(formatChecklistAnswer(item({ responseType: 'DATE', valueDate: '2026-11-09' }))).toEqual({
      kind: 'value',
      label: new Date(2026, 10, 9).toLocaleDateString('pt-BR'),
    });
  });

  it('trunca texto longo e marca unanswered', () => {
    const long = 'a'.repeat(TEXT_DISPLAY_MAX + 10);
    const formatted = formatChecklistAnswer(item({ responseType: 'TEXT_LONG', valueText: long }));
    expect(formatted.kind).toBe('value');
    if (formatted.kind === 'value') {
      expect(formatted.label.endsWith('…')).toBe(true);
      expect(formatted.title).toBe(long);
    }
    expect(formatChecklistAnswer(item())).toEqual({ kind: 'unanswered' });
  });

  it('faz fallback quando o campo tipado falta', () => {
    expect(formatChecklistAnswer(item({ responseType: 'NUMBER', valueText: '12' }))).toEqual({
      kind: 'value',
      label: '12',
    });
  });
});
