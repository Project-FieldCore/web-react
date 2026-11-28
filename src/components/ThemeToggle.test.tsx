import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  it('mostra as três opções em um grupo acessível', () => {
    const html = renderToStaticMarkup(<ThemeToggle />);
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Tema da interface"');
    expect(html).toContain('Claro');
    expect(html).toContain('Escuro');
    expect(html).toContain('Sistema');
  });

  it('começa em "Sistema" (a escolha salva é lida só no navegador)', () => {
    const html = renderToStaticMarkup(<ThemeToggle />);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Sistema</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Claro</);
  });

  it('pode ser renderizado sobre uma superfície clara', () => {
    const html = renderToStaticMarkup(<ThemeToggle variant="surface" />);
    expect(html).toContain('border-slate-200');
    expect(html).toContain('bg-slate-100');
  });
});
