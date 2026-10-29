import { describe, expect, it } from 'vitest';
import {
  hasUniqueOrder,
  moveSection,
  nextDisplayOrder,
  normalizeSectionOrder,
  toOrderPayload,
} from './section-order';
import type { ModelSection } from '@/types';

const section = (id: string, displayOrder: number): ModelSection => ({ id, title: `Seção ${id}`, displayOrder, items: [] });
const ids = (sections: ModelSection[]) => sections.map((s) => s.id);
const orders = (sections: ModelSection[]) => sections.map((s) => s.displayOrder);

describe('normalizeSectionOrder', () => {
  it('ordena por displayOrder e renumera 0..n-1 (corrige lacunas)', () => {
    const result = normalizeSectionOrder([section('c', 7), section('a', 2), section('b', 4)]);

    expect(ids(result)).toEqual(['a', 'b', 'c']);
    expect(orders(result)).toEqual([0, 1, 2]);
  });

  it('corrige ordens repetidas mantendo a ordem relativa (ordenação estável)', () => {
    const result = normalizeSectionOrder([section('a', 1), section('b', 1), section('c', 0)]);

    expect(ids(result)).toEqual(['c', 'a', 'b']);
    expect(orders(result)).toEqual([0, 1, 2]);
  });

  it('não altera a lista de entrada', () => {
    const input = [section('b', 5), section('a', 1)];
    normalizeSectionOrder(input);

    expect(ids(input)).toEqual(['b', 'a']);
    expect(orders(input)).toEqual([5, 1]);
  });

  it('lista vazia continua vazia', () => {
    expect(normalizeSectionOrder([])).toEqual([]);
  });
});

describe('nextDisplayOrder', () => {
  it('começa em 0 e vai para o fim (maior ordem + 1)', () => {
    expect(nextDisplayOrder([])).toBe(0);
    expect(nextDisplayOrder([section('a', 0), section('b', 1)])).toBe(2);
    expect(nextDisplayOrder([section('a', 0), section('b', 5)])).toBe(6);
  });
});

describe('moveSection', () => {
  const base = () => [section('a', 0), section('b', 1), section('c', 2)];

  it('sobe: troca com a seção de cima e renumera', () => {
    const result = moveSection(base(), 'b', 'up');

    expect(ids(result)).toEqual(['b', 'a', 'c']);
    expect(orders(result)).toEqual([0, 1, 2]);
  });

  it('desce: troca com a seção de baixo e renumera', () => {
    const result = moveSection(base(), 'b', 'down');

    expect(ids(result)).toEqual(['a', 'c', 'b']);
    expect(orders(result)).toEqual([0, 1, 2]);
  });

  it('na primeira não sobe e na última não desce (devolve a mesma lista)', () => {
    const sections = base();

    expect(moveSection(sections, 'a', 'up')).toBe(sections);
    expect(moveSection(sections, 'c', 'down')).toBe(sections);
  });

  it('id desconhecido devolve a mesma lista', () => {
    const sections = base();

    expect(moveSection(sections, 'nao-existe', 'up')).toBe(sections);
  });

  it('com uma única seção não há o que mover', () => {
    const sections = [section('a', 0)];

    expect(moveSection(sections, 'a', 'up')).toBe(sections);
    expect(moveSection(sections, 'a', 'down')).toBe(sections);
  });

  it('a ordem continua única depois de várias trocas', () => {
    let sections = [section('a', 0), section('b', 1), section('c', 2), section('d', 3)];
    sections = moveSection(sections, 'd', 'up');
    sections = moveSection(sections, 'd', 'up');
    sections = moveSection(sections, 'a', 'down');

    expect(ids(sections)).toEqual(['d', 'a', 'b', 'c']);
    expect(orders(sections)).toEqual([0, 1, 2, 3]);
    expect(hasUniqueOrder(sections)).toBe(true);
  });

  it('corrige uma lista com lacunas antes de mover', () => {
    const result = moveSection([section('a', 3), section('b', 9)], 'b', 'up');

    expect(ids(result)).toEqual(['b', 'a']);
    expect(orders(result)).toEqual([0, 1]);
  });

  it('não altera a lista de entrada', () => {
    const sections = base();
    moveSection(sections, 'b', 'up');

    expect(ids(sections)).toEqual(['a', 'b', 'c']);
  });
});

describe('hasUniqueOrder / toOrderPayload', () => {
  it('detecta ordem repetida', () => {
    expect(hasUniqueOrder([section('a', 0), section('b', 1)])).toBe(true);
    expect(hasUniqueOrder([section('a', 1), section('b', 1)])).toBe(false);
  });

  it('o corpo de reordenar é a lista completa, ordenada, com ordens únicas', () => {
    expect(toOrderPayload([section('b', 4), section('a', 2)])).toEqual([
      { sectionId: 'a', displayOrder: 0 },
      { sectionId: 'b', displayOrder: 1 },
    ]);
  });
});
