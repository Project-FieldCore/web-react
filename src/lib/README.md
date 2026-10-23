# Cliente HTTP (`src/lib/http.ts`)

Wrapper único para todas as chamadas à API do FieldCore. Nenhum outro ponto do
código deve chamar `fetch`/`axios` diretamente — sempre importar `http` daqui.

## Configuração de ambiente

A base URL vem de `NEXT_PUBLIC_API_BASE_URL` (variável pública do Next.js,
precisa desse prefixo para chegar ao browser). Copie `.env.local.example` para
`.env.local` (não versionado) e ajuste por ambiente:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
```

Sem essa variável, cai no default `http://localhost:8080/api/v1` (uso local).

## Uso

```ts
import { http, ApiError, NetworkError } from '@/lib/http';

try {
  const client = await http.get<Client>(`/clients/${id}`);
} catch (error) {
  if (error instanceof ApiError) {
    // resposta da API com status de erro (4xx/5xx) — error.status, error.message, error.details
  } else if (error instanceof NetworkError) {
    // sem conexão ou timeout (15s por padrão) — error.message já em pt-BR, pronto para exibir
  }
}
```

Métodos disponíveis: `http.get`, `http.post`, `http.put`, `http.patch`, `http.delete`.

## Autenticação

- O token de sessão fica em `src/lib/auth-token.ts` (`sessionStorage`, fora do
  Zustand para evitar import circular com o próprio `http.ts`).
- `http.ts` anexa `Authorization: Bearer <token>` automaticamente quando há
  token salvo — não é preciso passar isso manualmente em cada chamada.
- Um `401` numa requisição que **já levava token** é tratado como sessão
  expirada: dispara `notifyUnauthorized()`, que o `app-store.ts` usa para
  deslogar o usuário. Um `401` sem token (ex.: login com credenciais erradas)
  não dispara isso — é só "credenciais inválidas".
- O refresh token também fica em `auth-token.ts` e é usado no logout
  (`POST /auth/logout` revoga o token no servidor). Quando o logout é causado
  por um 401, ele é só local (`logout({ remote: false })`) — o token já é
  inválido e a chamada remota entraria em 401 de novo.
- Erros seguem o formato padrão da API (`{ status, code, message, fieldErrors }`).
  `ApiError` expõe `status` e `code`; `http.ts` traduz `INVALID_CREDENTIALS` e
  `ACCOUNT_INACTIVE`, troca qualquer outro `403` por "sem permissão" (e não
  desloga — só o 401 com token desloga) e junta as mensagens de `fieldErrors`
  em erros de validação.
- Acesso por perfil nas rotas: `route-access.ts` (usado pelo `Shell.tsx`).

## Fluxo de login e sessão

`useAppStore.login` (`src/store/app-store.ts`) é o único ponto que chama
`auth-api.ts`. Ciclo completo:

1. Validação local (e-mail bem formado, senha não vazia) — evita bater na API
   com formulário incompleto.
2. `POST /auth/login` via `http.post` → `{ accessToken, refreshToken, user }`, convertido por `auth-api.ts` em `{ token, refreshToken, user }`.
3. `ApiError`/`NetworkError` viram mensagem amigável e `{ ok: false }` — nada é
   persistido.
4. Checks de `user.status`/`user.role` (RN-001/RN-003): quem decide de fato é
   a API, isso aqui só evita abrir o painel admin para quem não deveria estar
   nele. Se falhar, o token retornado é descartado (nunca chega a
   `setAuthToken`).
5. Sucesso: `setAuthToken(token)` + `setRefreshToken(refreshToken)` + `set({ currentUser: user })`.
6. `logout()` (manual ou via 401 em qualquer requisição autenticada, ver
   seção acima) limpa os dois. O `Shell.tsx` observa `currentUser` e
   redireciona para `/login` assim que ele vira `null`.

**Pendente:** o contrato (`POST /v1/auth/login`, `/auth/logout`) vem da branch
`feature/email-password-authentication` do `api-java`, ainda não mergeada.
Validar de ponta a ponta com a API rodando (`JWT_SECRET` com 32+ caracteres).

## Testes

- `src/lib/http.test.ts` — resposta ok, `204`, `ApiError`, `NetworkError`
  (fetch falhando/timeout) e o disparo (ou não) de `notifyUnauthorized` em 401.
- `src/store/app-store.auth.test.ts` — `login`/`logout` do store (mockando
  `auth-api.ts`): sucesso, credenciais inválidas, erro de servidor, erro de
  rede, usuário inativo, perfil sem acesso, e o logout automático disparado
  por uma sessão expirada, e o logout (remoto, com falha da API e sem refresh token).
- `src/lib/auth-api.test.ts` — contrato de login/logout com a API.
- `src/lib/route-access.test.ts` — rotas permitidas por perfil.

Rodar com `npm test`.
