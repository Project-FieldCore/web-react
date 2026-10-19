'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  AccessRequest,
  Answer,
  AuditEvent,
  Client,
  CorrectionFeedback,
  Criticidade,
  Equipment,
  Geolocalizacao,
  Inspection,
  InspectionModel,
  Location,
  ModelItem,
  ModelSection,
  NonConformityStatus,
  Priority,
  SyncQueueItem,
  User,
  UserRole,
  UserStatus,
} from '@/types';
import { isAnswerFilled } from '@/types';
import {
  MOCK_ACCESS_REQUESTS,
  MOCK_CLIENTS,
  MOCK_CREDENTIALS,
  MOCK_EQUIPMENT,
  MOCK_AUDIT_EVENTS,
  MOCK_INSPECTIONS,
  MOCK_LOCATIONS,
  MOCK_MODELS,
  MOCK_USERS,
} from '@/data/mock-data';
import { login as apiLogin } from '@/lib/auth-api';
import * as clientsApi from '@/lib/clients-api';
import * as locationsApi from '@/lib/locations-api';
import * as usersApi from '@/lib/users-api';
import { ApiError, NetworkError } from '@/lib/http';
import { onUnauthorized, setAuthToken } from '@/lib/auth-token';

/** Erro de API/rede vira mensagem amigável — mesmo contrato usado pelo login (ver #131/#132). */
function toErrorResult(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof ApiError) return { ok: false, error: error.message };
  if (error instanceof NetworkError) return { ok: false, error: error.message };
  return { ok: false, error: fallback };
}

type Result = { ok: true } | { ok: false; error: string };
type ResultWithId = { ok: true; id: string } | { ok: false; error: string };

interface AppState {
  // --- sessão (UC-01) ---
  currentUser: User | null;
  login: (email: string, senha: string) => Promise<Result>;
  logout: () => void;
  /** RN-007: nunca revela se o e-mail existe — sempre retorna ok. Só troca a senha de fato quando encontra uma conta ativa. */
  resetPassword: (email: string, novaSenha: string) => Result;

  clients: Client[];
  locations: Location[];
  equipment: Equipment[];
  users: User[];
  models: InspectionModel[];
  inspections: Inspection[];
  auditEvents: AuditEvent[];
  accessRequests: AccessRequest[];
  syncQueue: SyncQueueItem[];
  lastSyncAt: string | null;
  syncing: boolean;

  // --- solicitação de acesso (tela "Solicitar acesso" + aprovação em /users) ---
  requestAccess: (
    nome: string,
    email: string,
    role: Extract<UserRole, 'ADMIN' | 'SUPERVISOR'>,
    justificativa?: string
  ) => ResultWithId;
  approveAccessRequest: (requestId: string, senha: string) => Promise<Result>;
  rejectAccessRequest: (requestId: string) => void;

  // --- cadastros: clientes/locais (05 - Perfis, RN-009/013) — integrados à API (#133) ---
  createClient: (nome: string, cnpj?: string) => Promise<ResultWithId>;
  updateClient: (id: string, patch: Partial<Pick<Client, 'nome' | 'cnpj'>>) => Promise<Result>;
  setClientActive: (id: string, ativo: boolean) => Promise<Result>;

  createLocation: (clienteId: string, nome: string, endereco?: string) => Promise<ResultWithId>;
  updateLocation: (id: string, patch: Partial<Pick<Location, 'nome' | 'endereco'>>) => Promise<Result>;
  setLocationActive: (id: string, ativo: boolean) => Promise<Result>;

  // --- cadastro de equipamentos (RN-010/011/013) — ainda mock: o backend não
  // expõe nenhuma rota de equipamento, nem placeholder (ver #133). ---
  createEquipment: (localId: string, nome: string, qrCode: string, tipo?: string) => ResultWithId;
  updateEquipment: (id: string, patch: Partial<Pick<Equipment, 'nome' | 'qrCode' | 'tipo'>>) => Result;
  setEquipmentActive: (id: string, ativo: boolean) => void;

  // --- cadastro de usuários (RN-001/002/003/007) — integrado à API (#133) ---
  createUser: (nome: string, email: string, role: UserRole, senha: string) => Promise<ResultWithId>;
  updateUser: (id: string, patch: Partial<Pick<User, 'nome' | 'email' | 'role'>>) => Promise<Result>;
  setUserStatus: (id: string, status: UserStatus) => Promise<Result>;

