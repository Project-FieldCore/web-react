import type { Priority } from '@/types';

/**
 * Como prioridade, data prevista (prazo) e instruções de uma inspeção são
 * mostradas no painel (PBI-0028.1). Lógica pura, sem React, para ser testável.
 */

export const PRIORITY_LABEL: Record<Priority, string> = { ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa' };

const EMPTY = '—';

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parts(date: Date, timeZone?: string): Record<string, string> {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  });
  return Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
}

/** `dd/mm/aaaa` no fuso local (ou em `timeZone`); "—" quando falta ou é inválida (nunca "Invalid Date"). */
export function formatDate(value: string | null | undefined, timeZone?: string): string {
  const date = parse(value);
  if (!date) return EMPTY;
  const p = parts(date, timeZone);
  return `${p.day}/${p.month}/${p.year}`;
}

/** `dd/mm/aaaa hh:mm` (24 h); "—" quando falta ou é inválida. */
export function formatDateTime(value: string | null | undefined, timeZone?: string): string {
  const date = parse(value);
  if (!date) return EMPTY;
  const p = parts(date, timeZone);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** Orientações sem espaços nas pontas, ou null quando vazias. */
export function formatInstructions(text: string | null | undefined): string | null {
  const trimmed = text?.trim();
  return trimmed ? trimmed : null;
}

/** Versão curta para resumos: corta no limite e acrescenta "…". */
export function summarizeInstructions(text: string | null | undefined, max = 140): string | null {
  const full = formatInstructions(text);
  if (!full) return null;
  return full.length > max ? `${full.slice(0, max).trimEnd()}…` : full;
}
