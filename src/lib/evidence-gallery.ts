/**
 * Ordenação / agrupamento da galeria de evidências (PBI-0058.2).
 */

import type { MonitoringEvidence } from './inspections-api';

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function isSupportedEvidenceImage(contentType: string | null | undefined): boolean {
  if (!contentType) return false;
  return SUPPORTED_IMAGE_TYPES.has(contentType.toLowerCase());
}

export function evidenceItemTitle(evidence: Pick<MonitoringEvidence, 'itemTitle'>): string {
  const title = evidence.itemTitle?.trim();
  return title ? title : 'Item sem título';
}

export function evidenceSectionTitle(evidence: Pick<MonitoringEvidence, 'sectionTitle'>): string {
  const title = evidence.sectionTitle?.trim();
  return title ? title : 'Sem seção';
}

/** sectionOrder ASC → itemOrder ASC → createdAt ASC. */
export function sortEvidences(evidences: MonitoringEvidence[]): MonitoringEvidence[] {
  return [...evidences].sort((a, b) => {
    if (a.sectionOrder !== b.sectionOrder) return a.sectionOrder - b.sectionOrder;
    if (a.itemOrder !== b.itemOrder) return a.itemOrder - b.itemOrder;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export interface EvidenceSectionGroup {
  sectionOrder: number;
  sectionTitle: string;
  evidences: MonitoringEvidence[];
}

/** Agrupa evidências já ordenadas por seção (muda o header quando sectionOrder/title mudam). */
export function groupEvidencesBySection(sorted: MonitoringEvidence[]): EvidenceSectionGroup[] {
  const groups: EvidenceSectionGroup[] = [];
  for (const evidence of sorted) {
    const sectionTitle = evidenceSectionTitle(evidence);
    const last = groups[groups.length - 1];
    if (last && last.sectionOrder === evidence.sectionOrder && last.sectionTitle === sectionTitle) {
      last.evidences.push(evidence);
    } else {
      groups.push({ sectionOrder: evidence.sectionOrder, sectionTitle, evidences: [evidence] });
    }
  }
  return groups;
}

export function evidencesForItem(
  sorted: MonitoringEvidence[],
  inspectionItemId: string
): MonitoringEvidence[] {
  return sorted.filter((evidence) => evidence.inspectionItemId === inspectionItemId);
}
