import { ApiError, http } from './http';
import { describeLoadError, type LoadErrorCopy } from './state-copy';

/** Limite do texto do comentário (ItemReviewCommentRequest.comment: 1..2000). */
export const MAX_COMMENT_LENGTH = 2000;
export const EMPTY_COMMENTS_MESSAGE = 'Nenhum comentário para este item.';

/** ItemReviewComment — GET /inspections/{id}/item-review-comments. */
export interface ApiItemReviewComment {
  id: string;
  inspectionItemId: string;
  sectionTitle: string;
  itemTitle: string;
  comment: string;
  reviewerId: string;
  reviewerName: string;
  createdAt: string;
}

/** Comentário de revisão como a tela usa. */
export interface ItemReviewComment {
  id: string;
  itemId: string;
  texto: string;
  autorNome: string;
  autorId: string;
  /** Data e hora do comentário (ISO). */
  em: string;
}

export function toItemReviewComment(api: ApiItemReviewComment): ItemReviewComment {
  return {
    id: api.id,
    itemId: api.inspectionItemId,
    texto: api.comment,
    autorNome: api.reviewerName,
    autorId: api.reviewerId,
    em: api.createdAt,
  };
}

/** Comentários de um item, do mais antigo para o mais novo (ordem da conversa). */
export function commentsForItem(comments: ItemReviewComment[] | undefined, itemId: string): ItemReviewComment[] {
  return (comments ?? []).filter((c) => c.itemId === itemId).sort((a, b) => a.em.localeCompare(b.em));
}

/** Valida o texto antes de enviar; devolve a mensagem de erro ou null quando está ok. */
export function validateCommentText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return 'Escreva um comentário antes de enviar.';
  if (trimmed.length > MAX_COMMENT_LENGTH) return `O comentário pode ter no máximo ${MAX_COMMENT_LENGTH} caracteres.`;
  return null;
}

/** Lista os comentários de revisão da inspeção (somente ADMIN/SUPERVISOR). */
export async function fetchItemReviewComments(inspectionId: string): Promise<ItemReviewComment[]> {
  const list = await http.get<ApiItemReviewComment[]>(`/inspections/${inspectionId}/item-review-comments`);
  return list.map(toItemReviewComment);
}

/** Cria um comentário em um item; a inspeção precisa estar em revisão (senão 409). */
export async function addItemReviewComment(inspectionId: string, itemId: string, text: string): Promise<ItemReviewComment> {
  const created = await http.post<ApiItemReviewComment>(
    `/inspections/${inspectionId}/items/${itemId}/review-comments`,
    { comment: text.trim() }
  );
  return toItemReviewComment(created);
}

export const COMMENT_NOT_UNDER_REVIEW_MESSAGE = 'Só é possível comentar enquanto a inspeção está em revisão.';
export const COMMENT_INVALID_MESSAGE = `Comentário inválido. Escreva entre 1 e ${MAX_COMMENT_LENGTH} caracteres.`;
export const COMMENT_FORBIDDEN_MESSAGE = 'Seu perfil não pode comentar nesta inspeção.';

/** Mensagem de erro de listar/criar comentário (ErrorResponse padronizado). */
export function describeCommentError(error: unknown): LoadErrorCopy {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return { title: 'Comentário não enviado', message: COMMENT_NOT_UNDER_REVIEW_MESSAGE, retry: false, status: 409, code: error.code };
    }
    if (error.status === 400 || error.code === 'VALIDATION_ERROR') {
      return { title: 'Comentário inválido', message: COMMENT_INVALID_MESSAGE, retry: false, status: 400, code: error.code };
    }
    if (error.status === 403) {
      return { title: 'Acesso não autorizado', message: COMMENT_FORBIDDEN_MESSAGE, retry: false, status: 403, code: error.code };
    }
  }
  return describeLoadError(error, 'Não foi possível carregar ou enviar os comentários. Tente novamente.');
}
