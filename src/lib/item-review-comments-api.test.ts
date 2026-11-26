import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COMMENT_FORBIDDEN_MESSAGE,
  COMMENT_INVALID_MESSAGE,
  COMMENT_NOT_UNDER_REVIEW_MESSAGE,
  MAX_COMMENT_LENGTH,
  addItemReviewComment,
  commentsForItem,
  describeCommentError,
  fetchItemReviewComments,
  toItemReviewComment,
  validateCommentText,
  type ApiItemReviewComment,
  type ItemReviewComment,
} from './item-review-comments-api';
import { NetworkError } from './http';
import { setAuthToken } from './auth-token';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function errorBody(status: number, code: string) {
  return { timestamp: '2026-11-23T00:00:00Z', status, code, message: 'x', path: '/p', requestId: 'r', fieldErrors: null };
}

const API_COMMENT: ApiItemReviewComment = {
  id: 'c1',
  inspectionItemId: 'it1',
  sectionTitle: 'Segurança',
  itemTitle: 'EPI completo?',
  comment: 'Conferir a foto.',
  reviewerId: 'u1',
  reviewerName: 'Ana Silva',
  createdAt: '2026-11-23T10:00:00Z',
};

describe('conversão e regras', () => {
  it('toItemReviewComment mapeia item, texto, autor e data', () => {
    expect(toItemReviewComment(API_COMMENT)).toEqual({
      id: 'c1', itemId: 'it1', texto: 'Conferir a foto.', autorNome: 'Ana Silva', autorId: 'u1', em: '2026-11-23T10:00:00Z',
    });
  });

  it('commentsForItem filtra pelo item e ordena do mais antigo ao mais novo', () => {
    const c = (id: string, itemId: string, em: string): ItemReviewComment => ({ id, itemId, texto: id, autorNome: 'a', autorId: 'u', em });
    const list = [c('b', 'it1', '2026-11-23T12:00:00Z'), c('x', 'it2', '2026-11-23T09:00:00Z'), c('a', 'it1', '2026-11-23T10:00:00Z')];
    expect(commentsForItem(list, 'it1').map((i) => i.id)).toEqual(['a', 'b']);
    expect(commentsForItem(undefined, 'it1')).toEqual([]);
  });

  it('validateCommentText recusa vazio/só espaços e texto acima de 2000', () => {
    expect(validateCommentText('')).toMatch(/Escreva um comentário/);
    expect(validateCommentText('   \n ')).toMatch(/Escreva um comentário/);
    expect(validateCommentText('a'.repeat(MAX_COMMENT_LENGTH + 1))).toMatch(/no máximo 2000/);
    expect(validateCommentText('ok')).toBeNull();
    expect(validateCommentText('a'.repeat(MAX_COMMENT_LENGTH))).toBeNull();
  });
});

describe('item-review-comments-api', () => {
  const originalFetch = global.fetch;
  beforeEach(() => setAuthToken('token-teste'));
  afterEach(() => {
    global.fetch = originalFetch;
    setAuthToken(null);
    vi.restoreAllMocks();
  });

  it('GET /inspections/{id}/item-review-comments e converte a lista', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, [API_COMMENT]));
    global.fetch = fetchMock;

    const result = await fetchItemReviewComments('insp-1');

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/inspections\/insp-1\/item-review-comments$/);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ itemId: 'it1', texto: 'Conferir a foto.', autorNome: 'Ana Silva' });
  });

  it('POST /inspections/{id}/items/{itemId}/review-comments com o texto aparado (201)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, API_COMMENT));
    global.fetch = fetchMock;

    const created = await addItemReviewComment('insp-1', 'it1', '  Conferir a foto.  ');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/inspections\/insp-1\/items\/it1\/review-comments$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ comment: 'Conferir a foto.' });
    expect(created.id).toBe('c1');
  });

  it('400 (texto inválido) mostra mensagem própria, sem retry', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(400, errorBody(400, 'VALIDATION_ERROR')));
    const error = await addItemReviewComment('insp-1', 'it1', 'x').catch((e: unknown) => e);
    expect(describeCommentError(error)).toMatchObject({ message: COMMENT_INVALID_MESSAGE, retry: false, status: 400 });
  });

  it('409 (inspeção fora de revisão) mostra mensagem própria, sem retry', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(409, errorBody(409, 'INSPECTION_NOT_REVIEWABLE')));
    const error = await addItemReviewComment('insp-1', 'it1', 'x').catch((e: unknown) => e);
    expect(describeCommentError(error)).toMatchObject({ message: COMMENT_NOT_UNDER_REVIEW_MESSAGE, retry: false, status: 409 });
  });

  it('403 (perfil sem acesso) mostra mensagem própria, sem retry', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(403, errorBody(403, 'ACCESS_DENIED')));
    const error = await fetchItemReviewComments('insp-1').catch((e: unknown) => e);
    expect(describeCommentError(error)).toMatchObject({ message: COMMENT_FORBIDDEN_MESSAGE, retry: false, status: 403 });
  });

  it('500 e falha de rede permitem nova tentativa', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(500, errorBody(500, 'INTERNAL_ERROR')));
    const error = await fetchItemReviewComments('insp-1').catch((e: unknown) => e);
    expect(describeCommentError(error).retry).toBe(true);
    expect(describeCommentError(new NetworkError()).retry).toBe(true);
  });
});
