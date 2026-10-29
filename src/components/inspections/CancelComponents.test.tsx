import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CancelInspectionDialog } from './CancelInspectionDialog';
import { CancelInspectionAction } from './CancelInspectionAction';
import { CancellationInfo } from './CancellationInfo';
import type { InspectionStatus } from '@/types';

const noop = () => {};

describe('CancelInspectionDialog', () => {
  const html = renderToStaticMarkup(
    <CancelInspectionDialog
      inspectionId="INS-4471"
      clientName="Grupo Sorocaba"
      locationName="Planta 2"
      onConfirm={async () => ({ ok: true })}
      onClose={noop}
    />
  );

  it('é um diálogo acessível, com o resumo da inspeção', () => {
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toMatch(/aria-labelledby="([^"]+)"/);
    expect(html).toContain('Cancelar inspeção');
    expect(html).toContain('INS-4471 · Grupo Sorocaba · Planta 2');
  });

  it('a justificativa é obrigatória e tem contador e limite', () => {
    expect(html).toContain('Justificativa');
    expect(html).toContain('maxLength="1000"');
    expect(html).toContain('0/1000');
    expect(html).toMatch(/<label[^>]*for="([^"]+)"/);
  });

  it('avisa que registra nome, data e justificativa e que não pode ser desfeito', () => {
    expect(html).toContain('registra seu nome, a data e a justificativa');
    expect(html).toContain('não pode ser desfeito');
  });

  it('tem Voltar e Confirmar cancelamento, ambos habilitados no início', () => {
    expect(html).toContain('Voltar');
    expect(html).toContain('Confirmar cancelamento');
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('role="alert"');
  });

  it('funciona sem cliente e local', () => {
    const bare = renderToStaticMarkup(
      <CancelInspectionDialog inspectionId="INS-1" onConfirm={async () => ({ ok: true })} onClose={noop} />
    );

    expect(bare).toContain('INS-1');
    expect(bare).not.toContain('undefined');
  });
});

describe('CancelInspectionAction', () => {
  const render = (status: InspectionStatus) => renderToStaticMarkup(<CancelInspectionAction status={status} onCancel={noop} />);

  it('mostra o botão quando dá para cancelar', () => {
    for (const status of ['RASCUNHO', 'ATRIBUIDA', 'EM_ANDAMENTO', 'ENVIADA', 'EM_REVISAO', 'DEVOLVIDA', 'REPROVADA'] as const) {
      expect(render(status)).toContain('Cancelar inspeção');
    }
  });

  it('numa aprovada não mostra o botão e explica o motivo (RN-030)', () => {
    const html = render('APROVADA');

    expect(html).not.toContain('<button');
    expect(html).toContain('Inspeção aprovada não pode ser cancelada pelo fluxo comum (RN-030).');
  });

  it('numa já cancelada não mostra nada', () => {
    expect(render('CANCELADA')).toBe('');
  });
});

describe('CancellationInfo', () => {
  const cancelamento = {
    porNome: 'Marina Costa',
    porId: 'usr-1',
    em: '2026-10-30T15:20:00.000Z',
    justificativa: 'Cliente pediu.\nReagendar em novembro.',
  };

  it('mostra quem cancelou, quando e a justificativa', () => {
    const html = renderToStaticMarkup(<CancellationInfo cancelamento={cancelamento} />);

    expect(html).toContain('Inspeção cancelada');
    expect(html).toContain('Marina Costa');
    expect(html).toContain('30/10/2026');
    expect(html).toContain('Cliente pediu.');
    expect(html).toContain('whitespace-pre-wrap');
  });

  it('escapa HTML digitado na justificativa', () => {
    const html = renderToStaticMarkup(
      <CancellationInfo cancelamento={{ ...cancelamento, justificativa: '<img src=x onerror=alert(1)>' }} />
    );

    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});
