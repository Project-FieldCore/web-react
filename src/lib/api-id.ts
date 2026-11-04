/** IDs gerados localmente (`sec-####`, `item-####`) vs UUID da API. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isApiUuid(id: string): boolean {
  return UUID_RE.test(id);
}
