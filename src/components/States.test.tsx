import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EmptyState, ErrorState, LoadingState, OfflineBanner } from './States';
import { OFFLINE_BANNER_MESSAGE } from '@/lib/ui-messages';

describe('estados da interface', () => {
  it('carregando: avisa leitores de tela sem interromper', () => {
    const html = renderToStaticMarkup(<LoadingState label="Carregando clientes..." />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Carregando clientes...');
  });
  it('vazio: título e orientação', () => {
    const html = renderToStaticMarkup(<EmptyState title="Ainda não há clientes" description="Quando houver registros, eles aparecem aqui." />);
    expect(html).toContain('Ainda não há clientes');
    expect(html).toContain('eles aparecem aqui');
  });
  it('erro: alerta com tentar novamente só quando há ação', () => {
    const withRetry = renderToStaticMarkup(<ErrorState message="Falha de rede" onRetry={() => {}} />);
    expect(withRetry).toContain('role="alert"');
    expect(withRetry).toContain('Tentar novamente');
    expect(renderToStaticMarkup(<ErrorState message="Sem permissão" />)).not.toContain('Tentar novamente');
  });
  it('offline: faixa com a mensagem padrão', () => {
    const html = renderToStaticMarkup(<OfflineBanner />);
    expect(html).toContain('role="status"');
    expect(html).toContain(OFFLINE_BANNER_MESSAGE);
  });
});
