/** Preferência escolhida pela pessoa; "system" segue o tema do sistema operacional. */
export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'fieldcore-theme';
export const THEME_PREFERENCES: ThemePreference[] = ['light', 'dark', 'system'];
export const THEME_LABEL: Record<ThemePreference, string> = { light: 'Claro', dark: 'Escuro', system: 'Sistema' };

/** Qualquer valor desconhecido (storage adulterado ou vazio) vira "system". */
export function normalizeThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

/** localStorage pode não existir ou lançar (janela privada, dados bloqueados): nunca quebra a tela. */
function safeStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readStoredTheme(storage: Pick<Storage, 'getItem'> | null = safeStorage()): ThemePreference {
  try {
    return normalizeThemePreference(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

export function storeTheme(preference: ThemePreference, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Sem armazenamento: o tema vale só nesta sessão.
  }
}

/** Liga/desliga a classe `dark` no <html> e informa ao navegador (campos nativos, barras de rolagem). */
export function applyResolvedTheme(
  resolved: ResolvedTheme,
  root: { classList: Pick<DOMTokenList, 'toggle'>; style: { colorScheme: string } }
): void {
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
}

/**
 * Roda no <head> antes da página aparecer, para não piscar o tema claro
 * quando a pessoa escolheu (ou o sistema usa) o escuro. Mesma regra de resolveTheme.
 */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement,p='system';try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');if(s==='light'||s==='dark'||s==='system')p=s}catch(e){}var dark=p==='dark'||(p==='system'&&!!window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(dark)d.classList.add('dark');d.style.colorScheme=dark?'dark':'light'})();`;
