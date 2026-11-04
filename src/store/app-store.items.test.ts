import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from './app-store';
import type { InspectionModel, ModelItem, ModelSection } from '@/types';

vi.mock('@/lib/models-api', () => ({
  createModel: vi.fn(),
  getModel: vi.fn(),
  updateModelMeta: vi.fn(),
  saveModel: vi.fn(),
  publishModel: vi.fn(),
}));
vi.mock('@/lib/sections-api', () => ({
  listSections: vi.fn(),
  createSection: vi.fn(),
  reorderSections: vi.fn(),
}));
vi.mock('@/lib/items-api', () => ({
  listItems: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
}));

import * as modelsApi from '@/lib/models-api';
import * as sectionsApi from '@/lib/sections-api';
import * as itemsApi from '@/lib/items-api';

function mocked<T extends (...args: never[]) => unknown>(fn: T) {
  return fn as unknown as ReturnType<typeof vi.fn>;
}

const DRAFT_VERSION = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const SECTION_ID = '11111111-2222-3333-4444-555555555555';
const ITEM_ID = '66666666-7777-8888-9999-aaaaaaaaaaaa';

const draftModel = (over: Partial<InspectionModel> = {}): InspectionModel => ({
  id: 'tpl-1',
  title: 'Modelo',
  description: '',
  category: 'Cat',
  status: 'RASCUNHO',
  version: 0,
  lockVersion: 1,
  draftVersionId: DRAFT_VERSION,
  latestVersionId: DRAFT_VERSION,
  sections: [],
  updatedAt: '2026-11-04T00:00:00Z',
  ...over,
});

describe('useAppStore itens/seções via API (PBI-0020.1 / 0021.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ models: [draftModel()], modelLoad: { id: null, status: 'idle', error: null } });
  });

  it('loadModel carrega seções e itens pelo draftVersionId', async () => {
    const section: ModelSection = { id: SECTION_ID, title: 'Segurança', displayOrder: 0, items: [] };
    const item: ModelItem = {
      id: ITEM_ID,
      title: 'Extintor',
      type: 'CONFORMITY',
      required: true,
      evidenceRequiredOnFailure: true,
      observationRequiredOnFailure: false,
    };
    mocked(modelsApi.getModel).mockResolvedValue(draftModel());
    mocked(sectionsApi.listSections).mockResolvedValue([section]);
    mocked(itemsApi.listItems).mockResolvedValue([item]);

    await useAppStore.getState().loadModel('tpl-1');

    expect(sectionsApi.listSections).toHaveBeenCalledWith(DRAFT_VERSION);
    expect(itemsApi.listItems).toHaveBeenCalledWith(SECTION_ID);
    expect(useAppStore.getState().models[0].sections[0].items).toEqual([item]);
    expect(useAppStore.getState().modelLoad.status).toBe('ready');
  });

  it('addSection cria seção na API quando há draftVersionId', async () => {
    const created: ModelSection = { id: SECTION_ID, title: 'Nova seção', displayOrder: 0, items: [] };
    mocked(sectionsApi.createSection).mockResolvedValue(created);

    const result = await useAppStore.getState().addSection('tpl-1');

    expect(result).toEqual({ ok: true });
    expect(sectionsApi.createSection).toHaveBeenCalledWith(DRAFT_VERSION, {
      title: 'Nova seção',
      displayOrder: 0,
    });
    expect(useAppStore.getState().models[0].sections).toEqual([created]);
  });

  it('addItem cria item na API com flags default quando sectionId é UUID', async () => {
    useAppStore.setState({
      models: [
        draftModel({
          sections: [{ id: SECTION_ID, title: 'S', displayOrder: 0, items: [] }],
        }),
      ],
    });
    const created: ModelItem = {
      id: ITEM_ID,
      title: 'Novo item',
      type: 'CONFORMITY',
      required: false,
      evidenceRequiredOnFailure: false,
      observationRequiredOnFailure: false,
    };
    mocked(itemsApi.createItem).mockResolvedValue(created);

    const result = await useAppStore.getState().addItem('tpl-1', SECTION_ID);

    expect(result).toEqual({ ok: true });
    expect(itemsApi.createItem).toHaveBeenCalled();
    expect(useAppStore.getState().models[0].sections[0].items[0]).toEqual(created);
  });

  it('updateItem persiste flags na API (PBI-0021)', async () => {
    const current: ModelItem = {
      id: ITEM_ID,
      title: 'Item',
      type: 'CONFORMITY',
      required: false,
      evidenceRequiredOnFailure: false,
      observationRequiredOnFailure: false,
    };
    useAppStore.setState({
      models: [
        draftModel({
          sections: [{ id: SECTION_ID, title: 'S', displayOrder: 0, items: [current] }],
        }),
      ],
    });
    const saved: ModelItem = { ...current, required: true, evidenceRequiredOnFailure: true };
    mocked(itemsApi.updateItem).mockResolvedValue(saved);

    const result = await useAppStore.getState().updateItem('tpl-1', SECTION_ID, ITEM_ID, {
      required: true,
      evidenceRequiredOnFailure: true,
    });

    expect(result).toEqual({ ok: true });
    expect(itemsApi.updateItem).toHaveBeenCalledWith(
      SECTION_ID,
      ITEM_ID,
      expect.objectContaining({ required: true, evidenceRequiredOnFailure: true })
    );
    expect(useAppStore.getState().models[0].sections[0].items[0].required).toBe(true);
  });
});
