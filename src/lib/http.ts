/**
 * Wrapper único de HTTP do frontend — nenhuma outra parte do código deve
 * chamar fetch/axios diretamente. Centraliza base URL, timeout, anexação do
 * token de sessão e o formato de erro (ApiError para respostas HTTP com
 * status de erro, NetworkError para falha de conexão/timeout).
 */

import { getAuthToken, notifyUnauthorized, refreshSession } from './auth-token';

const DEFAULT_BASE_URL = 'http://localhost:8080/api/v1';
const DEFAULT_TIMEOUT_MS = 15000;

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  /** Código de erro da API (ErrorResponse.code), ex.: INVALID_CREDENTIALS. */
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

export class NetworkError extends Error {
  constructor(message = 'Não foi possível conectar à API. Verifique sua conexão e tente novamente.') {
    super(message);
    this.name = 'NetworkError';
  }
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Não envia o token de sessão nem trata 401 como sessão expirada (ex.: /auth/refresh). */
  anonymous?: boolean;
  /** Não tenta renovar a sessão em 401 (ex.: /auth/logout, e a repetição após um refresh). */
  skipRefresh?: boolean;
}

interface ParsedError {
  message: string;
  code?: string;
  details?: unknown;
}

/** Mensagens em português para os códigos conhecidos da API (ErrorResponse.code). */
const ERROR_MESSAGES_BY_CODE: Record<string, string> = {
  INVALID_CREDENTIALS: 'E-mail ou senha inválidos.',
  ACCOUNT_INACTIVE: 'Este usuário está inativo ou bloqueado. Procure um administrador.',
  EMAIL_ALREADY_EXISTS: 'Já existe um usuário com esse e-mail.',
  VERSION_CONFLICT: 'Este registro foi alterado por outra pessoa. Os dados foram recarregados — tente de novo.',
  USER_NOT_FOUND: 'Usuário não encontrado. Ele pode ter sido removido.',
  DOCUMENT_ALREADY_EXISTS: 'Já existe um cliente com esse CNPJ.',
  CLIENT_NOT_FOUND: 'Cliente não encontrado. Ele pode ter sido removido.',
  // 409 genérico (violação de integridade no banco, sem código específico).
  CONFLICT: 'Não foi possível salvar: os dados conflitam com um registro existente.',
};

const FORBIDDEN_MESSAGE = 'Você não tem permissão para realizar esta ação.';

/**
 * Formato padrão de erro da API: { status, code, message, fieldErrors[] }.
 * Códigos conhecidos e 403 viram mensagem em português; erros de validação
 * (fieldErrors) listam os campos; o resto usa a mensagem da própria API.
 */
function friendlyMessage(status: number, code: string | undefined, apiMessage: string, fieldErrors: unknown): string {
  if (code && ERROR_MESSAGES_BY_CODE[code]) return ERROR_MESSAGES_BY_CODE[code];
  if (status === 403) return FORBIDDEN_MESSAGE;
  if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
    const messages = fieldErrors
      .map((e) => (e && typeof e.message === 'string' ? e.message : null))
      .filter((m): m is string => m !== null);
    if (messages.length > 0) return messages.join(' ');
  }
  return apiMessage;
}

async function parseErrorBody(response: Response): Promise<ParsedError> {
  const fallback = response.statusText || 'Erro inesperado na API.';
  try {
    const data = await response.json();
    const code = data && typeof data.code === 'string' ? data.code : undefined;
    const apiMessage = data && typeof data.message === 'string' ? data.message : fallback;
    return { message: friendlyMessage(response.status, code, apiMessage, data?.fieldErrors), code, details: data };
  } catch {
    return { message: friendlyMessage(response.status, undefined, fallback, undefined) };
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers, timeoutMs = DEFAULT_TIMEOUT_MS, anonymous = false, skipRefresh = false } = options;

  const controller = new AbortController();
  const timedOut = { current: false };
  const timeout = setTimeout(() => {
    timedOut.current = true;
    controller.abort();
  }, timeoutMs);

  const token = anonymous ? null : getAuthToken();

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new NetworkError(
      timedOut.current
        ? 'A API demorou demais para responder. Tente novamente.'
        : undefined
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    // Só trata como sessão expirada quando a própria requisição já levava um
    // token — um 401 de login (sem token) é só "credenciais inválidas".
    if (response.status === 401 && token) {
      if (!skipRefresh) {
        // Se outra requisição já renovou o token enquanto esta estava em voo,
        // basta repetir com o token novo; senão, renova (uma vez por vez).
        const current = getAuthToken();
        const renewed = current !== null && current !== token ? true : await refreshSession();
        // Repete uma única vez; um novo 401 aqui encerra a sessão (skipRefresh).
        if (renewed) return request<T>(path, { ...options, skipRefresh: true });
      }
      notifyUnauthorized();
    }
    const { message, code, details } = await parseErrorBody(response);
    throw new ApiError(message, response.status, details, code);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  // Rotas void da API (ex.: logout) respondem 200 sem corpo.
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const http = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
