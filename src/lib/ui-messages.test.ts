import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from './http';
import { describeError, emptyMessage, FILTERED_EMPTY_DESCRIPTION, GENERIC_ERROR_MESSAGE, OFFLINE_ERROR_MESSAGE } from './ui-messages';

const LABELS = { empty: 'Ainda não há clientes', notFound: 'Nenhum cliente encontrado' };

describe('emptyMessage', () => {
  it('sem filtro: o recurso está realmente vazio', () => {
    expect(emptyMessage(LABELS, false)).toEqual({ title: 'Ainda não há clientes', description: 'Quando houver registros, eles aparecem aqui.' });
  });
  it('com filtro: sugere ajustar a busca', () => {
    expect(emptyMessage(LABELS, true)).toEqual({ title: 'Nenhum cliente encontrado', description: FILTERED_EMPTY_DESCRIPTION });
  });
});

describe('describeError', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('falha de conexão online: mantém a mensagem da rede e permite tentar de novo', () => {
    expect(describeError(new NetworkError())).toMatchObject({ kind: 'network', retryable: true });
  });
  it('falha de conexão com o navegador offline: mensagem de offline', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(describeError(new NetworkError())).toEqual({ kind: 'offline', message: OFFLINE_ERROR_MESSAGE, retryable: true });
  });
  it('erros da API: classifica pelo status', () => {
    expect(describeError(new ApiError('Servidor caiu', 500))).toMatchObject({ kind: 'server', retryable: true });
    expect(describeError(new ApiError('Sem permissão', 403))).toMatchObject({ kind: 'forbidden', retryable: false });
    expect(describeError(new ApiError('Sessão expirada', 401))).toMatchObject({ kind: 'session', retryable: false });
    expect(describeError(new ApiError('Conflito', 409))).toMatchObject({ kind: 'generic', message: 'Conflito', retryable: false });
  });
  it('erro desconhecido usa o texto padrão (ou o informado)', () => {
    expect(describeError(new Error('x'))).toMatchObject({ kind: 'generic', message: GENERIC_ERROR_MESSAGE });
    expect(describeError('x', 'Falhou ao salvar').message).toBe('Falhou ao salvar');
  });
});
