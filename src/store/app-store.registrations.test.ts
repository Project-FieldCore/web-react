import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from './app-store';
import { ApiError, NetworkError } from '@/lib/http';
import type { Client, Location, User } from '@/types';
import { CONTRACT_IDS } from '@/data/contract-mocks';

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
  listUsers: vi.fn(),
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

const EXISTING_CLIENT_ID = CONTRACT_IDS.client;

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
      const updated: Client = { id: EXISTING_CLIENT_ID, nome: 'Industria ABC', ativo: false };
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

      const result = await useAppStore.getState().updateLocation(CONTRACT_IDS.site, { nome: 'Novo nome' });

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

      const result = await useAppStore.getState().createUser('Fulano', existing.email, 'SUPERVISOR', 'senha1234');

      expect(result).toEqual({ ok: false, error: 'Já existe um usuário com esse e-mail.' });
      expect(usersApi.createUser).not.toHaveBeenCalled();
    });

    it('createUser chama a API e guarda o usuário retornado', async () => {
      const user: User = { id: 'usr-9', nome: 'Fulano', email: 'fulano@fieldcore.com', role: 'SUPERVISOR', status: 'ATIVO' };
      mocked(usersApi.createUser).mockResolvedValue(user);

      const result = await useAppStore.getState().createUser('Fulano', 'fulano@fieldcore.com', 'SUPERVISOR', 'senha1234');

      expect(result).toEqual({ ok: true, id: 'usr-9' });
      expect(useAppStore.getState().users).toContainEqual(user);
    });

    it('createUser não chama a API com senha menor que o mínimo da API (8)', async () => {
      const result = await useAppStore.getState().createUser('Beltrano', 'beltrano@fieldcore.com', 'SUPERVISOR', '1234567');

      expect(result).toEqual({ ok: false, error: 'A senha inicial deve ter ao menos 8 caracteres.' });
      expect(usersApi.createUser).not.toHaveBeenCalled();
    });

    it('createUser propaga e-mail duplicado (409) da API', async () => {
      mocked(usersApi.createUser).mockRejectedValue(
        new ApiError('Já existe um usuário com esse e-mail.', 409, undefined, 'EMAIL_ALREADY_EXISTS')
      );

      const result = await useAppStore.getState().createUser('Fulano', 'novo@fieldcore.com', 'SUPERVISOR', 'senha1234');

      expect(result).toEqual({ ok: false, error: 'Já existe um usuário com esse e-mail.' });
    });

    describe('com usuários carregados da API (com version)', () => {
      const loaded: User = { id: 'usr-1', nome: 'Ana', email: 'ana@fieldcore.com', role: 'ADMIN', status: 'ATIVO', version: 3 };

      beforeEach(() => {
        useAppStore.setState({ users: [loaded], usersStatus: 'ready', usersError: null });
      });

      it('setUserStatus envia o version e guarda o usuário retornado (com o version novo)', async () => {
        const updated: User = { ...loaded, status: 'INATIVO', version: 4 };
        mocked(usersApi.setUserStatus).mockResolvedValue(updated);

        const result = await useAppStore.getState().setUserStatus('usr-1', 'INATIVO');

        expect(result).toEqual({ ok: true });
        expect(usersApi.setUserStatus).toHaveBeenCalledWith('usr-1', 'INATIVO', 3);
        expect(useAppStore.getState().users).toEqual([updated]);
      });

      it('setUserStatus propaga ApiError e não altera o estado local', async () => {
        mocked(usersApi.setUserStatus).mockRejectedValue(new ApiError('Não autorizado.', 403));

        const result = await useAppStore.getState().setUserStatus('usr-1', 'INATIVO');

        expect(result).toEqual({ ok: false, error: 'Não autorizado.' });
        expect(useAppStore.getState().users).toEqual([loaded]);
      });

      it('updateUser envia o version e atualiza a lista', async () => {
        const updated: User = { ...loaded, nome: 'Ana Maria', version: 4 };
        mocked(usersApi.updateUser).mockResolvedValue(updated);

        const result = await useAppStore.getState().updateUser('usr-1', { nome: 'Ana Maria' });

        expect(result).toEqual({ ok: true });
        expect(usersApi.updateUser).toHaveBeenCalledWith('usr-1', { nome: 'Ana Maria' }, 3);
        expect(useAppStore.getState().users).toEqual([updated]);
      });

      it('VERSION_CONFLICT recarrega a lista (sem piscar loading) e devolve a mensagem', async () => {
        const fresh: User = { ...loaded, nome: 'Ana (outra pessoa editou)', version: 5 };
        mocked(usersApi.updateUser).mockRejectedValue(
          new ApiError('Este registro foi alterado por outra pessoa.', 409, undefined, 'VERSION_CONFLICT')
        );
        mocked(usersApi.listUsers).mockResolvedValue([fresh]);
        const statuses: string[] = [];
        const unsubscribe = useAppStore.subscribe((s) => statuses.push(s.usersStatus));

        const result = await useAppStore.getState().updateUser('usr-1', { nome: 'Ana Maria' });
        unsubscribe();

        expect(result).toEqual({ ok: false, error: 'Este registro foi alterado por outra pessoa.' });
        expect(useAppStore.getState().users).toEqual([fresh]);
        expect(statuses).not.toContain('loading');
      });

      it('sem version conhecido, não chama a API e pede para recarregar', async () => {
        useAppStore.setState({ users: [{ ...loaded, version: undefined }] });

        const result = await useAppStore.getState().setUserStatus('usr-1', 'INATIVO');

        expect(result).toEqual({ ok: false, error: 'Recarregue a lista de usuários e tente de novo.' });
        expect(usersApi.setUserStatus).not.toHaveBeenCalled();
      });
    });

    describe('loadUsers', () => {
      it('carrega a lista da API e marca como pronta', async () => {
        const list: User[] = [{ id: 'usr-1', nome: 'Ana', email: 'ana@fieldcore.com', role: 'ADMIN', status: 'ATIVO', version: 0 }];
        mocked(usersApi.listUsers).mockResolvedValue(list);
        useAppStore.setState({ usersStatus: 'idle' });

        const promise = useAppStore.getState().loadUsers();
        expect(useAppStore.getState().usersStatus).toBe('loading');
        await promise;

        expect(useAppStore.getState().users).toEqual(list);
        expect(useAppStore.getState().usersStatus).toBe('ready');
        expect(useAppStore.getState().usersError).toBeNull();
      });

      it('lista vazia é um resultado válido (estado vazio, não erro)', async () => {
        mocked(usersApi.listUsers).mockResolvedValue([]);

        await useAppStore.getState().loadUsers();

        expect(useAppStore.getState().users).toEqual([]);
        expect(useAppStore.getState().usersStatus).toBe('ready');
      });

      it('falha da API vira estado de erro com a mensagem, sem trocar a lista', async () => {
        const before = useAppStore.getState().users;
        useAppStore.setState({ usersStatus: 'idle' });
        mocked(usersApi.listUsers).mockRejectedValue(new ApiError('Você não tem permissão para realizar esta ação.', 403));

        await useAppStore.getState().loadUsers();

        expect(useAppStore.getState().usersStatus).toBe('error');
        expect(useAppStore.getState().usersError).toBe('Você não tem permissão para realizar esta ação.');
        expect(useAppStore.getState().users).toBe(before);
      });

      it('erro de rede vira estado de erro', async () => {
        useAppStore.setState({ usersStatus: 'idle' });
        mocked(usersApi.listUsers).mockRejectedValue(new NetworkError('Sem conexão.'));

        await useAppStore.getState().loadUsers();

        expect(useAppStore.getState().usersStatus).toBe('error');
        expect(useAppStore.getState().usersError).toBe('Sem conexão.');
      });
    });

    it('approveAccessRequest cria o usuário via API e aprova a solicitação', async () => {
      const request = useAppStore.getState().accessRequests.find((r) => r.status === 'PENDENTE');
      if (!request) throw new Error('Fixture sem solicitação pendente para o teste.');
      const created: User = { id: 'usr-8', nome: request.nome, email: request.email, role: request.role, status: 'ATIVO' };
      mocked(usersApi.createUser).mockResolvedValue(created);

      const result = await useAppStore.getState().approveAccessRequest(request.id, 'senha1234');

      expect(result).toEqual({ ok: true });
      expect(useAppStore.getState().accessRequests.find((r) => r.id === request.id)?.status).toBe('APROVADA');
      expect(useAppStore.getState().users).toContainEqual(created);
    });
  });
});
