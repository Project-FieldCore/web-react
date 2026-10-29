import { describe, expect, it } from 'vitest';
import { PRIORITY_LABEL, formatDate, formatDateTime, formatInstructions, summarizeInstructions } from './inspection-display';

describe('PRIORITY_LABEL', () => {
  it('as três prioridades da tela têm rótulo em português', () => {
    expect(PRIORITY_LABEL).toEqual({ ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa' });
  });
});

describe('formatDate / formatDateTime', () => {
  it('formata dd/mm/aaaa e dd/mm/aaaa hh:mm (24 h) no fuso informado', () => {
    expect(formatDate('2026-11-04T19:10:00Z', 'UTC')).toBe('04/11/2026');
    expect(formatDateTime('2026-11-04T19:10:00Z', 'UTC')).toBe('04/11/2026 19:10');
  });

  it('respeita o fuso: a mesma data/hora muda no horário de Brasília', () => {
    expect(formatDateTime('2026-11-04T19:10:00Z', 'America/Sao_Paulo')).toBe('04/11/2026 16:10');
    expect(formatDateTime('2026-11-05T01:30:00Z', 'America/Sao_Paulo')).toBe('04/11/2026 22:30');
    expect(formatDate('2026-11-05T01:30:00Z', 'America/Sao_Paulo')).toBe('04/11/2026');
  });

  it('meia-noite aparece como 00:00 (não 24:00)', () => {
    expect(formatDateTime('2026-11-04T00:00:00Z', 'UTC')).toBe('04/11/2026 00:00');
  });

  it('mantém zeros à esquerda', () => {
    expect(formatDateTime('2026-01-02T03:04:00Z', 'UTC')).toBe('02/01/2026 03:04');
  });

  it('aceita o formato da API (com ou sem milissegundos e com deslocamento)', () => {
    expect(formatDateTime('2026-11-04T19:10:00.000Z', 'UTC')).toBe('04/11/2026 19:10');
    expect(formatDateTime('2026-11-04T16:10:00-03:00', 'UTC')).toBe('04/11/2026 19:10');
  });

  it('ausente ou inválida vira "—", nunca "Invalid Date"', () => {
    for (const value of [undefined, null, '', 'amanhã', '2026-13-45']) {
      expect(formatDate(value)).toBe('—');
      expect(formatDateTime(value)).toBe('—');
    }
  });
});

describe('formatInstructions', () => {
  it('apara as pontas e preserva as quebras de linha internas', () => {
    expect(formatInstructions('  Levar EPI\nConfirmar acesso  ')).toBe('Levar EPI\nConfirmar acesso');
  });

  it('vazio, só espaços ou ausente vira null', () => {
    expect(formatInstructions('')).toBeNull();
    expect(formatInstructions('   \n  ')).toBeNull();
    expect(formatInstructions(undefined)).toBeNull();
    expect(formatInstructions(null)).toBeNull();
  });
});

describe('summarizeInstructions', () => {
  it('texto curto não muda', () => {
    expect(summarizeInstructions('Levar EPI')).toBe('Levar EPI');
  });

  it('corta no limite e acrescenta reticências', () => {
    expect(summarizeInstructions('x'.repeat(10), 5)).toBe('xxxxx…');
    expect(summarizeInstructions('x'.repeat(5), 5)).toBe('xxxxx');
  });

  it('não deixa espaço antes das reticências', () => {
    expect(summarizeInstructions('Levar EPI completo', 10)).toBe('Levar EPI…');
  });

  it('vazio vira null', () => {
    expect(summarizeInstructions('   ')).toBeNull();
  });
});
