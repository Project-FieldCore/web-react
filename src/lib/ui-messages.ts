import { ApiError, NetworkError } from '@/lib/http';

/**
 * Catálogo único das mensagens de estado da interface (doc 14.15): carregando,
 * vazio, erro e offline. As telas importam daqui em vez de escrever o texto à mão,
 * para o painel falar sempre do mesmo jeito.
 */

export const LOADING_MESSAGE = 'Carregando...';

export const OFFLINE_BANNER_MESSAGE = 'Você está offline. Algumas ações ficam indisponíveis até a conexão voltar.';
export const OFFLINE_ERROR_MESSAGE = 'Sem conexão com a internet. Verifique sua rede e tente novamente.';
export const BACK_ONLINE_MESSAGE = 'Conexão restabelecida.';

export const GENERIC_ERROR_TITLE = 'Algo deu errado';
export const GENERIC_ERROR_MESSAGE = 'Não foi possível concluir a operação. Tente novamente.';
export const SERVER_ERROR_MESSAGE = 'O servidor encontrou um problema. Tente novamente em instantes.';

export const FILTERED_EMPTY_DESCRIPTION = 'Ajuste os filtros ou a busca para ver outros resultados.';

/** Título e dica do estado vazio; `filtered` indica que há busca/filtro ativo (senão o recurso está mesmo vazio). */
export function emptyMessage(labels: { empty: string; notFound: string }, filtered: boolean): { title: string; description: string } {
  return filtered
    ? { title: labels.notFound, description: FILTERED_EMPTY_DESCRIPTION }
    : { title: labels.empty, description: 'Quando houver registros, eles aparecem aqui.' };
}

export type ErrorKind = 'offline' | 'network' | 'server' | 'forbidden' | 'session' | 'generic';

/** Mensagem pronta para a tela + tipo do erro (o tipo decide se vale oferecer "Tentar novamente"). */
export function describeError(error: unknown, fallback: string = GENERIC_ERROR_MESSAGE): { kind: ErrorKind; message: string; retryable: boolean } {
  if (error instanceof NetworkError) {
    const offline = isOffline();
    return { kind: offline ? 'offline' : 'network', message: offline ? OFFLINE_ERROR_MESSAGE : error.message, retryable: true };
  }
  if (error instanceof ApiError) {
    if (error.status >= 500) return { kind: 'server', message: error.message, retryable: true };
    if (error.status === 403) return { kind: 'forbidden', message: error.message, retryable: false };
    if (error.status === 401) return { kind: 'session', message: error.message, retryable: false };
    return { kind: 'generic', message: error.message, retryable: false };
  }
  return { kind: 'generic', message: fallback, retryable: true };
}

/** `navigator.onLine` só é confiável quando false; no servidor/testes assume online. */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}
