import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MonitoringPanels } from './InspectionMonitoring';
import type { MonitoringEvidence } from '@/lib/inspections-api';

const evidence = (over: Partial<MonitoringEvidence> & Pick<MonitoringEvidence, 'id'>): MonitoringEvidence => ({
  inspectionItemId: 'item-1',
  itemTitle: 'Proteção ausente',
  sectionTitle: 'Estrutura',
  sectionOrder: 1,
  itemOrder: 1,
  fileName: 'foto.jpg',
  contentType: 'image/jpeg',
  sizeBytes: 2048,
  createdAt: '2026-11-05T12:00:00Z',
  ...over,
});

describe('MonitoringPanels', () => {
  it('mostra a fotografia com título do item e a não conformidade', () => {
    const html = renderToStaticMarkup(
      <MonitoringPanels
        inspectionId="ins-1"
        evidences={[evidence({ id: 'ev-1' })]}
        nonConformities={[
          { id: 'nc-1', severity: 'HIGH', description: 'Proteção ausente', status: 'OPEN', createdAt: '2026-11-05T12:00:00Z' },
        ]}
        onOpenEvidence={() => undefined}
      />,
    );
    expect(html).toContain('foto.jpg');
    expect(html).toContain('Proteção ausente');
    expect(html).toContain('Estrutura');
    expect(html).toContain('Ampliar evidência de Proteção ausente');
    expect(html).toContain('Alta');
  });

  it('explica quando ainda não há nada sincronizado', () => {
    const html = renderToStaticMarkup(
      <MonitoringPanels
        inspectionId="ins-1"
        evidences={[]}
        nonConformities={[]}
        onOpenEvidence={() => undefined}
      />,
    );
    expect(html).toContain('Nenhuma evidência ou não conformidade sincronizada.');
  });

  it('ordena/agrupa seções na galeria', () => {
    const html = renderToStaticMarkup(
      <MonitoringPanels
        inspectionId="ins-1"
        evidences={[
          evidence({ id: 'ev-2', sectionOrder: 2, sectionTitle: 'Elétrica', itemTitle: 'Disjuntor', fileName: 'b.jpg' }),
          evidence({ id: 'ev-1', sectionOrder: 1, sectionTitle: 'Estrutura', itemTitle: 'Trinca', fileName: 'a.jpg' }),
        ]}
        nonConformities={[]}
        onOpenEvidence={() => undefined}
      />,
    );
    const estrutura = html.indexOf('Estrutura');
    const eletrica = html.indexOf('Elétrica');
    expect(estrutura).toBeGreaterThan(-1);
    expect(eletrica).toBeGreaterThan(estrutura);
  });
});
