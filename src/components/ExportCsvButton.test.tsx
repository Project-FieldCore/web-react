import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExportCsvButton } from './ExportCsvButton';

const onExport = vi.fn(async () => new Blob(['x']));

describe('ExportCsvButton', () => {
  it('estado inicial: botão "Exportar CSV" habilitado, sem mensagens', () => {
    const html = renderToStaticMarkup(<ExportCsvButton fileName="users.csv" onExport={onExport} />);
    expect(html).toContain('Exportar CSV');
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('CSV exportado');
  });

  it('desabilitado (lista vazia): mostra o motivo ao passar o mouse', () => {
    const html = renderToStaticMarkup(
      <ExportCsvButton fileName="users.csv" onExport={onExport} disabled disabledReason="Não há usuários para exportar." />
    );
    expect(html).toContain('disabled=""');
    expect(html).toContain('title="Não há usuários para exportar."');
  });

  it('habilitado não mostra "title" de motivo', () => {
    const html = renderToStaticMarkup(<ExportCsvButton fileName="users.csv" onExport={onExport} disabledReason="x" />);
    expect(html).not.toContain('title=');
  });

  it('aviso opcional (limite de linhas) aparece abaixo do botão', () => {
    const html = renderToStaticMarkup(
      <ExportCsvButton fileName="inspections.csv" onExport={onExport} note="Serão exportadas as primeiras 10.000 inspeções." />
    );
    expect(html).toContain('Serão exportadas as primeiras 10.000 inspeções.');
  });

  it('rótulo personalizado', () => {
    expect(renderToStaticMarkup(<ExportCsvButton label="Exportar clientes" fileName="clients.csv" onExport={onExport} />)).toContain('Exportar clientes');
  });
});
