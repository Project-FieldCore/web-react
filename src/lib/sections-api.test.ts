import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSection, listSections, reorderSections } from './sections-api';
import { setAuthToken } from './auth-token';
import type { ModelSection } from '@/types';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const API_SECTION = {
  id: 'sec-1',
  templateVersionId: 'ver-1',
  title: 'Estrutura',
  description: null,
  displayOrder: 0,
  createdAt: '2026-10-01T10:00:00Z',
};
const APP_SECTION: ModelSection = { id: 'sec-1', title: 'Estrutura', description: undefined, displayOrder: 0, items: [] };

describe('sections-api (seções do checklist)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    setAuthToken(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('listSections lê as seções da versão e converte (sem itens, descrição nula vira undefined)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, [API_SECTION, { ...API_SECTION, id: 'sec-2', description: 'Texto', displayOrder: 1 }]));
    global.fetch = fetchMock;

    const sections = await listSections('ver-1');

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/template-versions\/ver-1\/sections$/);
    expect(sections).toEqual([APP_SECTION, { ...APP_SECTION, id: 'sec-2', description: 'Texto', displayOrder: 1 }]);
  });

  it('createSection envia title/displayOrder (descrição vazia não vai) para a versão', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, API_SECTION));
    global.fetch = fetchMock;

    const section = await createSection('ver-1', { title: 'Estrutura', description: '', displayOrder: 0 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/template-versions\/ver-1\/sections$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ title: 'Estrutura', displayOrder: 0 });
    expect(section).toEqual(APP_SECTION);
  });

  it('reorderSections manda a lista COMPLETA com ordens únicas e devolve as seções ordenadas', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, [
        { ...API_SECTION, id: 'sec-2', displayOrder: 0 },
        { ...API_SECTION, id: 'sec-1', displayOrder: 1 },
      ])
    );
    global.fetch = fetchMock;

    const result = await reorderSections('ver-1', [
      { id: 'sec-2', title: 'B', displayOrder: 0, items: [] },
      { id: 'sec-1', title: 'A', displayOrder: 1, items: [] },
    ]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/template-versions\/ver-1\/sections\/order$/);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({
      sections: [
        { sectionId: 'sec-2', displayOrder: 0 },
        { sectionId: 'sec-1', displayOrder: 1 },
      ],
    });
    expect(result.map((s) => s.id)).toEqual(['sec-2', 'sec-1']);
  });

  it('traduz os erros de ordem e de modelo não editável para português', async () => {
    const error = (status: number, code: string) => jsonResponse(status, { status, code, message: 'english' });
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(error(409, 'SECTION_ORDER_ALREADY_EXISTS'))
      .mockResolvedValueOnce(error(400, 'INVALID_SECTION_ORDER'))
      .mockResolvedValueOnce(error(404, 'TEMPLATE_SECTION_NOT_FOUND'))
      .mockResolvedValueOnce(error(404, 'TEMPLATE_VERSION_NOT_FOUND'))
      .mockResolvedValueOnce(error(409, 'TEMPLATE_NOT_EDITABLE'));

    await expect(createSection('v', { title: 'A', displayOrder: 0 })).rejects.toMatchObject({
      message: 'Já existe uma seção nessa posição. Recarregue a lista e tente de novo.',
    });
    await expect(reorderSections('v', [])).rejects.toMatchObject({
      message: 'Ordem de seções inválida: cada seção precisa de uma posição diferente.',
    });
    await expect(reorderSections('v', [])).rejects.toMatchObject({ message: 'Seção não encontrada. Ela pode ter sido removida.' });
    await expect(listSections('v')).rejects.toMatchObject({ message: 'Versão do modelo não encontrada.' });
    await expect(createSection('v', { title: 'A', displayOrder: 0 })).rejects.toMatchObject({
      message: 'Só modelos em rascunho podem ser editados.',
    });
  });
});
