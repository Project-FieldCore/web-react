/**
 * Guarda o token de sessão fora do Zustand para que src/lib/http.ts possa
 * lê-lo sem depender de src/store/app-store.ts (evita import circular).
 * Persistido em sessionStorage pela mesma razão que useAppStore persiste o
 * currentUser ali: sobreviver a um refresh, sem ser o mecanismo de sessão
 * de longo prazo (isso é responsabilidade da API).
 */

const TOKEN_STORAGE_KEY = 'fieldcore-auth-token';

function storage(): Storage | null {
  return typeof window === 'undefined' ? null : window.sessionStorage;
}

let cachedToken: string | null | undefined;

export function getAuthToken(): string | null {
  if (cachedToken === undefined) {
    cachedToken = storage()?.getItem(TOKEN_STORAGE_KEY) ?? null;
  }
  return cachedToken;
}

export function setAuthToken(token: string | null): void {
  cachedToken = token;
  const store = storage();
  if (!store) return;
  if (token) {
    store.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    store.removeItem(TOKEN_STORAGE_KEY);
  }
}

const REFRESH_TOKEN_STORAGE_KEY = 'fieldcore-auth-refresh-token';

let cachedRefreshToken: string | null | undefined;

/** Necessário para o logout (POST /auth/logout revoga o refresh token no servidor). */
export function getRefreshToken(): string | null {
  if (cachedRefreshToken === undefined) {
    cachedRefreshToken = storage()?.getItem(REFRESH_TOKEN_STORAGE_KEY) ?? null;
  }
  return cachedRefreshToken;
}

export function setRefreshToken(token: string | null): void {
  cachedRefreshToken = token;
  const store = storage();
  if (!store) return;
  if (token) {
    store.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
  } else {
    store.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  }
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Chamado pelo app-store para reagir a uma sessão expirada (ver notifyUnauthorized em http.ts). */
export function onUnauthorized(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized(): void {
  unauthorizedHandler?.();
}
