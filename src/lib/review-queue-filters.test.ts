import { describe, expect, it } from 'vitest';
import { isSubmittedPeriodInvalid, toSubmittedIso } from './review-queue-filters';

describe('toSubmittedIso', () => {
  it('converte datetime-local para ISO', () => {
    const iso = toSubmittedIso('2026-11-01T10:00');
    expect(iso).toMatch(/^2026-11-01T/);
  });

  it('omite vazio e inválido', () => {
    expect(toSubmittedIso('')).toBeUndefined();
    expect(toSubmittedIso('not-a-date')).toBeUndefined();
  });
});

describe('isSubmittedPeriodInvalid', () => {
  it('aceita período vazio ou parcial', () => {
    expect(isSubmittedPeriodInvalid('', '')).toBe(false);
    expect(isSubmittedPeriodInvalid('2026-11-02T10:00', '')).toBe(false);
    expect(isSubmittedPeriodInvalid('', '2026-11-01T10:00')).toBe(false);
  });

  it('detecta from > to', () => {
    expect(isSubmittedPeriodInvalid('2026-11-02T10:00', '2026-11-01T10:00')).toBe(true);
    expect(isSubmittedPeriodInvalid('2026-11-01T10:00', '2026-11-02T10:00')).toBe(false);
    expect(isSubmittedPeriodInvalid('2026-11-01T10:00', '2026-11-01T10:00')).toBe(false);
  });
});
