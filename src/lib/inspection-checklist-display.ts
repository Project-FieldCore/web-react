/**
 * Formatadores PT-BR do checklist de revisão (PBI-0057.2).
 * Conformidade usa enums da API (`CONFORMING`…), não os do store (`CONFORME`…).
 */

import type { ApiChecklistConformity, InspectionChecklistItem } from './inspections-api';

export const TEXT_DISPLAY_MAX = 500;

export type ConformityChrome = {
  label: string;
  dot: string;
  text: string;
};

const CONFORMITY_CHROME: Record<ApiChecklistConformity, ConformityChrome> = {
  CONFORMING: { label: 'Conforme', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  NON_CONFORMING: { label: 'Não conforme', dot: 'bg-red-500', text: 'text-red-600' },
  NOT_APPLICABLE: { label: 'Não aplicável', dot: 'bg-slate-300', text: 'text-slate-500' },
};

export function conformityChrome(conformity: string | null | undefined): ConformityChrome | null {
  if (!conformity) return null;
  return CONFORMITY_CHROME[conformity as ApiChecklistConformity] ?? null;
}

export function isChecklistUnanswered(item: Pick<
  InspectionChecklistItem,
  'valueText' | 'valueNumber' | 'valueBoolean' | 'valueDate' | 'conformity'
>): boolean {
  return (
    item.valueText == null &&
    item.valueNumber == null &&
    item.valueBoolean == null &&
    item.valueDate == null &&
    item.conformity == null
  );
}

function truncateText(value: string): { display: string; full: string } {
  if (value.length <= TEXT_DISPLAY_MAX) return { display: value, full: value };
  return { display: `${value.slice(0, TEXT_DISPLAY_MAX)}…`, full: value };
}

function formatBoolean(value: boolean): string {
  return value ? 'Sim' : 'Não';
}

function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    const [, y, m, d] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString('pt-BR');
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString('pt-BR');
  return value;
}

export type FormattedChecklistAnswer =
  | { kind: 'unanswered' }
  | { kind: 'conformity'; chrome: ConformityChrome }
  | { kind: 'value'; label: string; title?: string };

function firstFilledFallback(item: InspectionChecklistItem): FormattedChecklistAnswer | null {
  const chrome = conformityChrome(item.conformity);
  if (chrome) return { kind: 'conformity', chrome };
  if (item.valueBoolean != null) return { kind: 'value', label: formatBoolean(item.valueBoolean) };
  if (item.valueNumber != null) return { kind: 'value', label: formatNumber(item.valueNumber) };
  if (item.valueDate) return { kind: 'value', label: formatDate(item.valueDate) };
  if (item.valueText != null && item.valueText !== '') {
    const text = truncateText(item.valueText);
    return { kind: 'value', label: text.display, title: text.full !== text.display ? text.full : undefined };
  }
  return null;
}

/** Valor principal conforme `responseType`, com fallback defensivo. */
export function formatChecklistAnswer(item: InspectionChecklistItem): FormattedChecklistAnswer {
  if (isChecklistUnanswered(item)) return { kind: 'unanswered' };

  switch (item.responseType) {
    case 'CONFORMITY': {
      const chrome = conformityChrome(item.conformity);
      if (chrome) return { kind: 'conformity', chrome };
      return firstFilledFallback(item) ?? { kind: 'unanswered' };
    }
    case 'BOOLEAN': {
      if (item.valueBoolean != null) return { kind: 'value', label: formatBoolean(item.valueBoolean) };
      return firstFilledFallback(item) ?? { kind: 'unanswered' };
    }
    case 'NUMBER': {
      if (item.valueNumber != null) return { kind: 'value', label: formatNumber(item.valueNumber) };
      return firstFilledFallback(item) ?? { kind: 'unanswered' };
    }
    case 'DATE': {
      if (item.valueDate) return { kind: 'value', label: formatDate(item.valueDate) };
      return firstFilledFallback(item) ?? { kind: 'unanswered' };
    }
    case 'TEXT_SHORT':
    case 'TEXT_LONG':
    case 'SINGLE_CHOICE': {
      if (item.valueText != null && item.valueText !== '') {
        const text = truncateText(item.valueText);
        return { kind: 'value', label: text.display, title: text.full !== text.display ? text.full : undefined };
      }
      return firstFilledFallback(item) ?? { kind: 'unanswered' };
    }
    default:
      return firstFilledFallback(item) ?? { kind: 'unanswered' };
  }
}
