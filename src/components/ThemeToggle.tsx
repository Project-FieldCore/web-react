'use client';

import { useTheme } from '@/hooks/useTheme';
import { THEME_LABEL, THEME_PREFERENCES } from '@/lib/theme';

/** Escolha de tema (Claro / Escuro / Sistema), pensada para o menu lateral escuro. */
export function ThemeToggle() {
  const { preference, setTheme } = useTheme();

  return (
    <div role="group" aria-label="Tema da interface" className="flex rounded-lg bg-white/5 p-0.5 text-[11px] font-bold">
      {THEME_PREFERENCES.map((option) => {
        const active = preference === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => setTheme(option)}
            aria-pressed={active}
            className={`flex-1 rounded-md px-2 py-1 transition-colors ${
              active ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {THEME_LABEL[option]}
          </button>
        );
      })}
    </div>
  );
}
