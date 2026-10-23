'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/store/app-store';
import { Sidebar } from '@/components/Sidebar';
import { PUBLIC_ROUTES, isAllowed } from '@/lib/route-access';

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const currentUser = useAppStore((s) => s.currentUser);
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  // A sessão é reidratada da sessionStorage de forma assíncrona (só existe no
  // navegador) — sem esperar isso, um refresh em rota protegida chutaria o
  // usuário para /login antes da sessão voltar.
  const [hydrated, setHydrated] = useState(() => useAppStore.persist.hasHydrated());
  useEffect(() => {
    setHydrated(useAppStore.persist.hasHydrated());
    return useAppStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // Lê o estado ao vivo (em vez do `currentUser` capturado no render) —
    // a reidratação da sessão dispara `hydrated` e a atualização do usuário
    // em dois microtasks separados, então o valor de `currentUser` nesta
    // render pode estar um tick atrasado em relação a `hydrated`.
    const liveUser = useAppStore.getState().currentUser;
    if (isPublicRoute) {
      if (liveUser) router.replace('/');
      return;
    }
    if (!liveUser) {
      router.replace('/login');
      return;
    }
    if (!isAllowed(pathname, liveUser.role)) {
      router.replace('/');
    }
  }, [hydrated, pathname, isPublicRoute, router, currentUser]);

  if (!hydrated) {
    return <div className="min-h-screen" />;
  }

  if (isPublicRoute) {
    // Sessão já ativa acessando uma rota pública diretamente — tela em branco até o redirect acima disparar.
    if (currentUser) return <div className="min-h-screen" />;
    // A própria página controla seu layout (split-screen full-bleed, sem Sidebar).
    return <div className="min-h-screen">{children}</div>;
  }

  // Sessão ainda não resolvida ou rota não permitida para o perfil — evita piscar conteúdo protegido.
  if (!currentUser || !isAllowed(pathname, currentUser.role)) {
    return <div className="min-h-screen" />;
  }

  return (
    <>
      <div className="print:hidden">
        <Sidebar />
      </div>
      <main className="min-h-screen min-w-0 pt-20 pb-8 px-4 sm:px-6 lg:pt-8 lg:pb-8 lg:pl-72 lg:pr-8 print:p-0">{children}</main>
    </>
  );
}
