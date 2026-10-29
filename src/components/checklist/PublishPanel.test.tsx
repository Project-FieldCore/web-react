import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublishConfirmDialog, PublishPanel } from './PublishPanel';
import { publishState } from '@/lib/publish-state';
import { startNewVersion } from '@/lib/model-versions';
import type { InspectionModel, ModelItem, ModelSection } from '@/types';

const item = (over: Partial<ModelItem> = {}): ModelItem => ({
  id: 'i1',
  title: 'Item',
  type: 'CONFORMITY',
  required: true,
  evidenceRequiredOnFailure: false,
  observationRequiredOnFailure: false,
  ...over,
});
const section = (over: Partial<ModelSection> = {}): ModelSection => ({ id: 's1', title: 'Seção', displayOrder: 0, items: [item()], ...over });
const model = (over: Partial<InspectionModel> = {}): InspectionModel => ({
  id: 'm1',
  title: 'Inspeção de extintores',
  description: '',
  category: 'Segurança',
  status: 'RASCUNHO',
  version: 0,
  sections: [section()],
  updatedAt: '2026-10-01T10:00:00.000Z',
  ...over,
});

const noop = () => {};
const panel = (m: InspectionModel, over: { publishing?: boolean; busy?: boolean } = {}) =>
  renderToStaticMarkup(
    <PublishPanel
      model={m}
      state={publishState(m)}
      publishing={over.publishing ?? false}
      busy={over.busy ?? false}
      onJump={noop}
      onPublish={noop}
      onStartNewVersion={noop}
      onDiscard={noop}
    />
  );
const buttonOf = (html: string, label: string) => new RegExp(`<button[^>]*>${label}</button>`).exec(html)?.[0] ?? '';

describe('PublishPanel — rascunho', () => {
  it('sem pendências: "Nenhuma pendência" e botão Publicar habilitado', () => {
    const html = panel(model());

    expect(html).toContain('Nenhuma pendência');
    expect(buttonOf(html, 'Publicar versão')).not.toContain('disabled=""');
    expect(html).not.toContain('role="alert"');
  });

  it('lista as pendências reais, com "Ir para", e desabilita Publicar dizendo por quê', () => {
    const html = panel(model({ title: '', category: '', sections: [] }));

    expect(html).toContain('role="alert"');
    expect(html).toContain('3 pendências impedem a publicação');
    expect(html).toContain('Informe um título para o modelo.');
    expect(html).toContain('Informe a categoria do modelo.');
    expect(html).toContain('Adicione ao menos uma seção com itens (RN-015).');
    expect((html.match(/Ir para/g) ?? []).length).toBe(3);
    expect(buttonOf(html, 'Publicar versão')).toContain('disabled=""');
    expect(html).toContain('Resolva as 3 pendências para publicar.');
  });

  it('a mensagem do motivo é ligada ao botão (acessível)', () => {
    const html = panel(model({ category: '' }));
    const describedBy = /aria-describedby="([^"]+)"/.exec(html)?.[1];

    expect(describedBy).toBeTruthy();
    expect(html).toContain(`id="${describedBy}"`);
  });

  it('avisos aparecem em "Atenção" e não bloqueiam', () => {
    const html = panel(model({ sections: [section(), section({ id: 's2', displayOrder: 1, title: 'Vazia', items: [] })] }));

    expect(html).toContain('Atenção');
    expect(html).toContain('A seção &quot;Vazia&quot; não tem itens.');
    expect(buttonOf(html, 'Publicar versão')).not.toContain('disabled=""');
  });

  it('não oferece criar nova versão nem descartar', () => {
    const html = panel(model());

    expect(html).not.toContain('Criar nova versão');
    expect(html).not.toContain('Descartar alterações');
  });

  it('mostra "Publicando..." e desabilita enquanto publica ou outra ação está em andamento', () => {
    expect(panel(model(), { publishing: true })).toContain('Publicando...');
    expect(buttonOf(panel(model(), { busy: true }), 'Publicar versão')).toContain('disabled=""');
  });
});

