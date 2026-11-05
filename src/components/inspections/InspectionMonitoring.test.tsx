import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MonitoringPanels } from './InspectionMonitoring';

describe('MonitoringPanels', () => {
  it('mostra a fotografia e a não conformidade sincronizadas', () => {
    const html = renderToStaticMarkup(
      <MonitoringPanels
        monitoring={{
          inspectionId: 'ins-1',
          evidences: [{ id: 'ev-1', inspectionItemId: 'item-1', fileName: 'foto.jpg', contentType: 'image/jpeg', sizeBytes: 2048, createdAt: '2026-11-05T12:00:00Z' }],
          nonConformities: [{ id: 'nc-1', severity: 'HIGH', description: 'Proteção ausente', status: 'OPEN', createdAt: '2026-11-05T12:00:00Z' }],
        }}
      />,
    );
    expect(html).toContain('foto.jpg');
    expect(html).toContain('Alta');
    expect(html).toContain('Proteção ausente');
  });

  it('explica quando ainda não há nada sincronizado', () => {
    const html = renderToStaticMarkup(
      <MonitoringPanels monitoring={{ inspectionId: 'ins-1', evidences: [], nonConformities: [] }} />,
    );
    expect(html).toContain('Nenhuma evidência ou não conformidade sincronizada.');
  });
});
