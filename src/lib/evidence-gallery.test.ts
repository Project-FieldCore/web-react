import { describe, expect, it } from 'vitest';
import {
  evidencesForItem,
  groupEvidencesBySection,
  isSupportedEvidenceImage,
  sortEvidences,
} from './evidence-gallery';
import type { MonitoringEvidence } from './inspections-api';

function evidence(over: Partial<MonitoringEvidence> & Pick<MonitoringEvidence, 'id'>): MonitoringEvidence {
  return {
    inspectionItemId: 'item-1',
    itemTitle: 'Item',
    sectionTitle: 'Seção',
    sectionOrder: 1,
    itemOrder: 1,
    fileName: 'a.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 1000,
    createdAt: '2026-11-01T10:00:00Z',
    ...over,
  };
}

describe('isSupportedEvidenceImage', () => {
  it('aceita jpeg/png/webp', () => {
    expect(isSupportedEvidenceImage('image/jpeg')).toBe(true);
    expect(isSupportedEvidenceImage('image/png')).toBe(true);
    expect(isSupportedEvidenceImage('image/webp')).toBe(true);
    expect(isSupportedEvidenceImage('application/pdf')).toBe(false);
  });
});

describe('sortEvidences', () => {
  it('ordena por sectionOrder → itemOrder → createdAt', () => {
    const sorted = sortEvidences([
      evidence({ id: 'c', sectionOrder: 2, itemOrder: 1, createdAt: '2026-11-02T10:00:00Z' }),
      evidence({ id: 'b', sectionOrder: 1, itemOrder: 2, createdAt: '2026-11-01T12:00:00Z' }),
      evidence({ id: 'a', sectionOrder: 1, itemOrder: 1, createdAt: '2026-11-01T11:00:00Z' }),
      evidence({ id: 'a2', sectionOrder: 1, itemOrder: 1, createdAt: '2026-11-01T10:00:00Z' }),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['a2', 'a', 'b', 'c']);
  });
});

describe('groupEvidencesBySection', () => {
  it('agrupa por seção na ordem', () => {
    const sorted = sortEvidences([
      evidence({ id: '1', sectionOrder: 1, sectionTitle: 'A', itemOrder: 1 }),
      evidence({ id: '2', sectionOrder: 1, sectionTitle: 'A', itemOrder: 2 }),
      evidence({ id: '3', sectionOrder: 2, sectionTitle: 'B', itemOrder: 1 }),
    ]);
    const groups = groupEvidencesBySection(sorted);
    expect(groups).toHaveLength(2);
    expect(groups[0].sectionTitle).toBe('A');
    expect(groups[0].evidences.map((e) => e.id)).toEqual(['1', '2']);
    expect(groups[1].sectionTitle).toBe('B');
  });
});

describe('evidencesForItem', () => {
  it('filtra pelo inspectionItemId', () => {
    const list = sortEvidences([
      evidence({ id: '1', inspectionItemId: 'i1' }),
      evidence({ id: '2', inspectionItemId: 'i2' }),
      evidence({ id: '3', inspectionItemId: 'i1' }),
    ]);
    expect(evidencesForItem(list, 'i1').map((e) => e.id)).toEqual(['1', '3']);
  });
});
