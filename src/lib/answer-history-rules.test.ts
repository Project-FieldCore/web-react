import { describe, expect, it } from 'vitest';
import { describeSnapshot, historyForItem, snapshotFromApi, toRevision, type ApiResponseHistoryEntry } from './answer-history-rules';
import type { AnswerRevision } from '@/types';

const entry = (patch: Partial<ApiResponseHistoryEntry> = {}): ApiResponseHistoryEntry => ({
  id: 'h1',
  inspectionItemId: 'it1',
  action: 'UPDATED',
  previous: { conformity: 'CONFORMING' },
  current: { conformity: 'NON_CONFORMING', observation: 'vazamento' },
  changedBy: 'u1',
  changedByName: 'Carlos Técnico',
  changedAt: '2026-11-04T10:00:00Z',
  ...patch,
});

describe('snapshotFromApi', () => {
  it('traduz conformidade e observação', () => {
    expect(snapshotFromApi({ conformity: 'NOT_APPLICABLE', observation: ' ok ' })).toEqual({ conformity: 'NAO_APLICAVEL', observacao: ' ok ' });
  });
  it('escolhe o valor preenchido (texto, número, booleano, data)', () => {
    expect(snapshotFromApi({ valueText: 'abc' })?.value).toBe('abc');
    expect(snapshotFromApi({ valueNumber: 12.5 })?.value).toBe('12.5');
    expect(snapshotFromApi({ valueBoolean: false })?.value).toBe('Não');
    expect(snapshotFromApi({ valueDate: '2026-11-04' })?.value).toBe('2026-11-04');
  });
  it('ignora textos vazios e valores nulos', () => {
    expect(snapshotFromApi({ valueText: '  ', observation: '', conformity: null })).toEqual({});
    expect(snapshotFromApi(null)).toBeUndefined();
  });
});

describe('toRevision', () => {
  it('mapeia autor, data, antes e depois', () => {
    expect(toRevision('i1', entry())).toEqual({
      id: 'h1', inspectionId: 'i1', itemId: 'it1', autorNome: 'Carlos Técnico', autorId: 'u1',
      em: '2026-11-04T10:00:00Z',
      anterior: { conformity: 'CONFORME' },
      novo: { conformity: 'NAO_CONFORME', observacao: 'vazamento' },
    });
  });
  it('primeira resposta (CREATED) não tem "antes"', () => {
    const rev = toRevision('i1', entry({ action: 'CREATED', previous: null }));
    expect(rev.anterior).toBeUndefined();
  });
});

describe('describeSnapshot', () => {
  it('descreve conformidade, valor e observação', () => {
    expect(describeSnapshot({ conformity: 'NAO_CONFORME', observacao: 'vazamento' })).toBe('Não conforme · obs: vazamento');
    expect(describeSnapshot({ value: '42' })).toBe('42');
  });
  it('sem conteúdo vira "Sem resposta"', () => {
    expect(describeSnapshot(undefined)).toBe('Sem resposta');
    expect(describeSnapshot({})).toBe('Sem resposta');
  });
});

describe('historyForItem', () => {
  const rev = (id: string, itemId: string, em: string): AnswerRevision => ({ id, inspectionId: 'i1', itemId, autorNome: 'x', em, novo: {} });
  it('filtra por item e ordena da mais recente para a mais antiga', () => {
    const list = [rev('a', 'it1', '2026-11-01T00:00:00Z'), rev('b', 'it2', '2026-11-02T00:00:00Z'), rev('c', 'it1', '2026-11-03T00:00:00Z')];
    expect(historyForItem(list, 'it1').map((r) => r.id)).toEqual(['c', 'a']);
    expect(historyForItem(undefined, 'it1')).toEqual([]);
  });
});
