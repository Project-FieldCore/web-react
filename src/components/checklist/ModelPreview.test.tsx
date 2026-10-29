import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModelPreview } from './ModelPreview';
import type { InspectionModel, ItemType, ModelItem, ModelSection } from '@/types';

const item = (id: string, type: ItemType, over: Partial<ModelItem> = {}): ModelItem => ({
  id,
  title: `Item ${id}`,
  type,
  required: false,
  evidenceRequiredOnFailure: false,
  observationRequiredOnFailure: false,
  options: type === 'SINGLE_CHOICE' ? ['Boa', 'Ruim'] : undefined,
  ...over,
});
const section = (id: string, displayOrder: number, items: ModelItem[], title = `Seção ${id}`): ModelSection => ({
  id,
  title,
  displayOrder,
  items,
});
const model = (over: Partial<InspectionModel> = {}): InspectionModel => ({
  id: 'm1',
  title: 'Inspeção de extintores',
  description: '',
  category: 'Segurança',
  status: 'RASCUNHO',
  version: 0,
  sections: [section('a', 0, [item('x', 'CONFORMITY')])],
  updatedAt: '2026-10-01T10:00:00.000Z',
  ...over,
});

const render = (m: InspectionModel) => renderToStaticMarkup(<ModelPreview model={m} onClose={() => {}} />);

const ALL_TYPES: ItemType[] = ['TEXT_SHORT', 'TEXT_LONG', 'NUMBER', 'DATE', 'BOOLEAN', 'CONFORMITY', 'SINGLE_CHOICE'];

describe('ModelPreview', () => {
  it('é um diálogo acessível, com o título do modelo e a categoria', () => {
    const html = render(model());

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toMatch(/aria-labelledby="([^"]+)"/);
    expect(html).toContain('Inspeção de extintores');
    expect(html).toContain('Segurança');
  });

  it('não promete paridade com o aplicativo de campo', () => {
    const html = render(model());

    expect(html).toContain('Prévia no painel web');
    expect(html).toContain('O aplicativo de campo pode ter outra aparência');
    expect(html).toContain('não é salvo');
    expect(html).not.toContain('como o técnico verá');
  });

  it('renderiza o componente real de cada um dos 7 tipos', () => {
    const html = render(model({ sections: [section('a', 0, ALL_TYPES.map((type) => item(type, type)))] }));

    for (const type of ALL_TYPES) expect(html).toContain(`data-item-type="${type}"`);
  });

  it('mostra as seções na ordem explícita, não na ordem do array', () => {
    const html = render(
      model({
        sections: [
          section('b', 1, [item('y', 'NUMBER')], 'Segunda'),
          section('a', 0, [item('x', 'DATE')], 'Primeira'),
        ],
      })
    );

    expect(html.indexOf('1. Primeira')).toBeGreaterThan(-1);
    expect(html.indexOf('1. Primeira')).toBeLessThan(html.indexOf('2. Segunda'));
  });

  it('modelo válido não mostra alerta de problemas', () => {
    const html = render(model());

    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('impedem a publicação');
    expect(html).not.toContain('impede a publicação');
  });

  describe('estado vazio', () => {
    it('modelo sem seções', () => {
      const html = render(model({ sections: [] }));

      expect(html).toContain('Este modelo ainda não tem seções');
      expect(html).toContain('Adicione seções e itens no construtor');
    });

    it('seção sem itens', () => {
      const html = render(model({ sections: [section('a', 0, [item('x', 'NUMBER')]), section('b', 1, [], 'Vazia')] }));

      expect(html).toContain('Nenhum item nesta seção.');
    });
  });

  describe('estado de erro', () => {
    it('lista o problema único no singular', () => {
      const html = render(model({ title: '' }));

      expect(html).toContain('role="alert"');
      expect(html).toContain('1 problema impede a publicação');
      expect(html).toContain('Informe um título para o modelo.');
      expect(html).toContain('Modelo sem título');
    });

    it('lista vários problemas no plural', () => {
      const html = render(model({ title: '', sections: [] }));

      expect(html).toContain('2 problemas impedem a publicação');
    });

    it('seleção única sem alternativas aparece na lista e no próprio item', () => {
      const html = render(
        model({ sections: [section('a', 0, [item('c', 'SINGLE_CHOICE', { title: 'Estado', options: [] })])] })
      );

      expect(html).toContain('O item &quot;Estado&quot; é de seleção única e precisa de alternativas.');
      expect(html).toContain('ainda não tem alternativas');
    });

    it('avisos (não bloqueiam) aparecem em "Atenção", sem o alerta de erro', () => {
      const html = render(model({ sections: [section('a', 0, [item('x', 'NUMBER')]), section('b', 1, [], 'Vazia')] }));

      expect(html).toContain('Atenção');
      expect(html).toContain('A seção &quot;Vazia&quot; não tem itens.');
      expect(html).not.toContain('impede a publicação');
    });
  });

  it('mostra a descrição quando existe', () => {
    expect(render(model({ description: 'Checklist mensal de segurança' }))).toContain('Checklist mensal de segurança');
  });

  it('tem o botão Fechar', () => {
    expect(render(model())).toContain('Fechar');
  });
});
