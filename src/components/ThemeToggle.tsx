'use client';

import { useTheme } from '@/hooks/useTheme';
import { THEME_LABEL, THEME_PREFERENCES } from '@/lib/theme';

type ThemeToggleProps = {
  variant?: 'sidebar' | 'surface';
};

/** Escolha de tema (Claro / Escuro / Sistema) para áreas escuras ou superfícies comuns. */
export function ThemeToggle({ variant = 'sidebar' }: ThemeToggleProps) {
  const { preference, setTheme } = useTheme();
  const onSurface = variant === 'surface';

  return (
    <div
      role="group"
      aria-label="Tema da interface"
      className={`flex rounded-lg p-0.5 text-[11px] font-bold ${
        onSurface ? 'border border-slate-200 bg-slate-100' : 'bg-white/5'
      }`}
    >
      {THEME_PREFERENCES.map((option) => {
        const active = preference === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => setTheme(option)}
            aria-pressed={active}
            className={`flex-1 rounded-md px-2 py-1 transition-colors ${
              onSurface
                ? active
                  ? 'bg-white text-navy-900 shadow-sm'
                  : 'text-slate-500 hover:text-navy-700'
                : active
                  ? 'bg-white/15 text-white'
                  : 'text-slate-400 hover:text-white'
            }`}
          >
            {THEME_LABEL[option]}
          </button>
        );
      })}
    </div>
  );
}
