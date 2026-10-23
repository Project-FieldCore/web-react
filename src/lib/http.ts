/**
 * Wrapper único de HTTP do frontend — nenhuma outra parte do código deve
 * chamar fetch/axios diretamente. Centraliza base URL, timeout, anexação do
 * token de sessão e o formato de erro (ApiError para respostas HTTP com
 * status de erro, NetworkError para falha de conexão/timeout).
 */

import { getAuthToken, notifyUnauthorized } from './auth-token';

const DEFAULT_BASE_URL = 'http://localhost:8080/api/v1';
const DEFAULT_TIMEOUT_MS = 15000;

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
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
}

async function parseErrorBody(response: Response): Promise<{ message: string; details?: unknown }> {
  try {
    const data = await response.json();
    if (data && typeof data.message === 'string') {
      return { message: data.message, details: data };
    }
    return { message: response.statusText || 'Erro inesperado na API.', details: data };
  } catch {
    return { message: response.statusText || 'Erro inesperado na API.' };
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const controller = new AbortController();
  const timedOut = { current: false };
  const timeout = setTimeout(() => {
    timedOut.current = true;
    controller.abort();
  }, timeoutMs);

  const token = getAuthToken();

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
      notifyUnauthorized();
    }
    const { message, details } = await parseErrorBody(response);
    throw new ApiError(message, response.status, details);
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
