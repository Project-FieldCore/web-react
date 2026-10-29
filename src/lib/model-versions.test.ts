import { describe, expect, it } from 'vitest';
import {
  contentEquals,
  discardNewVersion,
  hasUnpublishedChanges,
  isLocked,
  markPublished,
  publishedContent,
  snapshotOf,
  startNewVersion,
} from './model-versions';
import type { InspectionModel, ModelItem, ModelSection } from '@/types';

const item = (over: Partial<ModelItem> = {}): ModelItem => ({
  id: 'i1',
  title: 'Extintor dentro da validade',
  type: 'CONFORMITY',
  required: true,
  evidenceRequiredOnFailure: false,
  observationRequiredOnFailure: false,
  ...over,
});
const section = (over: Partial<ModelSection> = {}): ModelSection => ({
  id: 's1',
  title: 'Segurança',
  displayOrder: 0,
  items: [item()],
  ...over,
});
const model = (over: Partial<InspectionModel> = {}): InspectionModel => ({
  id: 'm1',
  title: 'Inspeção de extintores',
  description: 'Checklist mensal',
  category: 'Segurança',
  status: 'PUBLICADO',
  version: 3,
  sections: [section()],
  updatedAt: '2026-10-01T10:00:00.000Z',
  ...over,
});

describe('isLocked (RN-019)', () => {
  it('publicado e arquivado ficam travados; rascunho e nova versão em edição, não', () => {
    expect(isLocked({ status: 'PUBLICADO' })).toBe(true);
    expect(isLocked({ status: 'ARQUIVADO' })).toBe(true);
    expect(isLocked({ status: 'RASCUNHO' })).toBe(false);
    expect(isLocked({ status: 'PUBLICADO', editingNewVersion: true })).toBe(false);
  });
});

describe('snapshotOf', () => {
  it('é uma cópia independente: alterar o modelo depois não muda a foto', () => {
    const original = model();
    const snapshot = snapshotOf(original);

    original.sections[0].items[0].title = 'Alterado depois';
    original.title = 'Outro título';

    expect(snapshot.title).toBe('Inspeção de extintores');
    expect(snapshot.sections[0].items[0].title).toBe('Extintor dentro da validade');
  });

  it('guarda as seções na ordem explícita', () => {
    const snapshot = snapshotOf(model({ sections: [section({ id: 'b', displayOrder: 1 }), section({ id: 'a', displayOrder: 0 })] }));

    expect(snapshot.sections.map((s) => s.id)).toEqual(['a', 'b']);
  });
});

describe('contentEquals', () => {
  it('ignora espaços nas pontas e a ordem das chaves', () => {
    const a = snapshotOf(model());
    const b = { ...a, title: `  ${a.title}  `, sections: [{ items: a.sections[0].items, title: 'Segurança', displayOrder: 0, id: 's1' }] };

    expect(contentEquals(a, b)).toBe(true);
  });

  it('chave opcional undefined é o mesmo que ausente', () => {
    const a = snapshotOf(model());
    const b = snapshotOf(model({ sections: [section({ items: [item({ options: undefined })] })] }));

    expect(contentEquals(a, b)).toBe(true);
  });

  it('detecta mudança em título, categoria, descrição, item, flag, ordem e alternativas', () => {
    const base = snapshotOf(model());

    expect(contentEquals(base, snapshotOf(model({ title: 'Outro' })))).toBe(false);
    expect(contentEquals(base, snapshotOf(model({ category: 'Outra' })))).toBe(false);
    expect(contentEquals(base, snapshotOf(model({ description: 'Outra' })))).toBe(false);
    expect(contentEquals(base, snapshotOf(model({ sections: [section({ items: [item({ title: 'Outro' })] })] })))).toBe(false);
    expect(contentEquals(base, snapshotOf(model({ sections: [section({ items: [item({ required: false })] })] })))).toBe(false);
    expect(contentEquals(base, snapshotOf(model({ sections: [section({ items: [item({ observationRequiredOnFailure: true })] })] })))).toBe(false);
    expect(contentEquals(base, snapshotOf(model({ sections: [section({ items: [item(), item({ id: 'i2' })] })] })))).toBe(false);
  });

  it('mudar a ordem das seções conta como mudança', () => {
    const two = (a: number, b: number) => snapshotOf(model({ sections: [section({ id: 'a', displayOrder: a }), section({ id: 'b', displayOrder: b })] }));

    expect(contentEquals(two(0, 1), two(1, 0))).toBe(false);
  });
});

