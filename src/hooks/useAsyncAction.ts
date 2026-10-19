'use client';

import { useCallback, useState } from 'react';

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Padroniza o ciclo "clicou → aguardando → erro/sucesso" das ações que falam
 * com a API (#137): `pending` desabilita o botão (evita duplo envio) e `error`
 * guarda a última mensagem de falha para exibir em <InlineError />.
 */
export function useAsyncAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <R extends ActionResult>(action: () => Promise<R>): Promise<R> => {
    setPending(true);
    setError(null);
    try {
      const result = await action();
      if (!result.ok) setError(result.error);
      return result;
    } finally {
      setPending(false);
    }
  }, []);

  return { pending, error, setError, run };
}
