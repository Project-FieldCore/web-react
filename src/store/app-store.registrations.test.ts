import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from './app-store';
import { ApiError, NetworkError } from '@/lib/http';
import type { Client, Location, User } from '@/types';

vi.mock('@/lib/clients-api', () => ({
  createClient: vi.fn(),
  updateClient: vi.fn(),
  setClientActive: vi.fn(),
}));
vi.mock('@/lib/locations-api', () => ({
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
  setLocationActive: vi.fn(),
}));
vi.mock('@/lib/users-api', () => ({
  createUser: vi.fn(),
  updateUser: vi.fn(),
  setUserStatus: vi.fn(),
}));

import * as clientsApi from '@/lib/clients-api';
import * as locationsApi from '@/lib/locations-api';
import * as usersApi from '@/lib/users-api';

function mocked<T extends (...args: never[]) => unknown>(fn: T) {
  return fn as unknown as ReturnType<typeof vi.fn>;
}

const EXISTING_CLIENT_ID = 'cli-1';

describe('useAppStore cadastros (clientes/locais/usuários) — #133', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('clients', () => {
    it('createClient chama a API e guarda a entidade retornada', async () => {
      const client: Client = { id: 'cli-9', nome: 'Novo Cliente', ativo: true };
      mocked(clientsApi.createClient).mockResolvedValue(client);

      const result = await useAppStore.getState().createClient('Novo Cliente');

      expect(result).toEqual({ ok: true, id: 'cli-9' });
      expect(useAppStore.getState().clients).toContainEqual(client);
    });

    it('createClient não chama a API com nome vazio', async () => {
      const result = await useAppStore.getState().createClient('   ');

      expect(result).toEqual({ ok: false, error: 'Informe o nome do cliente.' });
      expect(clientsApi.createClient).not.toHaveBeenCalled();
    });

    it('createClient propaga ApiError da API', async () => {
      mocked(clientsApi.createClient).mockRejectedValue(new ApiError('CNPJ inválido.', 422));

      const result = await useAppStore.getState().createClient('Cliente X');

      expect(result).toEqual({ ok: false, error: 'CNPJ inválido.' });
    });

    it('createClient propaga NetworkError da API', async () => {
      mocked(clientsApi.createClient).mockRejectedValue(new NetworkError('Sem conexão.'));

      const result = await useAppStore.getState().createClient('Cliente X');

      expect(result).toEqual({ ok: false, error: 'Sem conexão.' });
    });

    it('setClientActive atualiza o cliente com a resposta da API', async () => {
      const updated: Client = { id: EXISTING_CLIENT_ID, nome: 'Grupo Sorocaba Alimentos', ativo: false };
      mocked(clientsApi.setClientActive).mockResolvedValue(updated);

      const result = await useAppStore.getState().setClientActive(EXISTING_CLIENT_ID, false);

      expect(result).toEqual({ ok: true });
      expect(useAppStore.getState().clients.find((c) => c.id === EXISTING_CLIENT_ID)).toEqual(updated);
    });

    it('setClientActive repassa o erro da API sem alterar o estado local', async () => {
      mocked(clientsApi.setClientActive).mockRejectedValue(new ApiError('Não autorizado.', 403));
      const before = useAppStore.getState().clients.find((c) => c.id === EXISTING_CLIENT_ID);

      const result = await useAppStore.getState().setClientActive(EXISTING_CLIENT_ID, false);

      expect(result).toEqual({ ok: false, error: 'Não autorizado.' });
      expect(useAppStore.getState().clients.find((c) => c.id === EXISTING_CLIENT_ID)).toEqual(before);
    });
  });

  describe('locations', () => {
    it('createLocation não chama a API quando o cliente não existe (RN-009)', async () => {
      const result = await useAppStore.getState().createLocation('cli-inexistente', 'Depósito');

      expect(result).toEqual({ ok: false, error: 'Cliente não encontrado (RN-009).' });
      expect(locationsApi.createLocation).not.toHaveBeenCalled();
    });

    it('createLocation chama a API (contra /sites) e guarda a entidade retornada', async () => {
      const location: Location = { id: 'loc-9', clienteId: EXISTING_CLIENT_ID, nome: 'Depósito', ativo: true };
      mocked(locationsApi.createLocation).mockResolvedValue(location);

      const result = await useAppStore.getState().createLocation(EXISTING_CLIENT_ID, 'Depósito');

      expect(result).toEqual({ ok: true, id: 'loc-9' });
      expect(useAppStore.getState().locations).toContainEqual(location);
    });

    it('updateLocation propaga erro de rede', async () => {
      mocked(locationsApi.updateLocation).mockRejectedValue(new NetworkError('Sem conexão.'));

      const result = await useAppStore.getState().updateLocation('loc-1', { nome: 'Novo nome' });

      expect(result).toEqual({ ok: false, error: 'Sem conexão.' });
    });
  });

  describe('users', () => {
    it('createUser não chama a API com senha vazia', async () => {
      const result = await useAppStore.getState().createUser('Fulano', 'fulano@fieldcore.com', 'SUPERVISOR', '  ');

      expect(result).toEqual({ ok: false, error: 'Defina uma senha inicial.' });
      expect(usersApi.createUser).not.toHaveBeenCalled();
    });

    it('createUser não chama a API com e-mail já cadastrado', async () => {
      const existing = useAppStore.getState().users[0];

      const result = await useAppStore.getState().createUser('Fulano', existing.email, 'SUPERVISOR', 'senha123');

      expect(result).toEqual({ ok: false, error: 'Já existe um usuário com esse e-mail.' });
      expect(usersApi.createUser).not.toHaveBeenCalled();
    });

    it('createUser chama a API e guarda o usuário retornado', async () => {
      const user: User = { id: 'usr-9', nome: 'Fulano', email: 'fulano@fieldcore.com', role: 'SUPERVISOR', status: 'ATIVO' };
      mocked(usersApi.createUser).mockResolvedValue(user);

      const result = await useAppStore.getState().createUser('Fulano', 'fulano@fieldcore.com', 'SUPERVISOR', 'senha123');

      expect(result).toEqual({ ok: true, id: 'usr-9' });
      expect(useAppStore.getState().users).toContainEqual(user);
    });

    it('setUserStatus propaga ApiError e não altera o estado local', async () => {
      const existing = useAppStore.getState().users[0];
      mocked(usersApi.setUserStatus).mockRejectedValue(new ApiError('Não autorizado.', 403));

      const result = await useAppStore.getState().setUserStatus(existing.id, 'INATIVO');

      expect(result).toEqual({ ok: false, error: 'Não autorizado.' });
      expect(useAppStore.getState().users.find((u) => u.id === existing.id)).toEqual(existing);
    });

    it('approveAccessRequest cria o usuário via API e aprova a solicitação', async () => {
      const request = useAppStore.getState().accessRequests.find((r) => r.status === 'PENDENTE');
      if (!request) throw new Error('Fixture sem solicitação pendente para o teste.');
      const created: User = { id: 'usr-8', nome: request.nome, email: request.email, role: request.role, status: 'ATIVO' };
      mocked(usersApi.createUser).mockResolvedValue(created);

      const result = await useAppStore.getState().approveAccessRequest(request.id, 'senha123');

      expect(result).toEqual({ ok: true });
      expect(useAppStore.getState().accessRequests.find((r) => r.id === request.id)?.status).toBe('APROVADA');
      expect(useAppStore.getState().users).toContainEqual(created);
    });
  });
});
