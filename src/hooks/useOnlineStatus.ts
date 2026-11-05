'use client';

import { useEffect, useState } from 'react';

/** `true` enquanto o navegador tem conexão. Acompanha os eventos online/offline. */
export function useOnlineStatus(): boolean {
  // Começa online (igual no servidor) e corrige após montar, evitando divergência de hidratação.
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  return online;
}
