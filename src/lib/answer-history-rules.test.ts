import { describe, expect, it } from 'vitest';
import { buildRevision, describeSnapshot, historyForItem, toSnapshot } from './answer-history-rules';
import type { Answer, AnswerRevision } from '@/types';

const AUTOR = { id: 'u1', nome: 'Marina Costa' };
const base = { id: 'rev-1', inspectionId: 'i1', itemId: 'it1', autor: AUTOR, em: '2026-11-04T10:00:00.000Z' };
const answer = (patch: Partial<Answer> = {}): Answer => ({ itemId: 'it1', evidenceCount: 0, ...patch });

describe('toSnapshot', () => {
  it('guarda só o que foi respondido, ignorando fotos e evidências', () => {
    expect(toSnapshot(answer({ conformity: 'CONFORME', observacao: ' ok ', photos: ['x'], evidenceCount: 2 })))
      .toEqual({ conformity: 'CONFORME', observacao: ' ok ' });
    expect(toSnapshot(answer({ value: '   ' }))).toEqual({});
    expect(toSnapshot(undefined)).toBeUndefined();
  });
});

describe('describeSnapshot', () => {
  it('descreve conformidade, valor e observação', () => {
    expect(describeSnapshot({ conformity: 'NAO_CONFORME', observacao: 'vazamento' })).toBe('Não conforme · obs: vazamento');
    expect(describeSnapshot({ conformity: 'NAO_APLICAVEL' })).toBe('Não aplicável');
    expect(describeSnapshot({ value: '42 bar' })).toBe('42 bar');
  });
  it('mostra "Sem resposta" quando não há conteúdo', () => {
    expect(describeSnapshot(undefined)).toBe('Sem resposta');
    expect(describeSnapshot({})).toBe('Sem resposta');
  });
});

describe('buildRevision', () => {
  it('primeira resposta: sem valor anterior', () => {
    const r = buildRevision({ ...base, previous: undefined, next: answer({ conformity: 'CONFORME' }) });
    expect(r).toMatchObject({ autorNome: 'Marina Costa', autorId: 'u1', em: base.em, anterior: undefined, novo: { conformity: 'CONFORME' } });
  });
  it('alteração: guarda antes e depois', () => {
    const r = buildRevision({ ...base, previous: answer({ conformity: 'CONFORME' }), next: answer({ conformity: 'NAO_CONFORME' }) });
    expect(r?.anterior).toEqual({ conformity: 'CONFORME' });
    expect(r?.novo).toEqual({ conformity: 'NAO_CONFORME' });
  });
  it('não gera revisão quando nada mudou (mesmo mudando só fotos/evidências)', () => {
    const prev = answer({ conformity: 'CONFORME' });
    expect(buildRevision({ ...base, previous: prev, next: { ...prev, evidenceCount: 3, photos: ['a'] } })).toBeUndefined();
  });
  it('sem usuário logado, o autor é "Sistema"', () => {
    const r = buildRevision({ ...base, autor: null, previous: undefined, next: answer({ value: 'x' }) });
    expect(r).toMatchObject({ autorNome: 'Sistema', autorId: undefined });
  });
});

describe('historyForItem', () => {
  const rev = (id: string, itemId: string, em: string): AnswerRevision => ({ id, inspectionId: 'i1', itemId, autorNome: 'A', em, novo: {} });
  it('filtra por item e ordena da mais recente para a mais antiga', () => {
    const list = [rev('a', 'it1', '2026-11-01T00:00:00Z'), rev('b', 'it2', '2026-11-02T00:00:00Z'), rev('c', 'it1', '2026-11-03T00:00:00Z')];
    expect(historyForItem(list, 'it1').map((r) => r.id)).toEqual(['c', 'a']);
    expect(historyForItem(undefined, 'it1')).toEqual([]);
  });
});
