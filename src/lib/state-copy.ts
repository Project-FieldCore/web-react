import { ApiError, NetworkError } from '@/lib/http';

/** Shared 14.15 / PBI-0064.1 PT-BR copy for list & section loads. */

export const NETWORK_LOAD_MESSAGE = 'Sem conexão. Verifique a rede e tente novamente.';
export const OFFLINE_MUTATION_MESSAGE = 'Sem conexão. Não foi possível salvar.';
export const OFFLINE_BANNER_TITLE = 'Você está offline.';
export const OFFLINE_BANNER_DETAIL = 'Algumas ações podem falhar até a conexão voltar.';
export const FORBIDDEN_TITLE = 'Acesso não autorizado';
export const FORBIDDEN_MESSAGE = 'Seu perfil não pode acessar este recurso.';
export const SERVER_ERROR_TITLE = 'Algo deu errado';
export const SERVER_ERROR_MESSAGE = 'Não foi possível carregar. Tente novamente.';
export const VALIDATION_FALLBACK = 'Verifique os dados informados.';
export const SUCCESS_BANNER = 'Operação concluída.';

export type LoadErrorCopy = {
  title: string;
  message: string;
  /** False for 401/403 — do not offer retry loops. */
  retry: boolean;
  status?: number;
  code?: string;
};

export function describeLoadError(error: unknown, resourceFallback = SERVER_ERROR_MESSAGE): LoadErrorCopy {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { title: SERVER_ERROR_TITLE, message: NETWORK_LOAD_MESSAGE, retry: true };
  }
  if (error instanceof NetworkError) {
    return { title: SERVER_ERROR_TITLE, message: NETWORK_LOAD_MESSAGE, retry: true };
  }
  if (error instanceof ApiError) {
    if (error.status === 403 || error.code === 'ACCESS_DENIED') {
      return {
        title: FORBIDDEN_TITLE,
        message: FORBIDDEN_MESSAGE,
        retry: false,
        status: error.status,
        code: error.code,
      };
    }
    if (error.status === 401) {
      return {
        title: SERVER_ERROR_TITLE,
        message: 'Sessão expirada. Entre novamente.',
        retry: false,
        status: 401,
        code: error.code,
      };
    }
    if (error.status === 404) {
      return {
        title: 'Não encontrado',
        message: error.message || 'Recurso não encontrado.',
        retry: false,
        status: 404,
        code: error.code,
      };
    }
    if (error.status === 400 || error.code === 'VALIDATION_ERROR') {
      return {
        title: SERVER_ERROR_TITLE,
        message: error.message || VALIDATION_FALLBACK,
        retry: true,
        status: error.status,
        code: error.code,
      };
    }
    if (error.status >= 500) {
      return {
        title: SERVER_ERROR_TITLE,
        message: SERVER_ERROR_MESSAGE,
        retry: true,
        status: error.status,
        code: error.code,
      };
    }
    return {
      title: SERVER_ERROR_TITLE,
      message: error.message || resourceFallback,
      retry: true,
      status: error.status,
      code: error.code,
    };
  }
  if (error instanceof Error && error.message) {
    return { title: SERVER_ERROR_TITLE, message: error.message, retry: true };
  }
  return { title: SERVER_ERROR_TITLE, message: resourceFallback, retry: true };
}

export function emptyListCopy(resourceSingular: string, gender: 'm' | 'f' = 'm') {
  const none = gender === 'f' ? 'Nenhuma' : 'Nenhum';
  const found = gender === 'f' ? 'encontrada' : 'encontrado';
  return {
    title: `${none} ${resourceSingular} ${found}`,
    description: 'Ajuste os filtros para ver outros resultados.',
  };
}
