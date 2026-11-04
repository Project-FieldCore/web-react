import { describe, expect, it } from 'vitest';
import {
  INACTIVE_TECHNICIAN_MESSAGE,
  NOT_A_TECHNICIAN_MESSAGE,
  NOT_REASSIGNABLE_MESSAGE,
  SAME_TECHNICIAN_MESSAGE,
  SYNC_NOTICE,
  UNKNOWN_TECHNICIAN_MESSAGE,
  activeTechnicians,
  assignBlockedReason,
  canReassign,
  isAssignable,
  reassignBlockedReason,
} from './technician-rules';
import type { InspectionStatus, User, UserRole, UserStatus } from '@/types';

const user = (over: Partial<User> = {}): User => ({
  id: 'u1',
  nome: 'Marcos',
  email: 'm@x.com',
  role: 'TECHNICIAN',
  status: 'ATIVO',
  ...over,
});

describe('isAssignable / assignBlockedReason (RN-027)', () => {
  it('só técnico ativo recebe atribuição', () => {
    expect(isAssignable(user())).toBe(true);
    expect(assignBlockedReason(user())).toBeNull();
  });

  it('técnico inativo ou bloqueado é recusado com a mensagem da RN-027', () => {
    for (const status of ['INATIVO', 'BLOQUEADO'] as UserStatus[]) {
      expect(isAssignable(user({ status }))).toBe(false);
      expect(assignBlockedReason(user({ status }))).toBe(INACTIVE_TECHNICIAN_MESSAGE);
    }
    expect(INACTIVE_TECHNICIAN_MESSAGE).toBe('Somente técnicos ativos podem receber uma nova atribuição (RN-027).');
  });

  it('quem não é técnico é recusado, mesmo ativo', () => {
    for (const role of ['ADMIN', 'SUPERVISOR', 'CLIENT_VIEWER'] as UserRole[]) {
      expect(isAssignable(user({ role }))).toBe(false);
      expect(assignBlockedReason(user({ role }))).toBe(NOT_A_TECHNICIAN_MESSAGE);
    }
  });

  it('o perfil é conferido antes da situação', () => {
    expect(assignBlockedReason(user({ role: 'ADMIN', status: 'INATIVO' }))).toBe(NOT_A_TECHNICIAN_MESSAGE);
  });

  it('usuário fora da lista carregada pede para recarregar', () => {
    expect(assignBlockedReason(undefined)).toBe(UNKNOWN_TECHNICIAN_MESSAGE);
  });
});

describe('activeTechnicians', () => {
  it('filtra só técnicos ativos', () => {
    const list = [
      user({ id: 'a', nome: 'Ana' }),
      user({ id: 'b', nome: 'Bia', status: 'INATIVO' }),
      user({ id: 'c', nome: 'Caio', role: 'SUPERVISOR' }),
      user({ id: 'd', nome: 'Davi', status: 'BLOQUEADO' }),
    ];

    expect(activeTechnicians(list).map((u) => u.id)).toEqual(['a']);
  });

  it('ordena em ordem alfabética sem diferenciar acento nem maiúscula', () => {
    const list = [user({ id: '1', nome: 'zélia' }), user({ id: '2', nome: 'Álvaro' }), user({ id: '3', nome: 'bruno' }), user({ id: '4', nome: 'Alice' })];

    expect(activeTechnicians(list).map((u) => u.nome)).toEqual(['Alice', 'Álvaro', 'bruno', 'zélia']);
  });

  it('lista vazia continua vazia', () => {
    expect(activeTechnicians([])).toEqual([]);
  });
});

describe('canReassign / reassignBlockedReason', () => {
  const ALL: InspectionStatus[] = ['RASCUNHO', 'ATRIBUIDA', 'EM_ANDAMENTO', 'ENVIADA', 'EM_REVISAO', 'DEVOLVIDA', 'APROVADA', 'REPROVADA', 'CANCELADA'];

  it('só inspeção atribuída ou em rascunho troca de técnico', () => {
    expect(ALL.filter(canReassign)).toEqual(['RASCUNHO', 'ATRIBUIDA']);
  });

  it('outros estados são recusados com a mensagem da API', () => {
    expect(reassignBlockedReason({ status: 'EM_ANDAMENTO', tecnicoId: 'a' }, 'b')).toBe(NOT_REASSIGNABLE_MESSAGE);
    expect(reassignBlockedReason({ status: 'CANCELADA', tecnicoId: 'a' }, 'b')).toBe(NOT_REASSIGNABLE_MESSAGE);
  });

  it('o mesmo técnico não conta como troca', () => {
    expect(reassignBlockedReason({ status: 'ATRIBUIDA', tecnicoId: 'a' }, 'a')).toBe(SAME_TECHNICIAN_MESSAGE);
  });

  it('atribuída e técnico diferente pode', () => {
    expect(reassignBlockedReason({ status: 'ATRIBUIDA', tecnicoId: 'a' }, 'b')).toBeNull();
  });

  it('o aviso de sincronização cita a RN-028', () => {
    expect(SYNC_NOTICE).toContain('RN-028');
    expect(SYNC_NOTICE).toContain('sincronização');
  });
});
