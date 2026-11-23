import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ItemCommentsPanel, ItemReviewComments } from './ItemReviewComments';
import type { ItemReviewComment } from '@/lib/item-review-comments-api';

const COMMENTS: ItemReviewComment[] = [
  { id: 'c1', itemId: 'it1', texto: 'Conferir a foto do extintor.', autorNome: 'Ana Silva', autorId: 'u1', em: '2026-11-23T13:00:00.000Z' },
  { id: 'c2', itemId: 'it1', texto: 'Obrigada, corrigido.', autorNome: 'Ana Silva', autorId: 'u1', em: '2026-11-23T14:00:00.000Z' },
];
const noop = vi.fn(async () => ({ ok: true as const }));

describe('ItemCommentsPanel', () => {
  it('lista os comentários com texto, autor e data', () => {
    const html = renderToStaticMarkup(<ItemCommentsPanel panelId="p" comments={COMMENTS} canComment={false} onSubmit={noop} />);
    expect(html).toContain('Comentários de revisão do item');
    expect(html).toContain('Conferir a foto do extintor.');
    expect(html).toContain('Ana Silva');
  });

  it('estado vazio', () => {
    const html = renderToStaticMarkup(<ItemCommentsPanel panelId="p" comments={[]} canComment={false} onSubmit={noop} />);
    expect(html).toContain('Nenhum comentário para este item.');
  });

  it('estado de carregamento', () => {
    const html = renderToStaticMarkup(<ItemCommentsPanel panelId="p" comments={[]} status="loading" canComment={false} onSubmit={noop} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('Carregando comentários');
  });

  it('estado de erro com nova tentativa', () => {
    const html = renderToStaticMarkup(
      <ItemCommentsPanel panelId="p" comments={[]} status="error" error="Falha de rede" onRetry={() => {}} canComment={false} onSubmit={noop} />
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('Falha de rede');
    expect(html).toContain('Tentar novamente');
  });

  it('formulário só aparece quando a inspeção está em revisão', () => {
    const readOnly = renderToStaticMarkup(<ItemCommentsPanel panelId="p" comments={[]} canComment={false} onSubmit={noop} />);
    expect(readOnly).not.toContain('<textarea');
    const editable = renderToStaticMarkup(<ItemCommentsPanel panelId="p" comments={[]} canComment onSubmit={noop} />);
    expect(editable).toContain('<textarea');
    expect(editable).toContain('Comentar');
    expect(editable).toContain('maxLength="2000"');
    expect(editable).toContain('0/2000');
  });

  it('botão "Comentar" começa desabilitado com o campo vazio', () => {
    const html = renderToStaticMarkup(<ItemCommentsPanel panelId="p" comments={[]} canComment onSubmit={noop} />);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  });
});

describe('ItemReviewComments', () => {
  it('começa fechado, mostrando a quantidade de comentários', () => {
    const html = renderToStaticMarkup(<ItemReviewComments itemId="it1" comments={COMMENTS} canComment onSubmit={noop} />);
    expect(html).toContain('Comentários (2)');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Conferir a foto do extintor.');
  });

  it('sem contagem enquanto carrega ou em erro', () => {
    expect(renderToStaticMarkup(<ItemReviewComments itemId="it1" comments={[]} status="loading" canComment onSubmit={noop} />)).not.toContain('(0)');
    expect(renderToStaticMarkup(<ItemReviewComments itemId="it1" comments={[]} status="error" canComment onSubmit={noop} />)).toContain('>Comentários<');
  });
});
