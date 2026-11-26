import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DownloadReportButton } from './DownloadReportButton';

describe('DownloadReportButton', () => {
  it('estado inicial: botão "Baixar PDF" habilitado, sem mensagens', () => {
    const html = renderToStaticMarkup(<DownloadReportButton inspectionId="insp-1" />);
    expect(html).toContain('Baixar PDF');
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('PDF baixado');
  });
});
