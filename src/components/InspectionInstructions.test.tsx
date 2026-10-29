import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InspectionInstructions } from './InspectionInstructions';

const render = (text?: string | null) => renderToStaticMarkup(<InspectionInstructions text={text} />);

describe('InspectionInstructions', () => {
  it('mostra o texto das orientações com a seção identificada', () => {
    const html = render('Levar EPI e confirmar acesso');

    expect(html).toContain('aria-label="Orientações"');
    expect(html).toContain('Orientações');
    expect(html).toContain('Levar EPI e confirmar acesso');
    expect(html).not.toContain('Sem orientações');
  });

  it('preserva as quebras de linha digitadas', () => {
    expect(render('linha 1\nlinha 2')).toContain('whitespace-pre-wrap');
  });

  it('escapa HTML digitado (não interpreta marcação)', () => {
    const html = render('<script>alert(1)</script>');

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('sem orientações mostra o aviso, em vez de um bloco vazio', () => {
    for (const value of [undefined, null, '', '   ']) {
      const html = render(value);

      expect(html).toContain('Sem orientações.');
    }
  });

  it('apara espaços nas pontas', () => {
    expect(render('  Levar EPI  ')).toContain('>Levar EPI<');
  });
});
