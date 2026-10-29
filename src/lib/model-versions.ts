import { normalizeSectionOrder } from './section-order';
import type { InspectionModel, ModelSnapshot } from '@/types';

/**
 * Versões do modelo (RN-019/020), em lógica pura e testável:
 * - a versão publicada é imutável: fica guardada numa foto (`publishedSnapshot`);
 * - alterar um modelo publicado = começar uma nova versão, editando uma cópia
 *   de trabalho; só ao publicar a foto é substituída e a versão sobe (quem
 *   numera é a API).
 * O modelo continua "publicado" (e disponível para agendar) enquanto a nova
 * versão é editada, porque a versão anterior segue valendo.
 */

type ModelContent = Pick<InspectionModel, 'title' | 'description' | 'category' | 'sections'>;

/** Copia independente do conteúdo atual (o que seria congelado ao publicar). */
export function snapshotOf(model: ModelContent): ModelSnapshot {
  return structuredClone({
    title: model.title,
    description: model.description,
    category: model.category,
    sections: normalizeSectionOrder(model.sections),
  });
}

/** Modelo publicado (ou arquivado) fora de edição: nada nele pode ser alterado. */
export function isLocked(model: Pick<InspectionModel, 'status' | 'editingNewVersion'>): boolean {
  return model.status !== 'RASCUNHO' && !model.editingNewVersion;
}

/** Serialização com chaves ordenadas: igual conteúdo => igual texto, qualquer que seja a ordem das chaves. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function contentEquals(a: ModelSnapshot, b: ModelSnapshot): boolean {
  const normalize = (c: ModelSnapshot) => ({
    ...c,
    title: c.title.trim(),
    description: c.description.trim(),
    category: c.category.trim(),
    sections: normalizeSectionOrder(c.sections),
  });
  return stableStringify(normalize(a)) === stableStringify(normalize(b));
}

/** Conteúdo da versão publicada em vigor (a foto; para modelos de exemplo sem foto, o conteúdo atual). */
export function publishedContent(model: InspectionModel): ModelSnapshot | undefined {
  if (model.publishedSnapshot) return model.publishedSnapshot;
  return model.status === 'PUBLICADO' && !model.editingNewVersion ? snapshotOf(model) : undefined;
}

/** Há algo novo para publicar? Rascunho nunca publicado: sempre. Modelo publicado: só se mudou. */
export function hasUnpublishedChanges(model: InspectionModel): boolean {
  const base = publishedContent(model);
  if (!base) return true;
  return !contentEquals(snapshotOf(model), base);
}

/** Começa uma nova versão: guarda a foto da publicada e libera a edição da cópia de trabalho. */
export function startNewVersion(model: InspectionModel): InspectionModel {
  if (model.status !== 'PUBLICADO' || model.editingNewVersion) return model;
  return { ...model, publishedSnapshot: model.publishedSnapshot ?? snapshotOf(model), editingNewVersion: true };
}

/** Descarta as alterações: a cópia de trabalho volta a ser a versão publicada. */
export function discardNewVersion(model: InspectionModel, now = new Date().toISOString()): InspectionModel {
  const snapshot = model.publishedSnapshot;
  if (!model.editingNewVersion || !snapshot) return model;
  const restored = structuredClone(snapshot);
  return { ...model, ...restored, editingNewVersion: false, updatedAt: now };
}

/** Depois de publicar: a nova versão vira a foto e a edição é encerrada. */
export function markPublished(published: InspectionModel): InspectionModel {
  const next: InspectionModel = { ...published, editingNewVersion: false };
  return { ...next, publishedSnapshot: snapshotOf(next) };
}
