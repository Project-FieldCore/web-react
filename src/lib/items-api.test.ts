import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createItem, listItems } from './items-api';
import { setAuthToken } from './auth-token';
import type { ModelItem } from '@/types';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const API_ITEM = {
  id: 'itm-1',
  sectionId: 'sec-1',
  code: null,
  title: 'Extintor dentro da validade',
  description: null,
  responseType: 'CONFORMITY',
  required: true,
  observationRequiredOnFailure: true,
  evidenceRequiredOnFailure: true,
  displayOrder: 0,
  optionsJson: null,
  createdAt: '2026-10-01T10:00:00Z',
};

const item = (over: Partial<ModelItem> = {}): ModelItem => ({
  id: 'local',
  title: 'Extintor dentro da validade',
  type: 'CONFORMITY',
  required: true,
  evidenceRequiredOnFailure: true,
  observationRequiredOnFailure: true,
  ...over,
});

describe('items-api (itens do checklist)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    setAuthToken(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('listItems converte as três flags e o tipo de resposta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, [API_ITEM]));
    global.fetch = fetchMock;

    const items = await listItems('sec-1');

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/template-sections\/sec-1\/items$/);
    expect(items).toEqual([
      {
        id: 'itm-1',
        title: 'Extintor dentro da validade',
        type: 'CONFORMITY',
        required: true,
        evidenceRequiredOnFailure: true,
        observationRequiredOnFailure: true,
        options: undefined,
      },
    ]);
  });

  it('listItems lê as alternativas da seleção única a partir do optionsJson', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, [{ ...API_ITEM, responseType: 'SINGLE_CHOICE', optionsJson: '["Boa","Regular","Ruim"]' }]));

    expect((await listItems('sec-1'))[0].options).toEqual(['Boa', 'Regular', 'Ruim']);
  });

  it('listItems ignora optionsJson inválido sem quebrar', async () => {
    global.fetch = vi.fn().mockImplementation(async () =>
      jsonResponse(200, [{ ...API_ITEM, optionsJson: 'isso não é json' }, { ...API_ITEM, id: 'itm-2', optionsJson: '{"a":1}' }])
    );

    const items = await listItems('sec-1');

    expect(items.map((i) => i.options)).toEqual([undefined, undefined]);
  });

  it('createItem envia as três flags e a ordem para a seção', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, API_ITEM));
    global.fetch = fetchMock;

    const created = await createItem('sec-1', item(), 0);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/template-sections\/sec-1\/items$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      title: 'Extintor dentro da validade',
      responseType: 'CONFORMITY',
      required: true,
      observationRequiredOnFailure: true,
      evidenceRequiredOnFailure: true,
      displayOrder: 0,
    });
    expect(created).toMatchObject({ required: true, observationRequiredOnFailure: true, evidenceRequiredOnFailure: true });
  });

  it('createItem só liga as flags "na falha" em itens de conformidade', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { ...API_ITEM, responseType: 'NUMBER' }));
    global.fetch = fetchMock;

    await createItem('sec-1', item({ type: 'NUMBER' }), 1);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      responseType: 'NUMBER',
      required: true,
      observationRequiredOnFailure: false,
      evidenceRequiredOnFailure: false,
      displayOrder: 1,
    });
  });

  it('createItem manda alternativas só para seleção única', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(201, API_ITEM));
    global.fetch = fetchMock;

    await createItem('sec-1', item({ type: 'SINGLE_CHOICE', options: ['A', 'B'] }), 0);
    await createItem('sec-1', item({ type: 'TEXT_SHORT', options: ['A', 'B'] }), 0);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).options).toEqual(['A', 'B']);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).options).toBeUndefined();
  });

  it('traduz os erros de alternativas, ordem, item e modelo não editável para português', async () => {
    const error = (status: number, code: string) => jsonResponse(status, { status, code, message: 'english' });
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(error(400, 'INVALID_RESPONSE_OPTIONS'))
      .mockResolvedValueOnce(error(409, 'ITEM_ORDER_ALREADY_EXISTS'))
      .mockResolvedValueOnce(error(409, 'TEMPLATE_NOT_EDITABLE'))
      .mockResolvedValueOnce(error(404, 'TEMPLATE_SECTION_NOT_FOUND'));

    await expect(createItem('s', item(), 0)).rejects.toMatchObject({
      message: 'Seleção única exige alternativas diferentes entre si, e os outros tipos de resposta não aceitam alternativas.',
    });
    await expect(createItem('s', item(), 0)).rejects.toMatchObject({
      message: 'Já existe um item nessa posição da seção. Recarregue a lista e tente de novo.',
    });
    await expect(createItem('s', item(), 0)).rejects.toMatchObject({ message: 'Só modelos em rascunho podem ser editados.' });
    await expect(listItems('s')).rejects.toMatchObject({ message: 'Seção não encontrada. Ela pode ter sido removida.' });
  });
});
