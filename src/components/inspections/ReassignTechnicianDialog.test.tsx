import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReassignTechnicianDialog } from './ReassignTechnicianDialog';

const render = (over: Partial<Parameters<typeof ReassignTechnicianDialog>[0]> = {}) =>
  renderToStaticMarkup(
    <ReassignTechnicianDialog inspectionId="INS-4482" currentTechnicianName="Marcos Silva" onConfirm={async () => ({ ok: true })} onClose={() => {}} {...over} />
  );

describe('ReassignTechnicianDialog', () => {
  it('é um diálogo acessível com a inspeção e o técnico atual', () => {
    const html = render();

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toMatch(/aria-labelledby="([^"]+)"/);
    expect(html).toContain('Alterar técnico');
    expect(html).toContain('INS-4482 · atualmente com Marcos Silva');
  });

  it('funciona sem o nome do técnico atual', () => {
    const html = render({ currentTechnicianName: undefined });

    expect(html).toContain('INS-4482');
    expect(html).not.toContain('atualmente com');
    expect(html).not.toContain('undefined');
  });

  it('o novo técnico é obrigatório e o campo é associado ao rótulo', () => {
    const html = render();

    expect(html).toContain('Novo técnico');
    expect(html).toMatch(/<label[^>]*for="([^"]+)"/);
    expect(html).toContain('<select');
  });

  it('explica a regra: só técnicos ativos (RN-027)', () => {
    expect(render()).toContain('Só técnicos ativos aparecem (RN-027)');
  });

  it('tem Cancelar e Confirmar, habilitados no início, e nenhum alerta', () => {
    const html = render();

    expect(html).toContain('Cancelar');
    expect(html).toContain('>Confirmar<');
    expect(html).not.toContain('role="alert"');
  });
});
