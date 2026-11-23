import { describe, expect, it, vi } from 'vitest';
import {
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  applyResolvedTheme,
  normalizeThemePreference,
  readStoredTheme,
  resolveTheme,
  storeTheme,
} from './theme';

describe('normalizeThemePreference', () => {
  it('aceita só claro, escuro e sistema; o resto vira sistema', () => {
    expect(normalizeThemePreference('light')).toBe('light');
    expect(normalizeThemePreference('dark')).toBe('dark');
    expect(normalizeThemePreference('system')).toBe('system');
    expect(normalizeThemePreference('azul')).toBe('system');
    expect(normalizeThemePreference(null)).toBe('system');
    expect(normalizeThemePreference(undefined)).toBe('system');
  });
});

describe('resolveTheme', () => {
  it('sistema segue a preferência do sistema operacional', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
  it('escolha explícita ignora o sistema', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('armazenamento', () => {
  it('lê a escolha salva e usa "sistema" quando não há nada ou o valor é inválido', () => {
    expect(readStoredTheme({ getItem: () => 'dark' })).toBe('dark');
    expect(readStoredTheme({ getItem: () => null })).toBe('system');
    expect(readStoredTheme({ getItem: () => 'qualquer' })).toBe('system');
  });
  it('não quebra quando o storage lança ou não existe', () => {
    expect(readStoredTheme({ getItem: () => { throw new Error('bloqueado'); } })).toBe('system');
    expect(readStoredTheme(null)).toBe('system');
    expect(() => storeTheme('dark', { setItem: () => { throw new Error('cheio'); } })).not.toThrow();
    expect(() => storeTheme('dark', null)).not.toThrow();
  });
  it('grava a escolha na chave esperada', () => {
    const setItem = vi.fn();
    storeTheme('dark', { setItem });
    expect(setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'dark');
  });
});

describe('applyResolvedTheme', () => {
  it('liga a classe dark e o color-scheme', () => {
    const toggle = vi.fn();
    const root = { classList: { toggle }, style: { colorScheme: '' } };
    applyResolvedTheme('dark', root);
    expect(toggle).toHaveBeenCalledWith('dark', true);
    expect(root.style.colorScheme).toBe('dark');
    applyResolvedTheme('light', root);
    expect(toggle).toHaveBeenLastCalledWith('dark', false);
    expect(root.style.colorScheme).toBe('light');
  });
});

describe('THEME_INIT_SCRIPT (roda antes da primeira pintura)', () => {
  function run(stored: string | null | 'throw', systemDark: boolean) {
    const classes = new Set<string>();
    const root = { classList: { add: (c: string) => classes.add(c) }, style: { colorScheme: '' } };
    const localStorage = {
      getItem: () => {
        if (stored === 'throw') throw new Error('bloqueado');
        return stored;
      },
    };
    const window = { matchMedia: () => ({ matches: systemDark }) };
    new Function('document', 'window', 'localStorage', THEME_INIT_SCRIPT)({ documentElement: root }, window, localStorage);
    return { dark: classes.has('dark'), scheme: root.style.colorScheme };
  }

  it('escolha salva vence o sistema', () => {
    expect(run('dark', false)).toEqual({ dark: true, scheme: 'dark' });
    expect(run('light', true)).toEqual({ dark: false, scheme: 'light' });
  });
  it('sem escolha, segue o sistema', () => {
    expect(run(null, true)).toEqual({ dark: true, scheme: 'dark' });
    expect(run(null, false)).toEqual({ dark: false, scheme: 'light' });
    expect(run('system', true).dark).toBe(true);
  });
  it('valor inválido ou storage bloqueado cai no sistema, sem lançar erro', () => {
    expect(run('azul', true).dark).toBe(true);
    expect(run('throw', false)).toEqual({ dark: false, scheme: 'light' });
  });
});
