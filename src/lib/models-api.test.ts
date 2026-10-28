import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createModel, getModel, updateModelMeta } from './models-api';
import { setAuthToken } from './auth-token';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const API_TEMPLATE = {
  id: 'tpl-1',
  title: 'Inspeção de extintores',
  description: 'Checklist mensal',
  category: 'Segurança',
  status: 'DRAFT',
  currentVersion: null,
  createdBy: 'usr-1',
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
  version: 3,
};

describe('models-api (rascunho de modelo de inspeção)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    setAuthToken(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('createModel envia title/category/description para /inspection-templates e converte o retorno', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, API_TEMPLATE));
    global.fetch = fetchMock;

    const model = await createModel({ title: 'Inspeção de extintores', category: 'Segurança', description: 'Checklist mensal' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/inspection-templates$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ title: 'Inspeção de extintores', category: 'Segurança', description: 'Checklist mensal' });
    expect(model).toEqual({
      id: 'tpl-1',
      title: 'Inspeção de extintores',
      description: 'Checklist mensal',
      category: 'Segurança',
      status: 'RASCUNHO',
      version: 0,
      lockVersion: 3,
      sections: [],
      updatedAt: '2026-10-01T10:00:00Z',
    });
  });

  it('createModel sem descrição não envia o campo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { ...API_TEMPLATE, description: null }));
    global.fetch = fetchMock;

    const model = await createModel({ title: 'A', category: 'B' });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ title: 'A', category: 'B' });
    expect(model.description).toBe('');
  });

  it('getModel lê por id e separa a versão publicada (version) da versão de edição (lockVersion)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { ...API_TEMPLATE, status: 'ACTIVE', currentVersion: 2, version: 7 }));
    global.fetch = fetchMock;

    const model = await getModel('tpl-1');

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/inspection-templates\/tpl-1$/);
    expect(model).toMatchObject({ status: 'PUBLICADO', version: 2, lockVersion: 7 });
  });

  it('converte os status da API (DRAFT, ACTIVE, INACTIVE)', async () => {
    const statuses: Record<string, string> = { DRAFT: 'RASCUNHO', ACTIVE: 'PUBLICADO', INACTIVE: 'ARQUIVADO' };
    for (const [api, app] of Object.entries(statuses)) {
      global.fetch = vi.fn().mockResolvedValue(jsonResponse(200, { ...API_TEMPLATE, status: api }));
      expect((await getModel('tpl-1')).status).toBe(app);
    }
  });

  it('updateModelMeta usa PATCH com só os campos alterados e o lockVersion como version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ...API_TEMPLATE, title: 'Novo', version: 4 }));
    global.fetch = fetchMock;

    const model = await updateModelMeta('tpl-1', { title: 'Novo' }, 3);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/inspection-templates\/tpl-1$/);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ title: 'Novo', version: 3 });
    expect(model.title).toBe('Novo');
    expect(model.lockVersion).toBe(4);
  });

  it('updateModelMeta envia descrição vazia (limpar) mas omite o que não mudou', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ...API_TEMPLATE, description: '' }));
    global.fetch = fetchMock;

    await updateModelMeta('tpl-1', { description: '' }, 3);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ description: '', version: 3 });
  });

  it('título repetido (409 TEMPLATE_TITLE_ALREADY_EXISTS) chega como ApiError em português', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(409, { status: 409, code: 'TEMPLATE_TITLE_ALREADY_EXISTS', message: 'An inspection template with this title already exists' }));

    await expect(createModel({ title: 'A', category: 'B' })).rejects.toMatchObject({
      status: 409,
      code: 'TEMPLATE_TITLE_ALREADY_EXISTS',
      message: 'Já existe um modelo com esse título. Escolha outro título.',
    });
  });

  it('modelo não editável (409 TEMPLATE_NOT_EDITABLE) e não encontrado (404) em português', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(409, { status: 409, code: 'TEMPLATE_NOT_EDITABLE', message: 'Only draft inspection templates can be edited' }))
      .mockResolvedValueOnce(jsonResponse(404, { status: 404, code: 'INSPECTION_TEMPLATE_NOT_FOUND', message: 'Inspection template not found' }));

    await expect(updateModelMeta('tpl-1', { title: 'X' }, 1)).rejects.toMatchObject({
      code: 'TEMPLATE_NOT_EDITABLE',
      message: 'Só modelos em rascunho podem ser editados.',
    });
    await expect(getModel('nao-existe')).rejects.toMatchObject({
      status: 404,
      message: 'Modelo não encontrado. Ele pode ter sido removido.',
    });
  });
});
