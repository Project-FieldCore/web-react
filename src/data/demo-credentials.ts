/**
 * Credenciais **somente locais** para demos offline (login de exemplo).
 * NÃO fazem parte dos mocks do contrato OpenAPI (api-java não publica senhas).
 * Nunca use estes valores como segredo de produção.
 * `resetPassword` no store não muta este mapa — redefinição real é via API.
 */
export const DEMO_CREDENTIALS: Record<string, string> = {
  'ana.silva@example.com': 'DemoPass123!',
};
