import { describe, expect, it } from 'vitest';
import { blockingIssues, validateModel } from './model-validation';
import type { ModelItem, ModelSection } from '@/types';

const item = (over: Partial<ModelItem> = {}): ModelItem => ({
  id: 'i1',
  title: 'Extintor dentro da validade',
  type: 'CONFORMITY',
  required: false,
  evidenceRequiredOnFailure: false,
  observationRequiredOnFailure: false,
  ...over,
});
const section = (over: Partial<ModelSection> = {}): ModelSection => ({
  id: 's1',
  title: 'Segurança',
  displayOrder: 0,
  items: [item()],
  ...over,
});
const model = (over: { title?: string; sections?: ModelSection[] } = {}) => ({
  title: 'Inspeção de extintores',
  sections: [section()],
  ...over,
});
const errors = (m: ReturnType<typeof model>) => blockingIssues(validateModel(m)).map((i) => i.message);
const warnings = (m: ReturnType<typeof model>) => validateModel(m).filter((i) => i.severity === 'warning').map((i) => i.message);

describe('validateModel', () => {
  it('modelo completo não tem problemas', () => {
    expect(validateModel(model())).toEqual([]);
  });

  it('título vazio ou só com espaços impede publicar', () => {
    expect(errors(model({ title: '   ' }))).toEqual(['Informe um título para o modelo.']);
  });

  it('sem seções impede publicar (RN-015)', () => {
    expect(errors(model({ sections: [] }))).toEqual(['Adicione ao menos uma seção com itens (RN-015).']);
  });

  it('com seções mas nenhum item impede publicar (RN-015) e avisa das seções vazias', () => {
    const m = model({ sections: [section({ items: [] }), section({ id: 's2', displayOrder: 1, title: 'Outra', items: [] })] });

    expect(errors(m)).toEqual(['Adicione ao menos um item válido antes de publicar (RN-015).']);
    expect(warnings(m)).toEqual(['A seção "Segurança" não tem itens.', 'A seção "Outra" não tem itens.']);
  });

  it('seção vazia é só aviso quando há itens em outra seção', () => {
    const m = model({ sections: [section(), section({ id: 's2', displayOrder: 1, title: 'Vazia', items: [] })] });

    expect(errors(m)).toEqual([]);
    expect(warnings(m)).toEqual(['A seção "Vazia" não tem itens.']);
  });

  it('seção sem título impede publicar e aponta a posição', () => {
    const issues = validateModel(model({ sections: [section({ title: '  ' })] }));

    expect(issues).toEqual([
      { severity: 'error', message: 'A seção 1 está sem título.', sectionId: 's1' },
    ]);
  });

  it('item sem título impede publicar e aponta a seção e o item', () => {
    const issues = validateModel(model({ sections: [section({ items: [item({ title: '  ' })] })] }));

    expect(issues).toEqual([
      { severity: 'error', message: 'O item 1 da seção "Segurança" está sem título.', sectionId: 's1', itemId: 'i1' },
    ]);
  });

  it('item sem tipo de resposta impede publicar (RN-016)', () => {
    const m = model({ sections: [section({ items: [item({ type: undefined as never })] })] });

    expect(errors(m)).toContain('Todo item precisa de um tipo de resposta (RN-016).');
  });

  describe('seleção única', () => {
    const withOptions = (options: string[] | undefined) =>
      model({ sections: [section({ items: [item({ type: 'SINGLE_CHOICE', title: 'Estado', options })] })] });

    it('sem alternativas impede publicar', () => {
      expect(errors(withOptions(undefined))).toEqual(['O item "Estado" é de seleção única e precisa de alternativas.']);
      expect(errors(withOptions([]))).toEqual(['O item "Estado" é de seleção única e precisa de alternativas.']);
      expect(errors(withOptions(['  ', '']))).toEqual(['O item "Estado" é de seleção única e precisa de alternativas.']);
    });

    it('alternativas repetidas impedem publicar (a API recusa)', () => {
      expect(errors(withOptions(['Boa', 'Ruim', 'Boa']))).toEqual(['O item "Estado" tem alternativas repetidas.']);
    });

    it('uma só alternativa é aviso, não erro', () => {
      expect(errors(withOptions(['Boa']))).toEqual([]);
      expect(warnings(withOptions(['Boa']))).toEqual(['O item "Estado" tem uma única alternativa.']);
    });

    it('duas ou mais alternativas diferentes estão ok', () => {
      expect(validateModel(withOptions(['Boa', 'Ruim']))).toEqual([]);
    });

    it('outros tipos não são cobrados por alternativas', () => {
      const m = model({ sections: [section({ items: [item({ type: 'TEXT_SHORT', options: undefined })] })] });

      expect(validateModel(m)).toEqual([]);
    });
  });

  it('os problemas seguem a ordem explícita das seções', () => {
    const m = model({
      sections: [
        section({ id: 'b', title: 'Segunda', displayOrder: 1, items: [item({ id: 'ib', title: '' })] }),
        section({ id: 'a', title: 'Primeira', displayOrder: 0, items: [item({ id: 'ia', title: '' })] }),
      ],
    });

    expect(errors(m)).toEqual([
      'O item 1 da seção "Primeira" está sem título.',
      'O item 1 da seção "Segunda" está sem título.',
    ]);
  });

  it('acumula vários problemas de uma vez', () => {
    const m = model({ title: '', sections: [section({ title: '', items: [item({ title: '' })] })] });

    expect(errors(m)).toHaveLength(3);
  });
});