describe('publishedContent / hasUnpublishedChanges', () => {
  it('modelo publicado sem foto (dados de exemplo): o conteúdo atual é a versão publicada', () => {
    expect(publishedContent(model())).toEqual(snapshotOf(model()));
    expect(hasUnpublishedChanges(model())).toBe(false);
  });

  it('rascunho nunca publicado: sempre há o que publicar', () => {
    expect(publishedContent(model({ status: 'RASCUNHO', version: 0 }))).toBeUndefined();
    expect(hasUnpublishedChanges(model({ status: 'RASCUNHO', version: 0 }))).toBe(true);
  });

  it('nova versão sem alterações: nada a publicar', () => {
    expect(hasUnpublishedChanges(startNewVersion(model()))).toBe(false);
  });

  it('nova versão com alteração: há o que publicar', () => {
    const editing = startNewVersion(model());

    expect(hasUnpublishedChanges({ ...editing, title: 'Novo título' })).toBe(true);
    expect(hasUnpublishedChanges({ ...editing, sections: [...editing.sections, section({ id: 's2', displayOrder: 1 })] })).toBe(true);
  });

  it('desfazer a alteração manualmente volta a "sem alterações"', () => {
    const editing = startNewVersion(model());
    const changed = { ...editing, title: 'Novo título' };

    expect(hasUnpublishedChanges({ ...changed, title: editing.title })).toBe(false);
  });
});

describe('startNewVersion', () => {
  it('guarda a foto da publicada e libera a edição, mantendo o status publicado', () => {
    const editing = startNewVersion(model());

    expect(editing.editingNewVersion).toBe(true);
    expect(editing.status).toBe('PUBLICADO');
    expect(editing.version).toBe(3);
    expect(editing.publishedSnapshot).toEqual(snapshotOf(model()));
    expect(isLocked(editing)).toBe(false);
  });

  it('só vale para modelo publicado fora de edição', () => {
    const draft = model({ status: 'RASCUNHO' });
    const archived = model({ status: 'ARQUIVADO' });
    const editing = startNewVersion(model());

    expect(startNewVersion(draft)).toBe(draft);
    expect(startNewVersion(archived)).toBe(archived);
    expect(startNewVersion(editing)).toBe(editing);
  });

  it('a foto não acompanha as edições da cópia de trabalho (RN-019)', () => {
    const editing = startNewVersion(model());
    const changed = { ...editing, title: 'Novo título', sections: [] };

    expect(changed.publishedSnapshot?.title).toBe('Inspeção de extintores');
    expect(changed.publishedSnapshot?.sections).toHaveLength(1);
  });
});

describe('discardNewVersion', () => {
  it('restaura título, categoria, descrição e seções da versão publicada e encerra a edição', () => {
    const editing = startNewVersion(model());
    const changed: InspectionModel = {
      ...editing,
      title: 'Novo título',
      category: 'Nova',
      description: 'Nova descrição',
      sections: [section({ id: 'x', title: 'Outra' })],
    };

    const restored = discardNewVersion(changed, '2026-10-02T00:00:00.000Z');

    expect(restored).toMatchObject({
      title: 'Inspeção de extintores',
      category: 'Segurança',
      description: 'Checklist mensal',
      editingNewVersion: false,
      updatedAt: '2026-10-02T00:00:00.000Z',
    });
    expect(restored.sections.map((s) => s.id)).toEqual(['s1']);
    expect(isLocked(restored)).toBe(true);
  });

  it('não muda nada fora de uma nova versão', () => {
    const published = model();

    expect(discardNewVersion(published)).toBe(published);
  });

  it('depois de descartar, editar de novo não altera a foto', () => {
    const restored = discardNewVersion(startNewVersion({ ...model() }));
    const again = startNewVersion(restored);

    expect(again.publishedSnapshot).toEqual(snapshotOf(model()));
  });
});

describe('markPublished', () => {
  it('a versão publicada vira a foto e a edição termina', () => {
    const editing = { ...startNewVersion(model()), title: 'Novo título' };

    const published = markPublished({ ...editing, version: 4 });

    expect(published).toMatchObject({ version: 4, editingNewVersion: false });
    expect(published.publishedSnapshot?.title).toBe('Novo título');
    expect(isLocked(published)).toBe(true);
    expect(hasUnpublishedChanges(published)).toBe(false);
  });

  it('publicar um rascunho cria a primeira foto', () => {
    const published = markPublished(model({ status: 'PUBLICADO', version: 1, publishedSnapshot: undefined }));

    expect(published.publishedSnapshot).toEqual(snapshotOf(model()));
  });
});
