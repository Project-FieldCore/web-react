import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from './app-store';
import { ApiError, NetworkError } from '@/lib/http';
import { MOCK_MODELS } from '@/data/mock-data';
import { blockingIssues, validateModel } from '@/lib/model-validation';
import type { InspectionModel } from '@/types';

vi.mock('@/lib/models-api', () => ({
  createModel: vi.fn(),
  getModel: vi.fn(),
  updateModelMeta: vi.fn(),
  saveModel: vi.fn(),
  publishModel: vi.fn(),
}));

import * as modelsApi from '@/lib/models-api';

function mocked<T extends (...args: never[]) => unknown>(fn: T) {
  return fn as unknown as ReturnType<typeof vi.fn>;
}

const PUBLISHED_ID = 'mod-1';
const DRAFT_ID = 'mod-2';

describe('useAppStore construtor de modelos — #134', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ models: structuredClone(MOCK_MODELS), modelLoad: { id: null, status: 'idle', error: null } });
  });

  describe('createDraftModel', () => {
    const input = { title: 'Inspeção de extintores', category: 'Segurança', description: '  Checklist mensal  ' };

    it('chama a API com título/categoria/descrição e adiciona o rascunho devolvido (com o id do servidor)', async () => {
      const draft: InspectionModel = {
        id: 'srv-77',
        title: 'Inspeção de extintores',
        description: 'Checklist mensal',
        category: 'Segurança',
        status: 'RASCUNHO',
        version: 0,
        lockVersion: 0,
        updatedAt: '2026-10-01T10:00:00.000Z',
        sections: [],
      };
      mocked(modelsApi.createModel).mockResolvedValue(draft);

      const result = await useAppStore.getState().createDraftModel(input);

      expect(result).toEqual({ ok: true, id: 'srv-77' });
      expect(modelsApi.createModel).toHaveBeenCalledWith({
        title: 'Inspeção de extintores',
        category: 'Segurança',
        description: 'Checklist mensal',
      });
      expect(useAppStore.getState().models[0]).toEqual(draft);
    });

    it('RN-015: título e categoria são obrigatórios e não chamam a API', async () => {
      expect(await useAppStore.getState().createDraftModel({ ...input, title: '   ' })).toEqual({
        ok: false,
        error: 'Informe o título do modelo.',
      });
      expect(await useAppStore.getState().createDraftModel({ ...input, category: '' })).toEqual({
        ok: false,
        error: 'Informe a categoria do modelo.',
      });
      expect(modelsApi.createModel).not.toHaveBeenCalled();
    });

    it('respeita os limites da API (título 160, categoria 100, descrição 1000)', async () => {
      const long = (n: number) => 'x'.repeat(n);

      expect((await useAppStore.getState().createDraftModel({ ...input, title: long(161) })).ok).toBe(false);
      expect((await useAppStore.getState().createDraftModel({ ...input, category: long(101) })).ok).toBe(false);
      expect((await useAppStore.getState().createDraftModel({ ...input, description: long(1001) })).ok).toBe(false);
      expect(modelsApi.createModel).not.toHaveBeenCalled();
    });

    it('descrição vazia não é enviada', async () => {
      mocked(modelsApi.createModel).mockResolvedValue({ ...MOCK_MODELS[1], id: 'srv-1' });

      await useAppStore.getState().createDraftModel({ title: 'A', category: 'B', description: '   ' });

      expect(modelsApi.createModel).toHaveBeenCalledWith({ title: 'A', category: 'B', description: undefined });
    });

    it('título repetido (409) volta com a mensagem em português e não cria nada', async () => {
      mocked(modelsApi.createModel).mockRejectedValue(
        new ApiError('Já existe um modelo com esse título. Escolha outro título.', 409, undefined, 'TEMPLATE_TITLE_ALREADY_EXISTS')
      );
      const before = useAppStore.getState().models.length;

      const result = await useAppStore.getState().createDraftModel(input);

      expect(result).toEqual({ ok: false, error: 'Já existe um modelo com esse título. Escolha outro título.' });
      expect(useAppStore.getState().models).toHaveLength(before);
    });

    it('não cria nada localmente quando a API falha', async () => {
      mocked(modelsApi.createModel).mockRejectedValue(new NetworkError('Sem conexão.'));
      const before = useAppStore.getState().models.length;

      const result = await useAppStore.getState().createDraftModel(input);

      expect(result).toEqual({ ok: false, error: 'Sem conexão.' });
      expect(useAppStore.getState().models).toHaveLength(before);
    });
  });

  describe('loadModel', () => {
    const apiModel: InspectionModel = {
      id: 'srv-1',
      title: 'Do servidor',
      description: '',
      category: 'Geral',
      status: 'RASCUNHO',
      version: 0,
      lockVersion: 2,
      updatedAt: '2026-10-01T10:00:00.000Z',
      sections: [],
    };

    it('carrega pela API, acrescenta ao store e marca como pronto', async () => {
      mocked(modelsApi.getModel).mockResolvedValue(apiModel);

      const promise = useAppStore.getState().loadModel('srv-1');
      expect(useAppStore.getState().modelLoad).toEqual({ id: 'srv-1', status: 'loading', error: null });
      await promise;

      expect(useAppStore.getState().models[0]).toEqual(apiModel);
      expect(useAppStore.getState().modelLoad).toEqual({ id: 'srv-1', status: 'ready', error: null });
    });

    it('recarregar mantém as seções que já estão na tela (a API ainda não as devolve)', async () => {
      const section = { id: 'sec-1', title: 'Seção local', displayOrder: 0, items: [] };
      useAppStore.setState((s) => ({ models: [{ ...apiModel, sections: [section] }, ...s.models] }));
      mocked(modelsApi.getModel).mockResolvedValue({ ...apiModel, title: 'Renomeado por outra pessoa', lockVersion: 3 });

      await useAppStore.getState().loadModel('srv-1');

      const model = useAppStore.getState().models.find((m) => m.id === 'srv-1')!;
      expect(model).toMatchObject({ title: 'Renomeado por outra pessoa', lockVersion: 3 });
      expect(model.sections).toEqual([section]);
    });

    it('404 vira "not-found"', async () => {
      mocked(modelsApi.getModel).mockRejectedValue(
        new ApiError('Modelo não encontrado.', 404, undefined, 'INSPECTION_TEMPLATE_NOT_FOUND')
      );

      await useAppStore.getState().loadModel('nao-existe');

      expect(useAppStore.getState().modelLoad).toMatchObject({ id: 'nao-existe', status: 'not-found' });
    });

    it('erro de rede vira "error" com a mensagem', async () => {
      mocked(modelsApi.getModel).mockRejectedValue(new NetworkError('Sem conexão.'));

      await useAppStore.getState().loadModel('srv-1');

      expect(useAppStore.getState().modelLoad).toEqual({ id: 'srv-1', status: 'error', error: 'Sem conexão.' });
    });
  });

  describe('saveModelMeta (RN-018: edição livre em rascunho)', () => {
    const apiDraft: InspectionModel = {
      id: 'srv-1',
      title: 'Original',
      description: 'Desc',
      category: 'Geral',
      status: 'RASCUNHO',
      version: 0,
      lockVersion: 4,
      updatedAt: '2026-10-01T10:00:00.000Z',
      sections: [{ id: 'sec-1', title: 'Seção local', displayOrder: 0, items: [] }],
    };

    beforeEach(() => {
      useAppStore.setState((s) => ({ models: [apiDraft, ...s.models] }));
    });

    it('envia o lockVersion e só o que mudou, guarda o retorno e mantém as seções locais', async () => {
      mocked(modelsApi.updateModelMeta).mockResolvedValue({ ...apiDraft, title: 'Novo título', lockVersion: 5, sections: [] });

      const result = await useAppStore.getState().saveModelMeta('srv-1', { title: '  Novo título  ' });

      expect(result).toEqual({ ok: true });
      expect(modelsApi.updateModelMeta).toHaveBeenCalledWith(
        'srv-1',
        { title: 'Novo título', category: undefined, description: undefined },
        4
      );
      const saved = useAppStore.getState().models.find((m) => m.id === 'srv-1')!;
      expect(saved).toMatchObject({ title: 'Novo título', lockVersion: 5 });
      expect(saved.sections).toEqual(apiDraft.sections);
    });

    it('não chama a API com título ou categoria vazios', async () => {
      expect(await useAppStore.getState().saveModelMeta('srv-1', { title: ' ' })).toEqual({ ok: false, error: 'Informe o título do modelo.' });
      expect(await useAppStore.getState().saveModelMeta('srv-1', { category: '' })).toEqual({ ok: false, error: 'Informe a categoria do modelo.' });
      expect(modelsApi.updateModelMeta).not.toHaveBeenCalled();
    });

    it('descrição pode ser limpa (vazia é válida)', async () => {
      mocked(modelsApi.updateModelMeta).mockResolvedValue({ ...apiDraft, description: '', lockVersion: 5 });

      const result = await useAppStore.getState().saveModelMeta('srv-1', { description: '' });

      expect(result).toEqual({ ok: true });
      expect(modelsApi.updateModelMeta).toHaveBeenCalledWith('srv-1', { title: undefined, category: undefined, description: '' }, 4);
    });

    it('modelo que não é rascunho não pode ser editado e não chama a API', async () => {
      useAppStore.setState((s) => ({ models: s.models.map((m) => (m.id === 'srv-1' ? { ...m, status: 'PUBLICADO' } : m)) }));

      const result = await useAppStore.getState().saveModelMeta('srv-1', { title: 'Outro' });

      expect(result).toEqual({ ok: false, error: 'Só modelos em rascunho podem ser editados.' });
      expect(modelsApi.updateModelMeta).not.toHaveBeenCalled();
    });

    it('título repetido (409) volta com a mensagem e mantém o modelo como estava', async () => {
      mocked(modelsApi.updateModelMeta).mockRejectedValue(
        new ApiError('Já existe um modelo com esse título. Escolha outro título.', 409, undefined, 'TEMPLATE_TITLE_ALREADY_EXISTS')
      );

      const result = await useAppStore.getState().saveModelMeta('srv-1', { title: 'Repetido' });

      expect(result).toEqual({ ok: false, error: 'Já existe um modelo com esse título. Escolha outro título.' });
      expect(useAppStore.getState().models.find((m) => m.id === 'srv-1')!.title).toBe('Original');
      expect(modelsApi.getModel).not.toHaveBeenCalled();
    });

    it('VERSION_CONFLICT recarrega o modelo e devolve a mensagem', async () => {
      mocked(modelsApi.updateModelMeta).mockRejectedValue(
        new ApiError('Este registro foi alterado por outra pessoa.', 409, undefined, 'VERSION_CONFLICT')
      );
      mocked(modelsApi.getModel).mockResolvedValue({ ...apiDraft, title: 'Editado por outra pessoa', lockVersion: 9, sections: [] });

      const result = await useAppStore.getState().saveModelMeta('srv-1', { title: 'Minha edição' });

      expect(result).toEqual({ ok: false, error: 'Este registro foi alterado por outra pessoa.' });
      expect(useAppStore.getState().models.find((m) => m.id === 'srv-1')).toMatchObject({ title: 'Editado por outra pessoa', lockVersion: 9 });
    });

    it('TEMPLATE_NOT_EDITABLE (publicado por outra pessoa) recarrega e mostra o status atual', async () => {
      mocked(modelsApi.updateModelMeta).mockRejectedValue(
        new ApiError('Só modelos em rascunho podem ser editados.', 409, undefined, 'TEMPLATE_NOT_EDITABLE')
      );
      mocked(modelsApi.getModel).mockResolvedValue({ ...apiDraft, status: 'PUBLICADO', version: 1, lockVersion: 6, sections: [] });

      const result = await useAppStore.getState().saveModelMeta('srv-1', { title: 'Tarde demais' });

      expect(result.ok).toBe(false);
      expect(useAppStore.getState().models.find((m) => m.id === 'srv-1')!.status).toBe('PUBLICADO');
    });

    it('modelo local (dados de exemplo, sem lockVersion) é editado só na tela, sem chamar a API', async () => {
      const result = await useAppStore.getState().saveModelMeta(DRAFT_ID, { title: 'Só local' });

      expect(result).toEqual({ ok: true });
      expect(useAppStore.getState().models.find((m) => m.id === DRAFT_ID)!.title).toBe('Só local');
      expect(modelsApi.updateModelMeta).not.toHaveBeenCalled();
    });

    it('modelo inexistente não chama a API', async () => {
      const result = await useAppStore.getState().saveModelMeta('nao-existe', { title: 'X' });

      expect(result).toEqual({ ok: false, error: 'Modelo não encontrado.' });
      expect(modelsApi.updateModelMeta).not.toHaveBeenCalled();
    });
  });

  describe('saveModel', () => {
    it('envia o rascunho local inteiro e guarda o que a API devolveu', async () => {
      useAppStore.getState().updateModelMeta(DRAFT_ID, { title: 'Segurança v2' });
      const local = useAppStore.getState().models.find((m) => m.id === DRAFT_ID)!;
      mocked(modelsApi.saveModel).mockResolvedValue({ ...local, updatedAt: '2026-10-02T00:00:00.000Z' });

      const result = await useAppStore.getState().saveModel(DRAFT_ID);

      expect(result).toEqual({ ok: true });
      expect(modelsApi.saveModel).toHaveBeenCalledWith(expect.objectContaining({ id: DRAFT_ID, title: 'Segurança v2' }));
      expect(useAppStore.getState().models.find((m) => m.id === DRAFT_ID)!.updatedAt).toBe('2026-10-02T00:00:00.000Z');
    });

    it('mantém a edição local e devolve o erro quando a API rejeita', async () => {
      useAppStore.getState().updateModelMeta(DRAFT_ID, { title: 'Editado offline' });
      mocked(modelsApi.saveModel).mockRejectedValue(new ApiError('Modelo bloqueado.', 409));

      const result = await useAppStore.getState().saveModel(DRAFT_ID);

      expect(result).toEqual({ ok: false, error: 'Modelo bloqueado.' });
      expect(useAppStore.getState().models.find((m) => m.id === DRAFT_ID)!.title).toBe('Editado offline');
    });

    it('rejeita modelo inexistente sem chamar a API', async () => {
      const result = await useAppStore.getState().saveModel('nao-existe');

      expect(result.ok).toBe(false);
      expect(modelsApi.saveModel).not.toHaveBeenCalled();
    });
  });

  describe('publishModel', () => {
    it('valida localmente (RN-015) e não chama a API sem seção', async () => {
      useAppStore.setState((s) => ({ models: s.models.map((m) => (m.id === DRAFT_ID ? { ...m, sections: [] } : m)) }));

      const result = await useAppStore.getState().publishModel(DRAFT_ID);

      expect(result.ok).toBe(false);
      expect(modelsApi.saveModel).not.toHaveBeenCalled();
      expect(modelsApi.publishModel).not.toHaveBeenCalled();
    });

    it('salva e publica; a versão vem da API (RN-020)', async () => {
      const current = useAppStore.getState().models.find((m) => m.id === PUBLISHED_ID)!;
      mocked(modelsApi.saveModel).mockResolvedValue(current);
      mocked(modelsApi.publishModel).mockResolvedValue({ ...current, version: current.version + 1 });

      const result = await useAppStore.getState().publishModel(PUBLISHED_ID);

      expect(result).toEqual({ ok: true });
      expect(modelsApi.saveModel).toHaveBeenCalled();
      expect(modelsApi.publishModel).toHaveBeenCalledWith(PUBLISHED_ID);
      expect(useAppStore.getState().models.find((m) => m.id === PUBLISHED_ID)!.version).toBe(current.version + 1);
    });

    it('não publica se o salvamento falhar', async () => {
      mocked(modelsApi.saveModel).mockRejectedValue(new ApiError('Título duplicado.', 422));

      const result = await useAppStore.getState().publishModel(PUBLISHED_ID);

      expect(result).toEqual({ ok: false, error: 'Título duplicado.' });
      expect(modelsApi.publishModel).not.toHaveBeenCalled();
      expect(useAppStore.getState().models.find((m) => m.id === PUBLISHED_ID)!.version).toBe(3);
    });

    it('deixa o status local intacto quando a publicação falha', async () => {
      const current = useAppStore.getState().models.find((m) => m.id === DRAFT_ID)!;
      mocked(modelsApi.saveModel).mockResolvedValue(current);
      mocked(modelsApi.publishModel).mockRejectedValue(new NetworkError('Sem conexão.'));

      const result = await useAppStore.getState().publishModel(DRAFT_ID);

      expect(result).toEqual({ ok: false, error: 'Sem conexão.' });
      expect(useAppStore.getState().models.find((m) => m.id === DRAFT_ID)!.status).toBe('RASCUNHO');
    });
  });

  describe('ordenação das seções (RN-017)', () => {
    const orderOf = (modelId: string) =>
      useAppStore.getState().models.find((m) => m.id === modelId)!.sections.map((sec) => [sec.id, sec.displayOrder]);

    beforeEach(() => {
      useAppStore.setState((s) => ({
        models: s.models.map((m) =>
          m.id === DRAFT_ID
            ? {
                ...m,
                sections: [
                  { id: 'a', title: 'A', displayOrder: 0, items: [] },
                  { id: 'b', title: 'B', displayOrder: 1, items: [] },
                  { id: 'c', title: 'C', displayOrder: 2, items: [] },
                ],
              }
            : m
        ),
      }));
    });

    it('moveSection sobe e desce renumerando a ordem (0, 1, 2…)', () => {
      useAppStore.getState().moveSection(DRAFT_ID, 'c', 'up');
      expect(orderOf(DRAFT_ID)).toEqual([['a', 0], ['c', 1], ['b', 2]]);

      useAppStore.getState().moveSection(DRAFT_ID, 'a', 'down');
      expect(orderOf(DRAFT_ID)).toEqual([['c', 0], ['a', 1], ['b', 2]]);
    });

    it('moveSection na primeira (subir) e na última (descer) não muda nada', () => {
      const before = useAppStore.getState().models.find((m) => m.id === DRAFT_ID)!;

      useAppStore.getState().moveSection(DRAFT_ID, 'a', 'up');
      useAppStore.getState().moveSection(DRAFT_ID, 'c', 'down');

      expect(useAppStore.getState().models.find((m) => m.id === DRAFT_ID)).toBe(before);
    });

    it('moveSection atualiza o updatedAt só quando muda de fato', () => {
      const before = useAppStore.getState().models.find((m) => m.id === DRAFT_ID)!.updatedAt;

      useAppStore.getState().moveSection(DRAFT_ID, 'b', 'up');

      expect(useAppStore.getState().models.find((m) => m.id === DRAFT_ID)!.updatedAt).not.toBe(before);
    });

    it('moveSection só mexe no modelo pedido', () => {
      const published = useAppStore.getState().models.find((m) => m.id === PUBLISHED_ID)!;

      useAppStore.getState().moveSection(DRAFT_ID, 'b', 'up');

      expect(useAppStore.getState().models.find((m) => m.id === PUBLISHED_ID)).toBe(published);
    });

    it('addSection coloca a nova seção no fim com a próxima ordem', () => {
      useAppStore.getState().addSection(DRAFT_ID);

      const sections = useAppStore.getState().models.find((m) => m.id === DRAFT_ID)!.sections;
      expect(sections.map((sec) => sec.displayOrder)).toEqual([0, 1, 2, 3]);
      expect(sections[3].title).toBe('Nova seção');
    });

    it('removeSection renumera para não deixar lacuna na ordem', () => {
      useAppStore.getState().removeSection(DRAFT_ID, 'a');

      expect(orderOf(DRAFT_ID)).toEqual([['b', 0], ['c', 1]]);
    });

    it('os modelos de exemplo já têm ordem explícita, única e contígua', () => {
      for (const model of useAppStore.getState().models) {
        expect(model.sections.map((sec) => sec.displayOrder)).toEqual(model.sections.map((_, i) => i));
      }
    });
  });

  describe('regras por item: obrigatório, observação e evidência (PBI-0021.1)', () => {
    const itemsOf = (modelId: string, sectionIndex = 0) =>
      useAppStore.getState().models.find((m) => m.id === modelId)!.sections[sectionIndex].items;

    beforeEach(() => {
      useAppStore.setState((s) => ({
        models: s.models.map((m) =>
          m.id === DRAFT_ID ? { ...m, sections: [{ id: 'sec', title: 'Seção', displayOrder: 0, items: [] }] } : m
        ),
      }));
    });

    it('addItem cria o item com as três flags desligadas', () => {
      useAppStore.getState().addItem(DRAFT_ID, 'sec');

      expect(itemsOf(DRAFT_ID)[0]).toMatchObject({
        type: 'CONFORMITY',
        required: false,
        observationRequiredOnFailure: false,
        evidenceRequiredOnFailure: false,
      });
    });

    it('updateItem liga e desliga cada flag de forma independente', () => {
      useAppStore.getState().addItem(DRAFT_ID, 'sec');
      const id = itemsOf(DRAFT_ID)[0].id;

      useAppStore.getState().updateItem(DRAFT_ID, 'sec', id, { required: true });
      useAppStore.getState().updateItem(DRAFT_ID, 'sec', id, { observationRequiredOnFailure: true });
      expect(itemsOf(DRAFT_ID)[0]).toMatchObject({ required: true, observationRequiredOnFailure: true, evidenceRequiredOnFailure: false });

      useAppStore.getState().updateItem(DRAFT_ID, 'sec', id, { evidenceRequiredOnFailure: true });
      useAppStore.getState().updateItem(DRAFT_ID, 'sec', id, { observationRequiredOnFailure: false });
      expect(itemsOf(DRAFT_ID)[0]).toMatchObject({ required: true, observationRequiredOnFailure: false, evidenceRequiredOnFailure: true });
    });

    it('trocar para um tipo sem "falha" desliga observação e evidência, mas mantém o obrigatório', () => {
      useAppStore.getState().addItem(DRAFT_ID, 'sec');
      const id = itemsOf(DRAFT_ID)[0].id;
      useAppStore.getState().updateItem(DRAFT_ID, 'sec', id, {
        required: true,
        observationRequiredOnFailure: true,
        evidenceRequiredOnFailure: true,
      });

      useAppStore.getState().updateItem(DRAFT_ID, 'sec', id, { type: 'TEXT_SHORT' });

      expect(itemsOf(DRAFT_ID)[0]).toMatchObject({
        type: 'TEXT_SHORT',
        required: true,
        observationRequiredOnFailure: false,
        evidenceRequiredOnFailure: false,
      });
    });

    it('voltar para conformidade não religa as flags sozinho', () => {
      useAppStore.getState().addItem(DRAFT_ID, 'sec');
      const id = itemsOf(DRAFT_ID)[0].id;
      useAppStore.getState().updateItem(DRAFT_ID, 'sec', id, { evidenceRequiredOnFailure: true });
      useAppStore.getState().updateItem(DRAFT_ID, 'sec', id, { type: 'NUMBER' });

      useAppStore.getState().updateItem(DRAFT_ID, 'sec', id, { type: 'CONFORMITY' });

      expect(itemsOf(DRAFT_ID)[0]).toMatchObject({ evidenceRequiredOnFailure: false, observationRequiredOnFailure: false });
    });

    it('não é possível ligar a regra "na falha" num item que não é de conformidade', () => {
      useAppStore.getState().addItem(DRAFT_ID, 'sec');
      const id = itemsOf(DRAFT_ID)[0].id;
      useAppStore.getState().updateItem(DRAFT_ID, 'sec', id, { type: 'DATE' });

      useAppStore.getState().updateItem(DRAFT_ID, 'sec', id, { observationRequiredOnFailure: true });

      expect(itemsOf(DRAFT_ID)[0].observationRequiredOnFailure).toBe(false);
    });

    it('os modelos de exemplo têm as três flags definidas em todos os itens', () => {
      for (const model of useAppStore.getState().models) {
        for (const item of model.sections.flatMap((sec) => sec.items)) {
          expect(typeof item.required).toBe('boolean');
          expect(typeof item.evidenceRequiredOnFailure).toBe('boolean');
          expect(typeof item.observationRequiredOnFailure).toBe('boolean');
        }
      }
    });
  });

  describe('publishModel usa a mesma validação da prévia', () => {
    const setItems = (items: InspectionModel['sections'][number]['items']) =>
      useAppStore.setState((s) => ({
        models: s.models.map((m) =>
          m.id === DRAFT_ID ? { ...m, title: 'Rascunho válido', sections: [{ id: 'sec', title: 'Seção', displayOrder: 0, items }] } : m
        ),
      }));
    const baseItem = { id: 'i1', title: 'Item', type: 'CONFORMITY' as const, required: false, evidenceRequiredOnFailure: false, observationRequiredOnFailure: false };

    it('item sem título bloqueia a publicação, sem chamar a API', async () => {
      setItems([{ ...baseItem, title: '  ' }]);

      const result = await useAppStore.getState().publishModel(DRAFT_ID);

      expect(result).toEqual({ ok: false, error: 'O item 1 da seção "Seção" está sem título.' });
      expect(modelsApi.saveModel).not.toHaveBeenCalled();
      expect(modelsApi.publishModel).not.toHaveBeenCalled();
    });

    it('seleção única sem alternativas bloqueia a publicação', async () => {
      setItems([{ ...baseItem, type: 'SINGLE_CHOICE', options: [] }]);

      const result = await useAppStore.getState().publishModel(DRAFT_ID);

      expect(result).toEqual({ ok: false, error: 'O item "Item" é de seleção única e precisa de alternativas.' });
      expect(modelsApi.publishModel).not.toHaveBeenCalled();
    });

    it('seleção única com alternativas repetidas bloqueia a publicação', async () => {
      setItems([{ ...baseItem, type: 'SINGLE_CHOICE', options: ['A', 'A'] }]);

      const result = await useAppStore.getState().publishModel(DRAFT_ID);

      expect(result).toEqual({ ok: false, error: 'O item "Item" tem alternativas repetidas.' });
    });

    it('só avisos (seção vazia, uma alternativa) não impedem publicar', async () => {
      useAppStore.setState((s) => ({
        models: s.models.map((m) =>
          m.id === DRAFT_ID
            ? {
                ...m,
                title: 'Rascunho válido',
                sections: [
                  { id: 'a', title: 'Com item', displayOrder: 0, items: [{ ...baseItem, type: 'SINGLE_CHOICE' as const, options: ['Única'] }] },
                  { id: 'b', title: 'Vazia', displayOrder: 1, items: [] },
                ],
              }
            : m
        ),
      }));
      const current = useAppStore.getState().models.find((m) => m.id === DRAFT_ID)!;
      mocked(modelsApi.saveModel).mockResolvedValue(current);
      mocked(modelsApi.publishModel).mockResolvedValue({ ...current, status: 'PUBLICADO', version: 1 });

      const result = await useAppStore.getState().publishModel(DRAFT_ID);

      expect(result).toEqual({ ok: true });
      expect(modelsApi.publishModel).toHaveBeenCalledWith(DRAFT_ID);
    });

    it('as mensagens de RN-015/016 continuam as mesmas', async () => {
      useAppStore.setState((s) => ({ models: s.models.map((m) => (m.id === DRAFT_ID ? { ...m, title: '  ', sections: [] } : m)) }));
      expect(await useAppStore.getState().publishModel(DRAFT_ID)).toEqual({ ok: false, error: 'Informe um título para o modelo.' });

      useAppStore.setState((s) => ({ models: s.models.map((m) => (m.id === DRAFT_ID ? { ...m, title: 'T', sections: [] } : m)) }));
      expect(await useAppStore.getState().publishModel(DRAFT_ID)).toEqual({ ok: false, error: 'Adicione ao menos uma seção com itens (RN-015).' });

      setItems([]);
      expect(await useAppStore.getState().publishModel(DRAFT_ID)).toEqual({ ok: false, error: 'Adicione ao menos um item válido antes de publicar (RN-015).' });

      setItems([{ ...baseItem, type: undefined as never }]);
      expect(await useAppStore.getState().publishModel(DRAFT_ID)).toEqual({ ok: false, error: 'Todo item precisa de um tipo de resposta (RN-016).' });
    });

    it('os modelos de exemplo publicados passam na validação (sem problemas que bloqueiam)', () => {
      const published = useAppStore.getState().models.filter((m) => m.status === 'PUBLICADO');

      expect(published.length).toBeGreaterThan(0);
      for (const model of published) {
        expect(blockingIssues(validateModel(model))).toEqual([]);
      }
    });
  });
});
