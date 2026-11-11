import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { EmptyState, ErrorState, InlineError, LoadingState, OfflineBanner, SuccessBanner } from './States';

describe('States (PBI-0064.1)', () => {
  it('LoadingState expõe role=status e label', () => {
    const html = renderToStaticMarkup(createElement(LoadingState, { label: 'Carregando inspeções...' }));
    expect(html).toContain('role="status"');
    expect(html).toContain('Carregando inspeções...');
  });

  it('EmptyState renderiza ação Limpar filtros', () => {
    const html = renderToStaticMarkup(
      createElement(EmptyState, {
        title: 'Nenhum modelo encontrado',
        description: 'Ajuste os filtros',
        action: { label: 'Limpar filtros', onClick: () => undefined },
      })
    );
    expect(html).toContain('Nenhum modelo encontrado');
    expect(html).toContain('Limpar filtros');
  });

  it('ErrorState omite retry quando onRetry ausente (403)', () => {
    const html = renderToStaticMarkup(
      createElement(ErrorState, {
        title: 'Acesso não autorizado',
        message: 'Seu perfil não pode acessar este recurso.',
      })
    );
    expect(html).toContain('Acesso não autorizado');
    expect(html).not.toContain('Tentar novamente');
  });

  it('ErrorState inclui Tentar novamente com onRetry', () => {
    const html = renderToStaticMarkup(
      createElement(ErrorState, {
        message: 'Sem conexão. Verifique a rede e tente novamente.',
        onRetry: () => undefined,
      })
    );
    expect(html).toContain('Tentar novamente');
  });

  it('OfflineBanner some quando online', () => {
    expect(renderToStaticMarkup(createElement(OfflineBanner, { online: true }))).toBe('');
    const offline = renderToStaticMarkup(createElement(OfflineBanner, { online: false }));
    expect(offline).toContain('Você está offline.');
  });

  it('InlineError e SuccessBanner respeitam null', () => {
    expect(renderToStaticMarkup(createElement(InlineError, { message: null }))).toBe('');
    expect(renderToStaticMarkup(createElement(SuccessBanner, { message: null }))).toBe('');
    expect(renderToStaticMarkup(createElement(SuccessBanner, {}))).toContain('Operação concluída.');
  });
});