describe('PublishPanel — versão publicada (RN-019)', () => {
  const published = model({ status: 'PUBLICADO', version: 3 });

  it('avisa que é imutável, oferece criar nova versão e não mostra botão de publicar', () => {
    const html = panel(published);

    expect(html).toContain('Versão v3 publicada e imutável (RN-019)');
    expect(html).toContain('Criar nova versão');
    expect(html).not.toContain('Publicar nova versão');
    expect(html).not.toContain('Publicar versão');
    expect(html).not.toContain('Nenhuma pendência');
  });

  it('modelo arquivado não oferece nova versão', () => {
    const html = panel(model({ status: 'ARQUIVADO', version: 2 }));

    expect(html).toContain('Modelo arquivado');
    expect(html).not.toContain('Criar nova versão');
  });
});

describe('PublishPanel — nova versão (RN-020)', () => {
  const editing = (over: Partial<InspectionModel> = {}) => ({ ...startNewVersion(model({ status: 'PUBLICADO', version: 3 })), ...over });

  it('sem alterações: avisa, oferece descartar e desabilita publicar dizendo por quê', () => {
    const html = panel(editing());

    expect(html).toContain('Editando a nova versão (a partir da v3)');
    expect(html).toContain('Nenhuma alteração ainda');
    expect(html).toContain('Descartar alterações');
    expect(buttonOf(html, 'Publicar nova versão')).toContain('disabled=""');
    expect(html).toContain('Nenhuma alteração desde a versão v3.');
    expect(html).not.toContain('Criar nova versão');
  });

  it('com alteração: diz que a versão anterior continua valendo e habilita publicar', () => {
    const html = panel(editing({ title: 'Título revisado' }));

    expect(html).toContain('Há alterações ainda não publicadas');
    expect(html).toContain('continua valendo até você publicar');
    expect(buttonOf(html, 'Publicar nova versão')).not.toContain('disabled=""');
  });
});

describe('PublishConfirmDialog', () => {
  const m = model({
    sections: [
      section({ items: [item({ id: 'a', required: true }), item({ id: 'b', required: false })] }),
      section({ id: 's2', displayOrder: 1, items: [item({ id: 'c', required: true })] }),
    ],
  });
  const dialog = (over: { publishing?: boolean; error?: string | null } = {}) =>
    renderToStaticMarkup(
      <PublishConfirmDialog
        model={m}
        state={publishState(m)}
        publishing={over.publishing ?? false}
        error={over.error ?? null}
        onConfirm={noop}
        onCancel={noop}
      />
    );

  it('é um diálogo acessível, com o resumo do que será publicado', () => {
    const html = dialog();

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Publicar versão');
    expect(html).toContain('Inspeção de extintores');
    expect(html).toMatch(/<dd[^>]*>2<\/dd><dt[^>]*>Seções/);
    expect(html).toMatch(/<dd[^>]*>3<\/dd><dt[^>]*>Itens/);
    expect(html).toMatch(/<dd[^>]*>2<\/dd><dt[^>]*>Obrigatórios/);
  });

  it('avisa que a versão publicada não poderá ser alterada', () => {
    const html = dialog();

    expect(html).toContain('não poderá ser alterada');
    expect(html).toContain('RN-019');
    expect(html).toContain('RN-020');
  });

  it('tem Cancelar e Confirmar', () => {
    const html = dialog();

    expect(html).toContain('Cancelar');
    expect(html).toContain('Confirmar publicação');
  });

  it('mostra o erro da publicação dentro do diálogo', () => {
    const html = dialog({ error: 'Não foi possível publicar o modelo. Tente novamente.' });

    expect(html).toContain('role="alert"');
    expect(html).toContain('Não foi possível publicar o modelo. Tente novamente.');
  });

  it('enquanto publica: "Publicando..." e os dois botões desabilitados', () => {
    const html = dialog({ publishing: true });

    expect(html).toContain('Publicando...');
    expect(html).not.toContain('Confirmar publicação');
    expect((html.match(/<button[^>]*disabled=""/g) ?? []).length).toBe(2);
  });

  it('nova versão usa o rótulo "Publicar nova versão"', () => {
    const editing = { ...startNewVersion(model({ status: 'PUBLICADO', version: 3 })), title: 'Revisado' };
    const html = renderToStaticMarkup(
      <PublishConfirmDialog model={editing} state={publishState(editing)} publishing={false} error={null} onConfirm={noop} onCancel={noop} />
    );

    expect(html).toContain('Publicar nova versão');
  });
});
