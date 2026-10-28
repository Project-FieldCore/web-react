import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from './app-store';
import { ApiError, NetworkError } from '@/lib/http';
import type { Client, Location, User } from '@/types';

vi.mock('@/lib/clients-api', () => ({
  listClients: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  setClientActive: vi.fn(),
}));
vi.mock('@/lib/locations-api', () => ({
  listLocations: vi.fn(),
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

const EXISTING_CLIENT_ID = 'cli-1';

describe('useAppStore cadastros (clientes/locais/usuários) — #133', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('clients', () => {
    // Os testes de carga/edição trocam a lista de clientes — restaura para os demais.
    const initialClients = useAppStore.getState().clients;
    afterEach(() => {
      useAppStore.setState({ clients: initialClients, clientsStatus: 'idle', clientsError: null });
    });

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

    it('createClient propaga CNPJ duplicado (409) da API', async () => {
      mocked(clientsApi.createClient).mockRejectedValue(
        new ApiError('Já existe um cliente com esse CNPJ.', 409, undefined, 'DOCUMENT_ALREADY_EXISTS')
      );

      const result = await useAppStore.getState().createClient('Cliente X', '12.345.678/0001-90');

      expect(result).toEqual({ ok: false, error: 'Já existe um cliente com esse CNPJ.' });
    });

    describe('com clientes carregados da API (com version)', () => {
      const loaded: Client = { id: 'cli-1', nome: 'Acme', cnpj: '11.111.111/0001-11', ativo: true, version: 3 };

      beforeEach(() => {
        useAppStore.setState({ clients: [loaded], clientsStatus: 'ready', clientsError: null });
      });

      it('setClientActive envia o version e guarda o cliente retornado (com o version novo)', async () => {
        const updated: Client = { ...loaded, ativo: false, version: 4 };
        mocked(clientsApi.setClientActive).mockResolvedValue(updated);

        const result = await useAppStore.getState().setClientActive('cli-1', false);

        expect(result).toEqual({ ok: true });
        expect(clientsApi.setClientActive).toHaveBeenCalledWith('cli-1', false, 3);
        expect(useAppStore.getState().clients).toEqual([updated]);
      });

      it('setClientActive repassa o erro da API sem alterar o estado local', async () => {
        mocked(clientsApi.setClientActive).mockRejectedValue(new ApiError('Não autorizado.', 403));

        const result = await useAppStore.getState().setClientActive('cli-1', false);

        expect(result).toEqual({ ok: false, error: 'Não autorizado.' });
        expect(useAppStore.getState().clients).toEqual([loaded]);
      });

      it('updateClient envia o version e só os campos alterados, e atualiza a lista', async () => {
        const updated: Client = { ...loaded, nome: 'Acme Ltda', version: 4 };
        mocked(clientsApi.updateClient).mockResolvedValue(updated);

        const result = await useAppStore.getState().updateClient('cli-1', { nome: 'Acme Ltda' });

        expect(result).toEqual({ ok: true });
        expect(clientsApi.updateClient).toHaveBeenCalledWith('cli-1', { nome: 'Acme Ltda', cnpj: undefined }, 3);
        expect(useAppStore.getState().clients).toEqual([updated]);
      });

      it('updateClient não chama a API com nome vazio', async () => {
        const result = await useAppStore.getState().updateClient('cli-1', { nome: '  ' });

        expect(result).toEqual({ ok: false, error: 'Informe o nome do cliente.' });
        expect(clientsApi.updateClient).not.toHaveBeenCalled();
      });

      it('VERSION_CONFLICT recarrega a lista (sem piscar loading) e devolve a mensagem', async () => {
        const fresh: Client = { ...loaded, nome: 'Acme (outra pessoa editou)', version: 5 };
        mocked(clientsApi.updateClient).mockRejectedValue(
          new ApiError('Este registro foi alterado por outra pessoa.', 409, undefined, 'VERSION_CONFLICT')
        );
        mocked(clientsApi.listClients).mockResolvedValue([fresh]);
        const statuses: string[] = [];
        const unsubscribe = useAppStore.subscribe((st) => statuses.push(st.clientsStatus));

        const result = await useAppStore.getState().updateClient('cli-1', { nome: 'Acme Ltda' });
        unsubscribe();

        expect(result).toEqual({ ok: false, error: 'Este registro foi alterado por outra pessoa.' });
        expect(useAppStore.getState().clients).toEqual([fresh]);
        expect(statuses).not.toContain('loading');
      });

      it('sem version conhecido, não chama a API e pede para recarregar', async () => {
        useAppStore.setState({ clients: [{ ...loaded, version: undefined }] });

        const result = await useAppStore.getState().setClientActive('cli-1', false);

        expect(result).toEqual({ ok: false, error: 'Recarregue a lista de clientes e tente de novo.' });
        expect(clientsApi.setClientActive).not.toHaveBeenCalled();
      });
    });

    describe('loadClients', () => {
      it('carrega a lista da API e marca como pronta', async () => {
        const list: Client[] = [{ id: 'cli-1', nome: 'Acme', ativo: true, version: 0 }];
        mocked(clientsApi.listClients).mockResolvedValue(list);
        useAppStore.setState({ clientsStatus: 'idle' });

        const promise = useAppStore.getState().loadClients();
        expect(useAppStore.getState().clientsStatus).toBe('loading');
        await promise;

        expect(useAppStore.getState().clients).toEqual(list);
        expect(useAppStore.getState().clientsStatus).toBe('ready');
        expect(useAppStore.getState().clientsError).toBeNull();
      });

      it('lista vazia é um resultado válido (estado vazio, não erro)', async () => {
        mocked(clientsApi.listClients).mockResolvedValue([]);

        await useAppStore.getState().loadClients();

        expect(useAppStore.getState().clients).toEqual([]);
        expect(useAppStore.getState().clientsStatus).toBe('ready');
      });

      it('falha da API vira estado de erro com a mensagem, sem trocar a lista', async () => {
        const before = useAppStore.getState().clients;
        useAppStore.setState({ clientsStatus: 'idle' });
        mocked(clientsApi.listClients).mockRejectedValue(new ApiError('Você não tem permissão para realizar esta ação.', 403));

        await useAppStore.getState().loadClients();

        expect(useAppStore.getState().clientsStatus).toBe('error');
        expect(useAppStore.getState().clientsError).toBe('Você não tem permissão para realizar esta ação.');
        expect(useAppStore.getState().clients).toBe(before);
      });

      it('erro de rede vira estado de erro', async () => {
        useAppStore.setState({ clientsStatus: 'idle' });
        mocked(clientsApi.listClients).mockRejectedValue(new NetworkError('Sem conexão.'));

        await useAppStore.getState().loadClients();

        expect(useAppStore.getState().clientsStatus).toBe('error');
        expect(useAppStore.getState().clientsError).toBe('Sem conexão.');
      });
    });
  });

  describe('locations', () => {
    // Os testes de carga/edição trocam a lista de locais — restaura para os demais.
    const initialLocations = useAppStore.getState().locations;
    afterEach(() => {
      useAppStore.setState({ locations: initialLocations, locationsStatus: 'idle', locationsError: null });
    });

    it('createLocation não chama a API quando o cliente não existe (RN-009)', async () => {
      const result = await useAppStore.getState().createLocation('cli-inexistente', 'Depósito');

      expect(result).toEqual({ ok: false, error: 'Cliente não encontrado (RN-009).' });
      expect(locationsApi.createLocation).not.toHaveBeenCalled();
    });

    it('createLocation não chama a API com nome vazio', async () => {
      const result = await useAppStore.getState().createLocation(EXISTING_CLIENT_ID, '  ');

      expect(result).toEqual({ ok: false, error: 'Informe o nome do local.' });
      expect(locationsApi.createLocation).not.toHaveBeenCalled();
    });

    it('createLocation chama a API (sob o cliente) e guarda a entidade retornada', async () => {
      const location: Location = { id: 'loc-9', clienteId: EXISTING_CLIENT_ID, nome: 'Depósito', ativo: true, version: 0 };
      mocked(locationsApi.createLocation).mockResolvedValue(location);

      const result = await useAppStore.getState().createLocation(EXISTING_CLIENT_ID, 'Depósito', 'Rua A, 10');

      expect(result).toEqual({ ok: true, id: 'loc-9' });
      expect(locationsApi.createLocation).toHaveBeenCalledWith(EXISTING_CLIENT_ID, 'Depósito', 'Rua A, 10');
      expect(useAppStore.getState().locations).toContainEqual(location);
    });

    it('createLocation propaga nome duplicado no cliente (409) da API', async () => {
      mocked(locationsApi.createLocation).mockRejectedValue(
        new ApiError('Já existe um local com esse nome para este cliente.', 409, undefined, 'SITE_NAME_ALREADY_EXISTS')
      );

      const result = await useAppStore.getState().createLocation(EXISTING_CLIENT_ID, 'Depósito');

      expect(result).toEqual({ ok: false, error: 'Já existe um local com esse nome para este cliente.' });
    });

    describe('com locais carregados da API (com version)', () => {
      const loaded: Location = { id: 'loc-1', clienteId: 'cli-1', nome: 'Matriz', endereco: 'Rua A', ativo: true, version: 3 };

      beforeEach(() => {
        useAppStore.setState({ locations: [loaded], locationsStatus: 'ready', locationsError: null });
      });

      it('updateLocation envia o version e atualiza a lista', async () => {
        const updated: Location = { ...loaded, nome: 'Matriz SP', version: 4 };
        mocked(locationsApi.updateLocation).mockResolvedValue(updated);

        const result = await useAppStore.getState().updateLocation('loc-1', { nome: 'Matriz SP' });

        expect(result).toEqual({ ok: true });
        expect(locationsApi.updateLocation).toHaveBeenCalledWith('loc-1', { nome: 'Matriz SP', endereco: undefined }, 3);
        expect(useAppStore.getState().locations).toEqual([updated]);
      });

      it('updateLocation não chama a API com nome vazio', async () => {
        const result = await useAppStore.getState().updateLocation('loc-1', { nome: ' ' });

        expect(result).toEqual({ ok: false, error: 'Informe o nome do local.' });
        expect(locationsApi.updateLocation).not.toHaveBeenCalled();
      });

      it('updateLocation propaga erro de rede e não altera a lista', async () => {
        mocked(locationsApi.updateLocation).mockRejectedValue(new NetworkError('Sem conexão.'));

        const result = await useAppStore.getState().updateLocation('loc-1', { nome: 'Novo nome' });

        expect(result).toEqual({ ok: false, error: 'Sem conexão.' });
        expect(useAppStore.getState().locations).toEqual([loaded]);
      });

      it('setLocationActive envia o version e guarda o local retornado (com o version novo)', async () => {
        const updated: Location = { ...loaded, ativo: false, version: 4 };
        mocked(locationsApi.setLocationActive).mockResolvedValue(updated);

        const result = await useAppStore.getState().setLocationActive('loc-1', false);

        expect(result).toEqual({ ok: true });
        expect(locationsApi.setLocationActive).toHaveBeenCalledWith('loc-1', false, 3);
        expect(useAppStore.getState().locations).toEqual([updated]);
      });

      it('VERSION_CONFLICT recarrega a lista (sem piscar loading) e devolve a mensagem', async () => {
        const fresh: Location = { ...loaded, nome: 'Matriz (outra pessoa editou)', version: 5 };
        mocked(locationsApi.setLocationActive).mockRejectedValue(
          new ApiError('Este registro foi alterado por outra pessoa.', 409, undefined, 'VERSION_CONFLICT')
        );
        mocked(locationsApi.listLocations).mockResolvedValue([fresh]);
        const statuses: string[] = [];
        const unsubscribe = useAppStore.subscribe((st) => statuses.push(st.locationsStatus));

        const result = await useAppStore.getState().setLocationActive('loc-1', false);
        unsubscribe();

        expect(result).toEqual({ ok: false, error: 'Este registro foi alterado por outra pessoa.' });
        expect(useAppStore.getState().locations).toEqual([fresh]);
        expect(statuses).not.toContain('loading');
      });

      it('sem version conhecido, não chama a API e pede para recarregar', async () => {
        useAppStore.setState({ locations: [{ ...loaded, version: undefined }] });

        const result = await useAppStore.getState().setLocationActive('loc-1', false);

        expect(result).toEqual({ ok: false, error: 'Recarregue a lista de locais e tente de novo.' });
        expect(locationsApi.setLocationActive).not.toHaveBeenCalled();
      });
    });

    describe('loadLocations', () => {
      it('carrega a lista da API e marca como pronta', async () => {
        const list: Location[] = [{ id: 'loc-1', clienteId: 'cli-1', nome: 'Matriz', ativo: true, version: 0 }];
        mocked(locationsApi.listLocations).mockResolvedValue(list);
        useAppStore.setState({ locationsStatus: 'idle' });

        const promise = useAppStore.getState().loadLocations();
        expect(useAppStore.getState().locationsStatus).toBe('loading');
        await promise;

        expect(useAppStore.getState().locations).toEqual(list);
        expect(useAppStore.getState().locationsStatus).toBe('ready');
        expect(useAppStore.getState().locationsError).toBeNull();
      });

      it('lista vazia é um resultado válido (estado vazio, não erro)', async () => {
        mocked(locationsApi.listLocations).mockResolvedValue([]);

        await useAppStore.getState().loadLocations();

        expect(useAppStore.getState().locations).toEqual([]);
        expect(useAppStore.getState().locationsStatus).toBe('ready');
      });

      it('falha da API vira estado de erro com a mensagem, sem trocar a lista', async () => {
        const before = useAppStore.getState().locations;
        useAppStore.setState({ locationsStatus: 'idle' });
        mocked(locationsApi.listLocations).mockRejectedValue(new ApiError('Você não tem permissão para realizar esta ação.', 403));

        await useAppStore.getState().loadLocations();

        expect(useAppStore.getState().locationsStatus).toBe('error');
        expect(useAppStore.getState().locationsError).toBe('Você não tem permissão para realizar esta ação.');
        expect(useAppStore.getState().locations).toBe(before);
      });

      it('erro de rede vira estado de erro', async () => {
        useAppStore.setState({ locationsStatus: 'idle' });
        mocked(locationsApi.listLocations).mockRejectedValue(new NetworkError('Sem conexão.'));

        await useAppStore.getState().loadLocations();

        expect(useAppStore.getState().locationsStatus).toBe('error');
        expect(useAppStore.getState().locationsError).toBe('Sem conexão.');
      });
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
