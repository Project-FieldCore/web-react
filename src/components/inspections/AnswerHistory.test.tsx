import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnswerHistory } from './AnswerHistory';
import { AnswerHistoryToggle } from './AnswerHistoryToggle';
import type { AnswerRevision } from '@/types';

const REVISIONS: AnswerRevision[] = [
  { id: 'r2', inspectionId: 'i1', itemId: 'it1', autorNome: 'Marina Costa', em: '2026-11-04T13:30:00.000Z', anterior: { conformity: 'CONFORME' }, novo: { conformity: 'NAO_CONFORME', observacao: 'vazamento' } },
  { id: 'r1', inspectionId: 'i1', itemId: 'it1', autorNome: 'Carlos', em: '2026-11-03T13:30:00.000Z', novo: { conformity: 'CONFORME' } },
];

describe('AnswerHistory', () => {
  it('lista quem alterou, de quê para quê', () => {
    const html = renderToStaticMarkup(<AnswerHistory revisions={REVISIONS} />);
    expect(html).toContain('Histórico de alterações da resposta');
    expect(html).toContain('Marina Costa');
    expect(html).toContain('Não conforme · obs: vazamento');
    expect(html).toContain('Sem resposta'); // primeira resposta não tem "antes"
  });
  it('estado vazio', () => {
    expect(renderToStaticMarkup(<AnswerHistory revisions={[]} />)).toContain('Nenhuma alteração registrada');
  });
  it('estado de carregamento', () => {
    const html = renderToStaticMarkup(<AnswerHistory revisions={[]} status="loading" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('Carregando histórico');
  });
  it('estado de erro com nova tentativa', () => {
    const html = renderToStaticMarkup(<AnswerHistory revisions={[]} status="error" error="Falha de rede" onRetry={() => {}} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('Falha de rede');
    expect(html).toContain('Tentar novamente');
  });
});

describe('AnswerHistoryToggle', () => {
  it('começa fechado, mostrando a quantidade de alterações', () => {
    const html = renderToStaticMarkup(<AnswerHistoryToggle itemId="it1" revisions={REVISIONS} />);
    expect(html).toContain('Histórico (2)');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Marina Costa');
  });
});
