import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from './app-store';
import { ApiError, NetworkError } from '@/lib/http';
import { MOCK_MODELS } from '@/data/mock-data';
import type { InspectionModel } from '@/types';

vi.mock('@/lib/models-api', () => ({
  createModel: vi.fn(),
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
    useAppStore.setState({ models: structuredClone(MOCK_MODELS) });
  });

  describe('createDraftModel', () => {
    it('chama a API e adiciona o rascunho devolvido (com o id do servidor)', async () => {
      const draft: InspectionModel = {
        id: 'srv-77',
        title: 'Novo modelo de inspeção',
        description: '',
        category: 'Geral',
        status: 'RASCUNHO',
        version: 1,
        updatedAt: '2026-10-01T10:00:00.000Z',
        sections: [],
      };
      mocked(modelsApi.createModel).mockResolvedValue(draft);

      const result = await useAppStore.getState().createDraftModel();

      expect(result).toEqual({ ok: true, id: 'srv-77' });
      expect(useAppStore.getState().models[0]).toEqual(draft);
    });

    it('não cria nada localmente quando a API falha', async () => {
      mocked(modelsApi.createModel).mockRejectedValue(new NetworkError('Sem conexão.'));
      const before = useAppStore.getState().models.length;

      const result = await useAppStore.getState().createDraftModel();

      expect(result).toEqual({ ok: false, error: 'Sem conexão.' });
      expect(useAppStore.getState().models).toHaveLength(before);
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
});