  // --- modelos (UC-04, UC-05) ---
  createDraftModel: () => string;
  updateModelMeta: (modelId: string, patch: Partial<Pick<InspectionModel, 'title' | 'description' | 'category'>>) => void;
  addSection: (modelId: string) => void;
  removeSection: (modelId: string, sectionId: string) => void;
  updateSectionTitle: (modelId: string, sectionId: string, title: string) => void;
  addItem: (modelId: string, sectionId: string) => void;
  removeItem: (modelId: string, sectionId: string, itemId: string) => void;
  updateItem: (modelId: string, sectionId: string, itemId: string, patch: Partial<ModelItem>) => void;
  publishModel: (modelId: string) => Result;

  // --- agendamento (UC-06) ---
  scheduleInspection: (input: {
    modeloId: string;
    clienteId: string;
    localId: string;
    equipamentoId?: string;
    tecnicoId: string;
    prioridade: Priority;
    dataPrevista: string;
    orientacoes?: string;
  }) => ResultWithId;

  // --- revisão (UC-16, UC-17) ---
  startReview: (inspectionId: string) => void;
  approveInspection: (inspectionId: string, supervisorNome: string, comentario?: string) => void;
  rejectInspection: (inspectionId: string, supervisorNome: string, motivo: string) => Result;
  returnForCorrection: (inspectionId: string, supervisorNome: string, comentario: string) => Result;

  // --- não conformidades ---
  resolveNonConformity: (inspectionId: string, itemId: string, status: NonConformityStatus) => void;

  // --- responder checklist (UC-11, UC-12) ---
  saveAnswer: (inspectionId: string, itemId: string, patch: Partial<Answer>) => void;
  saveNonConformity: (
    inspectionId: string,
    itemId: string,
    patch: Partial<{ titulo: string; descricao: string; criticidade: Criticidade; evidenceCount: number; photos: string[] }>
  ) => void;
  submitInspection: (inspectionId: string) => Result;
  saveGeolocation: (inspectionId: string, geo: { lat: number; lng: number }) => void;
  confirmEquipmentQr: (inspectionId: string, qrCode: string) => Result;

  // --- sincronização offline ---
  syncNow: () => Promise<void>;
}

