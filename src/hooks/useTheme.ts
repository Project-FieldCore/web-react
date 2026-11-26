'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  applyResolvedTheme,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/theme';

/** Tema atual (claro/escuro/sistema): lembra a escolha e acompanha o tema do sistema quando for "sistema". */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [resolved, setResolved] = useState<ResolvedTheme>('light');

  // Lê a escolha salva só no navegador (evita divergência entre servidor e cliente na hidratação).
  useEffect(() => {
    setPreference(readStoredTheme());
  }, []);

  useEffect(() => {
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const update = () => {
      const next = resolveTheme(preference, media?.matches ?? false);
      setResolved(next);
      applyResolvedTheme(next, document.documentElement);
    };
    update();
    media?.addEventListener('change', update);
    return () => media?.removeEventListener('change', update);
  }, [preference]);

  const setTheme = useCallback((next: ThemePreference) => {
    setPreference(next);
    storeTheme(next);
  }, []);

  return { preference, resolved, setTheme };
}
