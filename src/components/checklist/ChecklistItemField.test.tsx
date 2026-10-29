import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChecklistItemField } from './ChecklistItemField';
import type { PreviewAnswer } from '@/lib/item-field';
import type { ItemType, ModelItem } from '@/types';

const item = (over: Partial<ModelItem> = {}): ModelItem => ({
  id: 'i1',
  title: 'Estado do equipamento',
  type: 'TEXT_SHORT',
  required: false,
  evidenceRequiredOnFailure: false,
  observationRequiredOnFailure: false,
  ...over,
});

const render = (it: ModelItem, answer?: PreviewAnswer) =>
  renderToStaticMarkup(<ChecklistItemField item={it} answer={answer} onChange={() => {}} />);
const count = (html: string, text: string) => html.split(text).length - 1;

describe('ChecklistItemField — um controle real por tipo', () => {
  it('TEXT_SHORT: campo de texto de uma linha', () => {
    const html = render(item({ type: 'TEXT_SHORT' }));

    expect(html).toContain('type="text"');
    expect(html).not.toContain('<textarea');
  });

  it('TEXT_LONG: área de texto', () => {
    expect(render(item({ type: 'TEXT_LONG' }))).toContain('<textarea');
  });

  it('NUMBER: campo numérico', () => {
    expect(render(item({ type: 'NUMBER' }))).toContain('type="number"');
  });

  it('DATE: campo de data', () => {
    expect(render(item({ type: 'DATE' }))).toContain('type="date"');
  });

  it('BOOLEAN: grupo Sim/Não', () => {
    const html = render(item({ type: 'BOOLEAN' }));

    expect(html).toContain('role="radiogroup"');
    expect(count(html, 'type="radio"')).toBe(2);
    expect(html).toContain('Sim');
    expect(html).toContain('Não');
  });

  it('CONFORMITY: Conforme, Não conforme e Não aplicável', () => {
    const html = render(item({ type: 'CONFORMITY' }));

    expect(count(html, 'type="radio"')).toBe(3);
    for (const label of ['Conforme', 'Não conforme', 'Não aplicável']) expect(html).toContain(label);
  });

  it('SINGLE_CHOICE: uma opção por alternativa cadastrada', () => {
    const html = render(item({ type: 'SINGLE_CHOICE', options: ['Boa', 'Regular', 'Ruim'] }));

    expect(count(html, 'type="radio"')).toBe(3);
    for (const label of ['Boa', 'Regular', 'Ruim']) expect(html).toContain(label);
  });

  it('SINGLE_CHOICE sem alternativas mostra o erro em vez de um grupo vazio', () => {
    const html = render(item({ type: 'SINGLE_CHOICE', options: [] }));

    expect(html).toContain('role="alert"');
    expect(html).toContain('ainda não tem alternativas');
    expect(html).not.toContain('type="radio"');
  });

  it('cada tipo gera marcação diferente e identifica o tipo no elemento', () => {
    const types: ItemType[] = ['TEXT_SHORT', 'TEXT_LONG', 'NUMBER', 'DATE', 'BOOLEAN', 'CONFORMITY', 'SINGLE_CHOICE'];
    const outputs = types.map((type) => render(item({ type, options: ['A', 'B'] })));

    expect(new Set(outputs).size).toBe(types.length);
    types.forEach((type, i) => expect(outputs[i]).toContain(`data-item-type="${type}"`));
  });
});

describe('ChecklistItemField — título, obrigatório e resposta', () => {
  it('item obrigatório marca com asterisco e avisa leitores de tela', () => {
    const html = render(item({ required: true }));

    expect(html).toContain('(obrigatório)');
    expect(html).toContain('*');
  });

  it('item opcional não marca', () => {
    expect(render(item({ required: false }))).not.toContain('(obrigatório)');
  });

  it('título vazio vira "Item sem título"', () => {
    expect(render(item({ title: '   ' }))).toContain('Item sem título');
  });

  it('o controle é associado ao título (acessível por leitor de tela)', () => {
    const html = render(item({ type: 'TEXT_SHORT' }));
    const labelId = /id="([^"]+-label)"/.exec(html)?.[1];

    expect(labelId).toBeTruthy();
    expect(html).toContain(`aria-labelledby="${labelId}"`);
  });

  it('a resposta atual aparece marcada', () => {
    const html = render(item({ type: 'CONFORMITY' }), { conformity: 'CONFORME' });

    expect(count(html, 'checked=""')).toBe(1);
    expect(html).toMatch(/value="CONFORME"[^>]*checked=""|checked=""[^>]*value="CONFORME"/);
  });

  it('o texto digitado aparece no campo', () => {
    expect(render(item({ type: 'TEXT_SHORT' }), { value: 'Tudo certo' })).toContain('value="Tudo certo"');
  });
});

describe('ChecklistItemField — não conformidade (regras do #154)', () => {
  const nok: PreviewAnswer = { conformity: 'NAO_CONFORME' };

  it('"não conforme" mostra observação e evidência', () => {
    const html = render(item({ type: 'CONFORMITY' }), nok);

    expect(html).toContain('data-failure-details');
    expect(html).toContain('Observação');
    expect(html).toContain('Evidência');
  });

  it('marca como obrigatórias só o que o item exige', () => {
    const both = render(item({ type: 'CONFORMITY', observationRequiredOnFailure: true, evidenceRequiredOnFailure: true }), nok);
    const none = render(item({ type: 'CONFORMITY' }), nok);
    const onlyEvidence = render(item({ type: 'CONFORMITY', evidenceRequiredOnFailure: true }), nok);

    expect(count(both, 'obrigatória')).toBe(2);
    expect(none).not.toContain('obrigatória');
    expect(count(onlyEvidence, 'obrigatória')).toBe(1);
  });

  it('o anexo de evidência não é simulado: botão desabilitado com aviso', () => {
    const html = render(item({ type: 'CONFORMITY', evidenceRequiredOnFailure: true }), nok);

    expect(html).toMatch(/<button[^>]*disabled[^>]*>Anexar evidência/);
    expect(html).toContain('não está disponível na prévia');
  });

  it('conforme ou sem resposta não mostra o bloco', () => {
    expect(render(item({ type: 'CONFORMITY' }), { conformity: 'CONFORME' })).not.toContain('data-failure-details');
    expect(render(item({ type: 'CONFORMITY' }))).not.toContain('data-failure-details');
  });

  it('outros tipos nunca mostram o bloco', () => {
    expect(render(item({ type: 'NUMBER', observationRequiredOnFailure: true }), nok)).not.toContain('data-failure-details');
  });

  it('a observação digitada aparece no campo', () => {
    const html = render(item({ type: 'CONFORMITY' }), { conformity: 'NAO_CONFORME', observacao: 'Corrosão na base' });

    expect(html).toContain('Corrosão na base');
  });
});
