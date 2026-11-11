'use client';

import { useCallback, useState } from 'react';
import { OFFLINE_MUTATION_MESSAGE } from '@/lib/state-copy';

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Padroniza o ciclo "clicou → aguardando → erro/sucesso" das ações que falam
 * com a API (#137 / PBI-0064.1): `pending` desabilita o botão e `error`
 * guarda a última mensagem de falha para exibir em <InlineError />.
 * Offline before the call → mutation InlineError copy (spec §4).
 */
export function useAsyncAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <R extends ActionResult>(action: () => Promise<R>): Promise<R> => {
    setPending(true);
    setError(null);
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const offline = { ok: false as const, error: OFFLINE_MUTATION_MESSAGE };
        setError(OFFLINE_MUTATION_MESSAGE);
        return offline as R;
      }
      const result = await action();
      if (!result.ok) setError(result.error);
      return result;
    } finally {
      setPending(false);
    }
  }, []);

  return { pending, error, setError, run };
}
