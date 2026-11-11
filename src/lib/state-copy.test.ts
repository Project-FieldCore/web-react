import { describe, expect, it } from 'vitest';

import { ApiError, NetworkError } from '@/lib/http';
import {
  FORBIDDEN_MESSAGE,
  FORBIDDEN_TITLE,
  NETWORK_LOAD_MESSAGE,
  describeLoadError,
  emptyListCopy,
} from '@/lib/state-copy';

describe('describeLoadError (PBI-0064.1)', () => {
  it('mapeia NetworkError para copy de rede com retry', () => {
    expect(describeLoadError(new NetworkError())).toEqual({
      title: 'Algo deu errado',
      message: NETWORK_LOAD_MESSAGE,
      retry: true,
    });
  });

  it('mapeia 403 / ACCESS_DENIED sem retry', () => {
    expect(describeLoadError(new ApiError('x', 403, undefined, 'ACCESS_DENIED'))).toEqual({
      title: FORBIDDEN_TITLE,
      message: FORBIDDEN_MESSAGE,
      retry: false,
      status: 403,
      code: 'ACCESS_DENIED',
    });
  });

  it('mapeia 5xx para copy genérica com retry', () => {
    expect(describeLoadError(new ApiError('boom', 502))).toMatchObject({
      title: 'Algo deu errado',
      message: 'Não foi possível carregar. Tente novamente.',
      retry: true,
      status: 502,
    });
  });

  it('emptyListCopy formata título PT-BR', () => {
    expect(emptyListCopy('inspeção', 'f').title).toBe('Nenhuma inspeção encontrada');
    expect(emptyListCopy('modelo', 'm').title).toBe('Nenhum modelo encontrado');
  });
});
