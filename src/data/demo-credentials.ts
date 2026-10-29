/**
 * Credenciais **somente locais** para demos offline / `resetPassword` no store.
 * NÃO fazem parte dos mocks do contrato OpenAPI (api-java não publica senhas).
 * Nunca use estes valores como segredo de produção.
 */
export const DEMO_CREDENTIALS: Record<string, string> = {
  'ana.silva@example.com': 'DemoPass123!',
};