function newId(prefix: string) {
  return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Next.js renderiza componentes 'use client' no servidor (Node) antes de
// hidratar no navegador — nesse contexto `sessionStorage` não existe.
// Sem esse guard, o middleware de persistência nem anexa `store.persist`
// durante o SSR, e o Shell (que consulta `useAppStore.persist.hasHydrated()`)
// quebra a cada requisição. Um storage no-op no servidor mantém a API
// consistente; no navegador, o `sessionStorage` real assume normalmente.
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
const sessionOrNoopStorage = () => (typeof window !== 'undefined' ? window.sessionStorage : noopStorage);

// A sessão (currentUser) é persistida na sessionStorage do navegador só para
// sobreviver a um refresh/link direto durante a demonstração — não é o
// mecanismo de sessão real (isso é responsabilidade da API/JWT + Secure
// Store no mobile, RNF de arquitetura). Todo o resto do estado é mock em
// memória, recriado a cada carregamento.
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
  // RN-086: alterações críticas registram usuário, data, ação e entidade.
  function pushAudit(action: string, entity: string, entityId?: string, details?: string) {
    const event: AuditEvent = {
      id: newId('aud'),
      timestamp: new Date().toISOString(),
      userNome: get().currentUser?.nome ?? 'Sistema',
      action,
      entity,
      entityId,
      details,
    };
    set((s) => ({ auditEvents: [event, ...s.auditEvents] }));
  }

  // Compartilhada por createUser e approveAccessRequest — evita duplicar as
  // validações de cadastro central de usuários (03 - Problema: duplicidade).
  // Integrado à API (#133) — ver src/lib/users-api.ts para o contrato assumido.
  async function createUserInternal(nome: string, email: string, role: UserRole, senha: string): Promise<ResultWithId> {
    if (!nome.trim()) return { ok: false, error: 'Informe o nome do usuário.' };
    const normalized = email.trim().toLowerCase();
    if (!isValidEmail(normalized)) return { ok: false, error: 'Informe um e-mail válido.' };
    // Confere localmente contra o cadastro já carregado — só evita um
    // round-trip óbvio; quem decide de fato é a API.
    const duplicate = get().users.some((u) => u.email.toLowerCase() === normalized);
    if (duplicate) return { ok: false, error: 'Já existe um usuário com esse e-mail.' };
    if (!senha.trim()) return { ok: false, error: 'Defina uma senha inicial.' };

    let user: User;
    try {
      user = await usersApi.createUser(nome.trim(), normalized, role, senha);
    } catch (error) {
      return toErrorResult(error, 'Não foi possível criar o usuário. Tente novamente.');
    }

    set((s) => ({ users: [...s.users, user] }));
    return { ok: true, id: user.id };
  }

  return {
    currentUser: null,
    clients: MOCK_CLIENTS,
    locations: MOCK_LOCATIONS,
    equipment: MOCK_EQUIPMENT,
    users: MOCK_USERS,
    models: MOCK_MODELS,
    inspections: MOCK_INSPECTIONS,
    auditEvents: MOCK_AUDIT_EVENTS,
    accessRequests: MOCK_ACCESS_REQUESTS,
    syncQueue: [],
    lastSyncAt: null,
    syncing: false,

    // RN-001: só usuários ativos autenticam. Resposta genérica para
    // credenciais inválidas — não revela qual campo está incorreto (UC-01).
    // RN-003: quem decide autorização de fato é a API — os checks de
    // status/perfil aqui só evitam abrir o painel para quem a API já
    // autenticou mas não deveria estar nele (ex.: TECHNICIAN).
    login: async (email, senha) => {
      const normalized = email.trim().toLowerCase();
      if (!isValidEmail(normalized)) return { ok: false, error: 'Informe um e-mail válido.' };
      if (!senha.trim()) return { ok: false, error: 'Informe sua senha.' };

      let token: string;
      let user: User;
      try {
        const response = await apiLogin(normalized, senha);
        token = response.token;
        user = response.user;
      } catch (error) {
        if (error instanceof ApiError) {
          return { ok: false, error: error.status === 401 ? 'E-mail ou senha inválidos.' : error.message };
        }
        if (error instanceof NetworkError) return { ok: false, error: error.message };
        return { ok: false, error: 'Não foi possível entrar. Tente novamente.' };
      }

      if (user.status !== 'ATIVO') {
        return { ok: false, error: 'Este usuário está inativo ou bloqueado. Procure um administrador.' };
      }
      if (user.role !== 'ADMIN' && user.role !== 'SUPERVISOR') {
        return { ok: false, error: 'Este perfil não tem acesso à interface administrativa web.' };
      }
      setAuthToken(token);
      set({ currentUser: user });
      pushAudit('ACESSOU', 'Sessão', user.id, 'Login no painel administrativo');
      return { ok: true };
    },

    logout: () => {
      const user = get().currentUser;
      if (user) pushAudit('SAIU', 'Sessão', user.id, 'Logout do painel administrativo');
      setAuthToken(null);
      set({ currentUser: null });
    },

    // RN-007: a resposta nunca revela se o e-mail existe (evita enumeração de contas) —
    // por isso sempre retorna ok, e só troca a senha de fato quando há uma conta
    // ADMIN/SUPERVISOR ativa com esse e-mail.
    resetPassword: (email, novaSenha) => {
      if (novaSenha.trim().length < 6) {
        return { ok: false, error: 'A nova senha deve ter ao menos 6 caracteres.' };
      }
      const normalized = email.trim().toLowerCase();
      const user = get().users.find(
        (u) => u.email.toLowerCase() === normalized && (u.role === 'ADMIN' || u.role === 'SUPERVISOR')
      );
      if (user && user.status === 'ATIVO') {
        MOCK_CREDENTIALS[normalized] = novaSenha;
        pushAudit('REDEFINIU_SENHA', 'Usuário', user.id, 'Recuperação de senha');
      }
      return { ok: true };
    },

    // RN-009: todo local pertence a um cliente. RN-013: inativação, nunca exclusão física.
    // Integrado à API (#133) — ver src/lib/clients-api.ts para o contrato assumido.
    createClient: async (nome, cnpj) => {
      if (!nome.trim()) return { ok: false, error: 'Informe o nome do cliente.' };
      let client: Client;
      try {
        client = await clientsApi.createClient(nome.trim(), cnpj?.trim() || undefined);
      } catch (error) {
        return toErrorResult(error, 'Não foi possível criar o cliente. Tente novamente.');
      }
      set((s) => ({ clients: [...s.clients, client] }));
      pushAudit('CRIOU', 'Cliente', client.id, nome.trim());
      return { ok: true, id: client.id };
    },
    updateClient: async (id, patch) => {
      if (patch.nome !== undefined && !patch.nome.trim()) return { ok: false, error: 'Informe o nome do cliente.' };
      let client: Client;
      try {
        client = await clientsApi.updateClient(id, patch);
      } catch (error) {
        return toErrorResult(error, 'Não foi possível salvar as alterações. Tente novamente.');
      }
      set((s) => ({ clients: s.clients.map((c) => (c.id === id ? client : c)) }));
      pushAudit('ATUALIZOU', 'Cliente', id);
      return { ok: true };
    },
    setClientActive: async (id, ativo) => {
      let client: Client;
      try {
        client = await clientsApi.setClientActive(id, ativo);
      } catch (error) {
        return toErrorResult(error, 'Não foi possível alterar o status do cliente. Tente novamente.');
      }
      set((s) => ({ clients: s.clients.map((c) => (c.id === id ? client : c)) }));
      pushAudit(ativo ? 'ATIVOU' : 'INATIVOU', 'Cliente', id);
      return { ok: true };
    },

    // Integrado à API (#133) — ver src/lib/locations-api.ts (nome assumido
    // como "site" no backend; ajustar se divergir do contrato real).
    createLocation: async (clienteId, nome, endereco) => {
      const client = get().clients.find((c) => c.id === clienteId);
      if (!client) return { ok: false, error: 'Cliente não encontrado (RN-009).' };
      if (!nome.trim()) return { ok: false, error: 'Informe o nome do local.' };
      let location: Location;
      try {
        location = await locationsApi.createLocation(clienteId, nome.trim(), endereco?.trim() || undefined);
      } catch (error) {
        return toErrorResult(error, 'Não foi possível criar o local. Tente novamente.');
      }
      set((s) => ({ locations: [...s.locations, location] }));
      pushAudit('CRIOU', 'Local', location.id, `${nome.trim()} · ${client.nome}`);
      return { ok: true, id: location.id };
    },
    updateLocation: async (id, patch) => {
      if (patch.nome !== undefined && !patch.nome.trim()) return { ok: false, error: 'Informe o nome do local.' };
      let location: Location;
      try {
        location = await locationsApi.updateLocation(id, patch);
      } catch (error) {
        return toErrorResult(error, 'Não foi possível salvar as alterações. Tente novamente.');
      }
      set((s) => ({ locations: s.locations.map((l) => (l.id === id ? location : l)) }));
      pushAudit('ATUALIZOU', 'Local', id);
      return { ok: true };
    },
    setLocationActive: async (id, ativo) => {
      let location: Location;
      try {
        location = await locationsApi.setLocationActive(id, ativo);
      } catch (error) {
        return toErrorResult(error, 'Não foi possível alterar o status do local. Tente novamente.');
      }
      set((s) => ({ locations: s.locations.map((l) => (l.id === id ? location : l)) }));
      pushAudit(ativo ? 'ATIVOU' : 'INATIVOU', 'Local', id);
      return { ok: true };
    },

    // RN-010: todo equipamento pertence a um local no MVP. RN-011: QR Code único.
    createEquipment: (localId, nome, qrCode, tipo) => {
      const location = get().locations.find((l) => l.id === localId);
      if (!location) return { ok: false, error: 'Local não encontrado (RN-010).' };
      if (!nome.trim()) return { ok: false, error: 'Informe o nome do equipamento.' };
      const qr = qrCode.trim();
      if (!qr) return { ok: false, error: 'Informe o código QR do equipamento.' };
      const duplicate = get().equipment.some((e) => e.qrCode.toLowerCase() === qr.toLowerCase());
      if (duplicate) return { ok: false, error: 'Já existe um equipamento com esse código QR (RN-011).' };
      const id = newId('eq');
      set((s) => ({ equipment: [...s.equipment, { id, localId, nome: nome.trim(), tipo: tipo?.trim() || undefined, qrCode: qr, ativo: true }] }));
      pushAudit('CRIOU', 'Equipamento', id, `${nome.trim()} · QR ${qr}`);
      return { ok: true, id };
    },
    updateEquipment: (id, patch) => {
      if (patch.nome !== undefined && !patch.nome.trim()) return { ok: false, error: 'Informe o nome do equipamento.' };
      if (patch.qrCode !== undefined) {
        const qr = patch.qrCode.trim();
        if (!qr) return { ok: false, error: 'Informe o código QR do equipamento.' };
        const duplicate = get().equipment.some((e) => e.id !== id && e.qrCode.toLowerCase() === qr.toLowerCase());
        if (duplicate) return { ok: false, error: 'Já existe um equipamento com esse código QR (RN-011).' };
        patch = { ...patch, qrCode: qr };
      }
      set((s) => ({ equipment: s.equipment.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
      pushAudit('ATUALIZOU', 'Equipamento', id);
      return { ok: true };
    },
    setEquipmentActive: (id, ativo) => {
      set((s) => ({ equipment: s.equipment.map((e) => (e.id === id ? { ...e, ativo } : e)) }));
      pushAudit(ativo ? 'ATIVOU' : 'INATIVOU', 'Equipamento', id);
    },

    // Cadastro central de usuários — evita a duplicidade de registros que hoje frustra a Ana (03 - Problema).
    createUser: async (nome, email, role, senha) => {
      const result = await createUserInternal(nome, email, role, senha);
      if (result.ok) pushAudit('CRIOU', 'Usuário', result.id, `${nome.trim()} · ${role}`);
      return result;
    },
    updateUser: async (id, patch) => {
      if (patch.nome !== undefined && !patch.nome.trim()) return { ok: false, error: 'Informe o nome do usuário.' };
      if (patch.email !== undefined) {
        const normalized = patch.email.trim().toLowerCase();
        if (!isValidEmail(normalized)) return { ok: false, error: 'Informe um e-mail válido.' };
        const duplicate = get().users.some((u) => u.id !== id && u.email.toLowerCase() === normalized);
        if (duplicate) return { ok: false, error: 'Já existe um usuário com esse e-mail.' };
        patch = { ...patch, email: normalized };
      }
      let user: User;
      try {
        user = await usersApi.updateUser(id, patch);
      } catch (error) {
        return toErrorResult(error, 'Não foi possível salvar as alterações. Tente novamente.');
      }
      set((s) => ({ users: s.users.map((u) => (u.id === id ? user : u)) }));
      pushAudit('ATUALIZOU', 'Usuário', id);
      return { ok: true };
    },
    // RN-002: inativação não exclui histórico — por isso não existe "excluir usuário".
    setUserStatus: async (id, status) => {
      let user: User;
      try {
        user = await usersApi.setUserStatus(id, status);
      } catch (error) {
        return toErrorResult(error, 'Não foi possível alterar o status. Tente novamente.');
      }
      set((s) => ({ users: s.users.map((u) => (u.id === id ? user : u)) }));
      pushAudit('ALTEROU_STATUS', 'Usuário', id, status);
      return { ok: true };
    },

    // RN-003: acesso ao painel web não é autoatendido — o pedido fica pendente
    // até um ADMIN aprovar (approveAccessRequest), que só então cria a conta.
    requestAccess: (nome, email, role, justificativa) => {
      if (!nome.trim()) return { ok: false, error: 'Informe seu nome completo.' };
      const normalized = email.trim().toLowerCase();
      if (!isValidEmail(normalized)) return { ok: false, error: 'Informe um e-mail válido.' };
      const jaEUsuario = get().users.some((u) => u.email.toLowerCase() === normalized);
      if (jaEUsuario) return { ok: false, error: 'Já existe uma conta com esse e-mail. Tente entrar ou recuperar a senha.' };
      const jaPendente = get().accessRequests.some((r) => r.email.toLowerCase() === normalized && r.status === 'PENDENTE');
      if (jaPendente) return { ok: false, error: 'Já existe uma solicitação pendente para esse e-mail.' };
      const id = newId('req');
      const request: AccessRequest = {
        id,
        nome: nome.trim(),
        email: normalized,
        role,
        justificativa: justificativa?.trim() || undefined,
        status: 'PENDENTE',
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ accessRequests: [request, ...s.accessRequests] }));
      pushAudit('SOLICITOU_ACESSO', 'Pedido de acesso', id, `${nome.trim()} · ${role}`);
      return { ok: true, id };
    },

    approveAccessRequest: async (requestId, senha) => {
      const request = get().accessRequests.find((r) => r.id === requestId);
      if (!request) return { ok: false, error: 'Solicitação não encontrada.' };
      if (request.status !== 'PENDENTE') return { ok: false, error: 'Esta solicitação já foi decidida.' };
      const result = await createUserInternal(request.nome, request.email, request.role, senha);
      if (!result.ok) return result;
      set((s) => ({
        accessRequests: s.accessRequests.map((r) => (r.id === requestId ? { ...r, status: 'APROVADA' } : r)),
      }));
      pushAudit('APROVOU_ACESSO', 'Pedido de acesso', requestId, `${request.nome} · ${request.role}`);
      return { ok: true };
    },

    rejectAccessRequest: (requestId) => {
      set((s) => ({
        accessRequests: s.accessRequests.map((r) => (r.id === requestId ? { ...r, status: 'REJEITADA' } : r)),
      }));
      pushAudit('REJEITOU_ACESSO', 'Pedido de acesso', requestId);
    },

    createDraftModel: () => {
      const id = newId('mod');
      const draft: InspectionModel = {
        id,
        title: 'Novo modelo de inspeção',
        description: '',
        category: 'Geral',
        status: 'RASCUNHO',
        version: 1,
        updatedAt: new Date().toISOString(),
        sections: [],
      };
      set((s) => ({ models: [draft, ...s.models] }));
      return id;
    },

    updateModelMeta: (modelId, patch) => {
      set((s) => ({
        models: s.models.map((m) => (m.id === modelId ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m)),
      }));
    },

    addSection: (modelId) => {
      const section: ModelSection = { id: newId('sec'), title: 'Nova seção', items: [] };
      set((s) => ({
        models: s.models.map((m) => (m.id === modelId ? { ...m, sections: [...m.sections, section] } : m)),
      }));
    },

    removeSection: (modelId, sectionId) => {
      set((s) => ({
        models: s.models.map((m) =>
          m.id === modelId ? { ...m, sections: m.sections.filter((sec) => sec.id !== sectionId) } : m
        ),
      }));
    },

    updateSectionTitle: (modelId, sectionId, title) => {
      set((s) => ({
        models: s.models.map((m) =>
          m.id === modelId
            ? { ...m, sections: m.sections.map((sec) => (sec.id === sectionId ? { ...sec, title } : sec)) }
            : m
        ),
      }));
    },

    addItem: (modelId, sectionId) => {
      const item: ModelItem = {
        id: newId('item'),
        title: 'Novo item',
        type: 'CONFORMITY',
        required: false,
        needsEvidenceOnNok: false,
      };
      set((s) => ({
        models: s.models.map((m) =>
          m.id === modelId
            ? {
                ...m,
                sections: m.sections.map((sec) => (sec.id === sectionId ? { ...sec, items: [...sec.items, item] } : sec)),
              }
            : m
        ),
      }));
    },

    removeItem: (modelId, sectionId, itemId) => {
      set((s) => ({
        models: s.models.map((m) =>
          m.id === modelId
            ? {
                ...m,
                sections: m.sections.map((sec) =>
                  sec.id === sectionId ? { ...sec, items: sec.items.filter((it) => it.id !== itemId) } : sec
                ),
              }
            : m
        ),
      }));
    },

    updateItem: (modelId, sectionId, itemId, patch) => {
      set((s) => ({
        models: s.models.map((m) =>
          m.id === modelId
            ? {
                ...m,
                sections: m.sections.map((sec) =>
                  sec.id === sectionId
                    ? { ...sec, items: sec.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) }
                    : sec
                ),
              }
            : m
        ),
      }));
    },

    // RN-015/016: precisa de título, categoria e ao menos uma seção com item válido.
    // RN-020: publicar um modelo já publicado gera uma nova versão, preservando a anterior.
    publishModel: (modelId) => {
      const model = get().models.find((m) => m.id === modelId);
      if (!model) return { ok: false, error: 'Modelo não encontrado.' };
      if (!model.title.trim()) return { ok: false, error: 'Informe um título para o modelo.' };
      if (model.sections.length === 0) return { ok: false, error: 'Adicione ao menos uma seção com itens (RN-015).' };
      const hasItem = model.sections.some((sec) => sec.items.length > 0);
      if (!hasItem) return { ok: false, error: 'Adicione ao menos um item válido antes de publicar (RN-015).' };
      const missingType = model.sections.some((sec) => sec.items.some((it) => !it.type));
      if (missingType) return { ok: false, error: 'Todo item precisa de um tipo de resposta (RN-016).' };

      const nextVersion = model.status === 'PUBLICADO' ? model.version + 1 : model.version;
      set((s) => ({
        models: s.models.map((m) =>
          m.id === modelId ? { ...m, status: 'PUBLICADO', version: nextVersion, updatedAt: new Date().toISOString() } : m
        ),
      }));
      pushAudit('PUBLICOU', 'Modelo de inspeção', modelId, `${model.title} · v${nextVersion}`);
      return { ok: true };
    },

    // RN-024/025/027: inspeção precisa de versão publicada, dados básicos e técnico ativo.
    scheduleInspection: (input) => {
      const model = get().models.find((m) => m.id === input.modeloId);
      if (!model || model.status !== 'PUBLICADO') {
        return { ok: false, error: 'Selecione um modelo com versão publicada (RN-024).' };
      }
      const tech = get().users.find((u) => u.id === input.tecnicoId && u.role === 'TECHNICIAN');
      if (!tech || tech.status !== 'ATIVO') {
        return { ok: false, error: 'Somente técnicos ativos podem receber uma nova atribuição (RN-027).' };
      }
      if (!input.clienteId || !input.localId || !input.dataPrevista) {
        return { ok: false, error: 'Cliente, local e data prevista são obrigatórios (RN-025).' };
      }

      const id = newId('INS');
      const inspection: Inspection = {
        id,
        clienteId: input.clienteId,
        localId: input.localId,
        equipamentoId: input.equipamentoId,
        modeloId: input.modeloId,
        modeloVersao: model.version,
        tecnicoId: input.tecnicoId,
        prioridade: input.prioridade,
        dataPrevista: input.dataPrevista,
        orientacoes: input.orientacoes,
        status: 'ATRIBUIDA',
        answers: {},
        nonConformities: {},
      };
      set((s) => ({ inspections: [inspection, ...s.inspections] }));
      pushAudit('AGENDOU', 'Inspeção', id, `${tech.nome} · ${new Date(input.dataPrevista).toLocaleDateString('pt-BR')}`);
      return { ok: true, id };
    },

    startReview: (inspectionId) => {
      set((s) => ({
        inspections: s.inspections.map((i) => (i.id === inspectionId && i.status === 'ENVIADA' ? { ...i, status: 'EM_REVISAO' } : i)),
      }));
      pushAudit('INICIOU_REVISAO', 'Inspeção', inspectionId);
    },

    approveInspection: (inspectionId, supervisorNome, comentario) => {
      set((s) => ({
        inspections: s.inspections.map((i) =>
          i.id === inspectionId
            ? { ...i, status: 'APROVADA', review: { supervisorNome, comentario, decidedAt: new Date().toISOString() } }
            : i
        ),
      }));
      pushAudit('APROVOU', 'Inspeção', inspectionId, comentario);
    },

    // RN-080: reprovação deve possuir motivo obrigatório.
    rejectInspection: (inspectionId, supervisorNome, motivo) => {
      if (!motivo.trim()) return { ok: false, error: 'Informe o motivo da reprovação (RN-080).' };
      set((s) => ({
        inspections: s.inspections.map((i) =>
          i.id === inspectionId
            ? {
                ...i,
                status: 'REPROVADA',
                review: { supervisorNome, motivoReprovacao: motivo, decidedAt: new Date().toISOString() },
              }
            : i
        ),
      }));
      pushAudit('REPROVOU', 'Inspeção', inspectionId, motivo);
      return { ok: true };
    },

    resolveNonConformity: (inspectionId, itemId, status) => {
      set((s) => ({
        inspections: s.inspections.map((i) =>
          i.id === inspectionId && i.nonConformities[itemId]
            ? { ...i, nonConformities: { ...i.nonConformities, [itemId]: { ...i.nonConformities[itemId], status } } }
            : i
        ),
      }));
      pushAudit(status === 'RESOLVIDA' ? 'RESOLVEU' : 'REABRIU', 'Não conformidade', `${inspectionId}/${itemId}`);
    },

    // Devolve a inspeção para o técnico corrigir, com feedback obrigatório do gestor.
    returnForCorrection: (inspectionId, supervisorNome, comentario) => {
      if (!comentario.trim()) return { ok: false, error: 'Descreva o que precisa ser corrigido antes de devolver ao técnico.' };
      const feedback: CorrectionFeedback = { supervisorNome, comentario, createdAt: new Date().toISOString() };
      set((s) => ({
        inspections: s.inspections.map((i) =>
          i.id === inspectionId
            ? { ...i, status: 'DEVOLVIDA', correcoes: [...(i.correcoes ?? []), feedback] }
            : i
        ),
      }));
      pushAudit('DEVOLVEU', 'Inspeção', inspectionId, comentario);
      return { ok: true };
    },

    // RN-039: itens críticos não conformes exigem evidência anexada.
    saveAnswer: (inspectionId, itemId, patch) => {
      set((s) => ({
        inspections: s.inspections.map((i) => {
          if (i.id !== inspectionId) return i;
          const prev: Answer = i.answers[itemId] ?? { itemId, evidenceCount: 0 };
          const answer: Answer = { ...prev, ...patch };
          const status = i.status === 'ATRIBUIDA' || i.status === 'DEVOLVIDA' ? 'EM_ANDAMENTO' : i.status;
          return { ...i, status, answers: { ...i.answers, [itemId]: answer } };
        }),
        syncQueue: [...s.syncQueue, { id: newId('sync'), inspectionId, descricao: 'Resposta do checklist', createdAt: new Date().toISOString() }],
      }));
    },

    saveNonConformity: (inspectionId, itemId, patch) => {
      set((s) => ({
        inspections: s.inspections.map((i) => {
          if (i.id !== inspectionId) return i;
          const prev = i.nonConformities[itemId];
          const nc = {
            id: prev?.id ?? newId('nc'),
            itemId,
            titulo: prev?.titulo ?? '',
            descricao: prev?.descricao ?? '',
            criticidade: prev?.criticidade ?? ('MEDIA' as Criticidade),
            evidenceCount: prev?.evidenceCount ?? 0,
            status: prev?.status ?? ('ABERTA' as NonConformityStatus),
            ...patch,
          };
          return { ...i, nonConformities: { ...i.nonConformities, [itemId]: nc } };
        }),
        syncQueue: [...s.syncQueue, { id: newId('sync'), inspectionId, descricao: 'Não conformidade registrada', createdAt: new Date().toISOString() }],
      }));
    },

    // RN-039/040: todo item obrigatório precisa de resposta; não conformidade crítica exige evidência.
    submitInspection: (inspectionId) => {
      const inspection = get().inspections.find((i) => i.id === inspectionId);
      if (!inspection) return { ok: false, error: 'Inspeção não encontrada.' };
      const model = get().models.find((m) => m.id === inspection.modeloId);
      if (!model) return { ok: false, error: 'Modelo da inspeção não encontrado.' };

      for (const section of model.sections) {
        for (const item of section.items) {
          const answer = inspection.answers[item.id];
          if (item.required && !isAnswerFilled(answer)) {
            return { ok: false, error: `Responda o item obrigatório "${item.title}" antes de enviar.` };
          }
          if (item.needsEvidenceOnNok && answer?.conformity === 'NAO_CONFORME') {
            const nc = inspection.nonConformities[item.id];
            if (!nc || nc.evidenceCount === 0) {
              return { ok: false, error: `O item "${item.title}" é crítico e exige evidência para a não conformidade registrada (RN-039).` };
            }
          }
        }
      }

      set((s) => ({
        inspections: s.inspections.map((i) => (i.id === inspectionId ? { ...i, status: 'ENVIADA' } : i)),
      }));
      pushAudit('ENVIOU', 'Inspeção', inspectionId);
      return { ok: true };
    },

    saveGeolocation: (inspectionId, geo) => {
      const geolocalizacao: Geolocalizacao = { ...geo, capturedAt: new Date().toISOString() };
      set((s) => ({
        inspections: s.inspections.map((i) => (i.id === inspectionId ? { ...i, geolocalizacao } : i)),
        syncQueue: [...s.syncQueue, { id: newId('sync'), inspectionId, descricao: 'Localização capturada', createdAt: new Date().toISOString() }],
      }));
    },

    // RN-041 (implícito): confirmar o equipamento correto via QR Code antes de responder.
    confirmEquipmentQr: (inspectionId, qrCode) => {
      const inspection = get().inspections.find((i) => i.id === inspectionId);
      if (!inspection) return { ok: false, error: 'Inspeção não encontrada.' };
      const equipment = get().equipment.find((e) => e.id === inspection.equipamentoId);
      if (!equipment) return { ok: false, error: 'Esta inspeção não possui um equipamento vinculado.' };
      if (equipment.qrCode !== qrCode) {
        return { ok: false, error: `QR Code não corresponde a "${equipment.nome}". Verifique se está no equipamento correto.` };
      }
      const qrConfirmadoEm = new Date().toISOString();
      set((s) => ({
        inspections: s.inspections.map((i) => (i.id === inspectionId ? { ...i, qrConfirmadoEm } : i)),
        syncQueue: [...s.syncQueue, { id: newId('sync'), inspectionId, descricao: 'Equipamento confirmado via QR Code', createdAt: qrConfirmadoEm }],
      }));
      return { ok: true };
    },

    // Sincronização simulada: em campo, a fila fica pendente até haver conexão.
    syncNow: async () => {
      if (get().syncing || get().syncQueue.length === 0) return;
      set({ syncing: true });
      await new Promise((resolve) => setTimeout(resolve, 900));
      set({ syncing: false, syncQueue: [], lastSyncAt: new Date().toISOString() });
    },
      };
    },
    {
      name: 'fieldcore-session',
      storage: createJSONStorage(sessionOrNoopStorage),
      partialize: (state) => ({ currentUser: state.currentUser }),
    }
  )
);

// Sessão expirada (401 numa requisição autenticada) — desloga e deixa o
// Shell redirecionar ao login, como um refresh normal de página faria.
onUnauthorized(() => {
  useAppStore.getState().logout();
});
