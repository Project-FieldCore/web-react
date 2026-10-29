import { describe, expect, it } from 'vitest';
import { publishState } from './publish-state';
import { startNewVersion } from './model-versions';
import type { InspectionModel, ModelItem, ModelSection } from '@/types';

const item = (over: Partial<ModelItem> = {}): ModelItem => ({
  id: 'i1',
  title: 'Item',
  type: 'CONFORMITY',
  required: false,
  evidenceRequiredOnFailure: false,
  observationRequiredOnFailure: false,
  ...over,
});
const section = (over: Partial<ModelSection> = {}): ModelSection => ({ id: 's1', title: 'Seção', displayOrder: 0, items: [item()], ...over });
const model = (over: Partial<InspectionModel> = {}): InspectionModel => ({
  id: 'm1',
  title: 'Modelo',
  description: '',
  category: 'Geral',
  status: 'RASCUNHO',
  version: 0,
  sections: [section()],
  updatedAt: '2026-10-01T10:00:00.000Z',
  ...over,
});

describe('publishState — rascunho', () => {
  it('rascunho válido pode ser publicado', () => {
    const state = publishState(model());

    expect(state).toMatchObject({ mode: 'draft', locked: false, canPublish: true, reason: null, publishLabel: 'Publicar versão' });
    expect(state.errors).toEqual([]);
  });

  it('uma pendência impede e diz isso no singular', () => {
    const state = publishState(model({ category: '' }));

    expect(state.canPublish).toBe(false);
    expect(state.errors).toHaveLength(1);
    expect(state.reason).toBe('Resolva a pendência para publicar.');
  });

  it('várias pendências impedem e contam no plural', () => {
    const state = publishState(model({ title: '', category: '', sections: [] }));

    expect(state.canPublish).toBe(false);
    expect(state.reason).toBe(`Resolva as ${state.errors.length} pendências para publicar.`);
  });

  it('avisos não impedem', () => {
    const state = publishState(model({ sections: [section(), section({ id: 's2', displayOrder: 1, title: 'Vazia', items: [] })] }));

    expect(state.warnings).toHaveLength(1);
    expect(state.canPublish).toBe(true);
  });
});

describe('publishState — versão publicada (RN-019)', () => {
  const published = model({ status: 'PUBLICADO', version: 3 });

  it('fica travada e não pode ser publicada de novo', () => {
    const state = publishState(published);

    expect(state).toMatchObject({ mode: 'published', locked: true, canPublish: false, canStartNewVersion: true });
    expect(state.reason).toBe('A versão v3 já está publicada e é imutável. Crie uma nova versão para alterá-la.');
  });

  it('modelo arquivado fica travado e não oferece nova versão', () => {
    const state = publishState(model({ status: 'ARQUIVADO', version: 2 }));

    expect(state).toMatchObject({ locked: true, canPublish: false, canStartNewVersion: false });
    expect(state.reason).toBe('Este modelo está arquivado e não pode ser publicado.');
  });
});

describe('publishState — nova versão (RN-020)', () => {
  const published = model({ status: 'PUBLICADO', version: 3 });

  it('sem alterações: não publica e explica', () => {
    const state = publishState(startNewVersion(published));

    expect(state).toMatchObject({ mode: 'editing', locked: false, hasChanges: false, canPublish: false, canStartNewVersion: false });
    expect(state.reason).toBe('Nenhuma alteração desde a versão v3. Altere o modelo para publicar uma nova versão.');
    expect(state.publishLabel).toBe('Publicar nova versão');
  });

  it('com alteração válida: pode publicar', () => {
    const state = publishState({ ...startNewVersion(published), title: 'Modelo revisado' });

    expect(state).toMatchObject({ hasChanges: true, canPublish: true, reason: null });
  });

  it('com alteração que cria pendência: não publica, e a pendência vem antes do "sem alterações"', () => {
    const state = publishState({ ...startNewVersion(published), title: '' });

    expect(state.canPublish).toBe(false);
    expect(state.reason).toBe('Resolva a pendência para publicar.');
  });
});
