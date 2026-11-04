import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TechnicianSelect, type TechniciansLoadStatus } from './TechnicianSelect';
import type { User } from '@/types';

const user = (over: Partial<User>): User => ({ id: 'u', nome: 'Pessoa', email: 'p@x.com', role: 'TECHNICIAN', status: 'ATIVO', ...over });
const USERS: User[] = [
  user({ id: 'z', nome: 'Zélia' }),
  user({ id: 'a', nome: 'Ana' }),
  user({ id: 'i', nome: 'Inativo Silva', status: 'INATIVO' }),
  user({ id: 's', nome: 'Supervisor Souza', role: 'SUPERVISOR' }),
];

const render = (status: TechniciansLoadStatus, over: Partial<Parameters<typeof TechnicianSelect>[0]> = {}) =>
  renderToStaticMarkup(
    <TechnicianSelect id="tech" value="" users={USERS} status={status} onChange={() => {}} onRetry={() => {}} {...over} />
  );
const options = (html: string) => [...html.matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map((m) => m[1]);

describe('TechnicianSelect', () => {
  it('lista só técnicos ativos, em ordem alfabética (RN-027)', () => {
    const html = render('ready');

    expect(options(html)).toEqual(['Selecione...', 'Ana', 'Zélia']);
    expect(html).not.toContain('Inativo Silva');
    expect(html).not.toContain('Supervisor Souza');
  });

  it('com a lista pronta, o campo está habilitado e sem avisos', () => {
    const html = render('ready');

    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('aria-describedby');
  });

  it('carregando: campo desabilitado, "Carregando técnicos..." e marcado como ocupado', () => {
    for (const status of ['idle', 'loading'] as const) {
      const html = render(status);

      expect(html).toContain('Carregando técnicos...');
      expect(html).toContain('disabled=""');
      expect(html).toContain('aria-busy="true"');
    }
  });

  it('vazio (sem técnico ativo): campo desabilitado e a mensagem da RN-027', () => {
    const html = render('ready', { users: [user({ id: 'i', status: 'INATIVO' })] });

    expect(options(html)).toEqual(['Nenhum técnico disponível']);
    expect(html).toContain('disabled=""');
    expect(html).toContain('Nenhum técnico ativo disponível para atribuição (RN-027).');
    expect(html).toMatch(/aria-describedby="tech-note"/);
    expect(html).toContain('id="tech-note"');
  });

  it('erro: mostra a mensagem em alerta e o botão "Tentar novamente"', () => {
    const html = render('error', { error: 'Sem conexão.' });

    expect(html).toContain('role="alert"');
    expect(html).toContain('Sem conexão.');
    expect(html).toContain('Tentar novamente');
  });

  it('erro sem onRetry não mostra o botão', () => {
    expect(render('error', { onRetry: undefined })).not.toContain('Tentar novamente');
  });

  it('indisponível para o perfil (supervisor): explica, sem alerta de erro', () => {
    const html = render('unavailable', { users: [], error: 'Seu perfil não pode listar técnicos pela API. Peça a um administrador para atribuir a inspeção.' });

    expect(html).toContain('role="note"');
    expect(html).toContain('Seu perfil não pode listar técnicos pela API');
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('disabled=""');
  });

  it('indisponível, mas com técnicos já conhecidos: ainda permite escolher e mantém o aviso', () => {
    const html = render('unavailable', { error: 'Lista limitada.' });

    expect(options(html)).toEqual(['Selecione...', 'Ana', 'Zélia']);
    expect(html).not.toContain('disabled=""');
    expect(html).toContain('Lista limitada.');
  });

  it('um técnico já escolhido continua com o campo habilitado mesmo se a lista esvaziar', () => {
    const html = render('ready', { users: [], value: 'a' });

    expect(html).not.toContain('disabled=""');
  });

  it('o campo pode ser desabilitado de fora (ex.: enquanto envia)', () => {
    expect(render('ready', { disabled: true })).toContain('disabled=""');
  });

  it('o técnico escolhido aparece selecionado', () => {
    expect(render('ready', { value: 'z' })).toMatch(/<option[^>]*value="z"[^>]*selected|selected[^>]*value="z"/);
  });
});
