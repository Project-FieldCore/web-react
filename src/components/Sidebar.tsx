'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/store/app-store';
import type { UserRole } from '@/types';

const IconDashboard = () => (
  <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconClipboard = () => (
  <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const IconCalendar = () => (
  <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const IconSearch = () => (
  <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const IconAlert = () => (
  <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A1.5 1.5 0 003.36 20.5h17.28a1.5 1.5 0 001.25-2.46L13.71 3.86a1.5 1.5 0 00-2.42 0z" />
  </svg>
);

const IconUsers = () => (
  <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m5-5.13a4 4 0 100-8 4 4 0 000 8zm6 3a4 4 0 10-8 0" />
  </svg>
);

const IconBuilding = () => (
  <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M6 21V5a1 1 0 011-1h6a1 1 0 011 1v16M14 21v-8h4a1 1 0 011 1v7M9 7h.01M9 11h.01M9 15h.01" />
  </svg>
);

const IconTag = () => (
  <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.59 13.41L11 3.83A2 2 0 009.59 3.2H4a1 1 0 00-1 1v5.59a2 2 0 00.59 1.41l9.58 9.59a2 2 0 002.83 0l4.59-4.59a2 2 0 000-2.83zM7 7h.01" />
  </svg>
);

const IconHistory = () => (
  <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2" />
  </svg>
);

const IconMenu = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

const IconClose = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const IconLogout = () => (
  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m0-9H5a2 2 0 00-2 2v14a2 2 0 002 2h2" />
  </svg>
);

interface NavItem {
  href: string;
  label: string;
  Icon: () => React.JSX.Element;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', Icon: IconDashboard, roles: ['ADMIN', 'SUPERVISOR'] },
  { href: '/models', label: 'Modelos de inspeção', Icon: IconClipboard, roles: ['ADMIN', 'SUPERVISOR'] },
  { href: '/schedule', label: 'Agendar inspeção', Icon: IconCalendar, roles: ['ADMIN', 'SUPERVISOR'] },
  { href: '/inspections', label: 'Inspeções', Icon: IconSearch, roles: ['ADMIN', 'SUPERVISOR'] },
  { href: '/non-conformities', label: 'Não conformidades', Icon: IconAlert, roles: ['ADMIN', 'SUPERVISOR'] },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: '/users', label: 'Usuários', Icon: IconUsers, roles: ['ADMIN'] },
  { href: '/clients', label: 'Clientes e locais', Icon: IconBuilding, roles: ['ADMIN', 'SUPERVISOR'] },
  { href: '/equipment', label: 'Equipamentos', Icon: IconTag, roles: ['ADMIN'] },
  { href: '/audit', label: 'Auditoria', Icon: IconHistory, roles: ['ADMIN'] },
];

const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: 'Administrador(a)',
  SUPERVISOR: 'Supervisor(a)',
  TECHNICIAN: 'Técnico de campo',
  CLIENT_VIEWER: 'Cliente',
};

function Brand() {
  return (
    <div className="flex items-center px-5 py-5 border-b border-white/10 shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-compact.png" alt="FieldCore" className="h-9 w-auto" />
    </div>
  );
}

function NavLinks({ pathname, role, onNavigate }: { pathname: string; role: UserRole; onNavigate?: () => void }) {
  const items = [...NAV_ITEMS, ...ADMIN_NAV_ITEMS].filter((item) => item.roles.includes(role));
  // O título "Cadastros" vai acima do primeiro item dessa área que o perfil enxerga.
  const firstAdminItem = items.find((item) => ADMIN_NAV_ITEMS.includes(item));
  const matches = (href: string) => href === pathname || (href !== '/' && pathname.startsWith(`${href}/`));
  const bestMatch = items.filter((item) => matches(item.href)).sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
      {items.map((item) => {
        const active = item.href === bestMatch?.href;
        const isFirstAdminItem = item === firstAdminItem;
        return (
          <div key={item.href}>
            {isFirstAdminItem && (
              <div className="px-3 pt-4 pb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cadastros</div>
            )}
            <Link
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.Icon />
              {item.label}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

function UserFooter() {
  const currentUser = useAppStore((s) => s.currentUser);
  const logout = useAppStore((s) => s.logout);
  const router = useRouter();

  if (!currentUser) return null;

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <div className="px-5 py-4 border-t border-white/10 shrink-0">
      <div className="text-xs text-slate-500 mb-1">Logado como</div>
      <div className="text-sm font-semibold text-white truncate">{currentUser.nome}</div>
      <div className="text-xs text-slate-400 mb-2.5">{ROLE_LABEL[currentUser.role]}</div>
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
      >
        <IconLogout />
        Sair
      </button>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const currentUser = useAppStore((s) => s.currentUser);
  const [open, setOpen] = useState(false);

  // Fecha o drawer automaticamente ao navegar (troca de rota).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!currentUser) return null;

  return (
    <>
      {/* Topbar mobile/tablet — a sidebar completa vira um drawer abaixo de lg */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 bg-navy-900 text-white flex items-center px-4 shadow-sm">
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <IconMenu />
        </button>
        <div className="flex-1 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-compact.png" alt="FieldCore" className="h-7 w-auto" />
        </div>
        <div className="w-8" />
      </header>

      {/* Sidebar recuada — flutua com margem em relação às bordas da tela (desktop) */}
      <aside
        className="hidden lg:flex lg:flex-col fixed left-4 top-4 bottom-4 w-64 shrink-0 bg-navy-900 text-white rounded-2xl shadow-sm z-20"
      >
        <Brand />
        <NavLinks pathname={pathname} role={currentUser.role} />
        <UserFooter />
      </aside>

      {/* Drawer mobile/tablet */}
      <div
        className={`lg:hidden fixed inset-0 z-40 transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!open}
      >
        <button
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
          className="absolute inset-0 bg-navy-900/50"
        />
        <aside
          className={`absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-navy-900 text-white flex flex-col transition-transform duration-200 ease-out ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between px-5 py-5 border-b border-white/10 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-compact.png" alt="FieldCore" className="h-9 w-auto" />
            <button onClick={() => setOpen(false)} aria-label="Fechar menu" className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <IconClose />
            </button>
          </div>
          <NavLinks pathname={pathname} role={currentUser.role} onNavigate={() => setOpen(false)} />
          <UserFooter />
        </aside>
      </div>
    </>
  );
}
