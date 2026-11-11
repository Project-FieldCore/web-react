/**
 * PBI-0065.2 — fluxos críticos WEB (AC-RELEASE 17.19, caminho admin/supervisor).
 *
 * Integra store + APIs mockadas (Vitest). Itens mobile/técnico (5–15, 18) ficam
 * fora deste repo — ver mapa no corpo da PR.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MOCK_INSPECTIONS, MOCK_MODELS, MOCK_USERS } from '@/data/mock-data';
import { CONTRACT_IDS } from '@/data/contract-mocks';
import { setAuthToken, setRefreshToken } from '@/lib/auth-token';
import { isAllowed } from '@/lib/route-access';
import { describeLoadError, FORBIDDEN_MESSAGE, NETWORK_LOAD_MESSAGE } from '@/lib/state-copy';
import { ApiError, NetworkError } from '@/lib/http';
import { useAppStore } from '@/store/app-store';
import type { Client, Equipment, Inspection, Location, User } from '@/types';

vi.mock('@/lib/auth-api', () => ({ login: vi.fn(), logout: vi.fn() }));
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
vi.mock('@/lib/equipment-api', () => ({
  listEquipment: vi.fn(),
  createEquipment: vi.fn(),
  updateEquipment: vi.fn(),
  setEquipmentActive: vi.fn(),
  assignEquipmentQrCode: vi.fn(),
}));
vi.mock('@/lib/inspections-api', () => ({
  scheduleInspection: vi.fn(),
  assignInspection: vi.fn(),
  startReview: vi.fn(),
  approveInspection: vi.fn(),
  rejectInspection: vi.fn(),
  returnForCorrection: vi.fn(),
  setNonConformityStatus: vi.fn(),
  syncResponses: vi.fn(),
  submitInspection: vi.fn(),
  cancelInspection: vi.fn(),
  listInspections: vi.fn(),
  REJECT_MOTIVO_MAX: 2000,
}));

import { login as apiLogin } from '@/lib/auth-api';
import * as clientsApi from '@/lib/clients-api';
import * as locationsApi from '@/lib/locations-api';
import * as equipmentApi from '@/lib/equipment-api';
import * as inspectionsApi from '@/lib/inspections-api';

function mocked<T extends (...args: never[]) => unknown>(fn: T) {
  return fn as unknown as ReturnType<typeof vi.fn>;
}

const SUPERVISOR: User = {
  id: 'sup-1',
  nome: 'Marina Costa',
  email: 'marina@fieldcore.com',
  role: 'SUPERVISOR',
  status: 'ATIVO',
};

const TECH: User = {
  id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  nome: 'Demo Technician',
  email: 'tec.demo@example.com',
  role: 'TECHNICIAN',
  status: 'ATIVO',
};

const SENT_ID = 'INS-4471';

describe('AC-RELEASE WEB critical flows (PBI-0065.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthToken(null);
    setRefreshToken(null);
    useAppStore.setState({
      currentUser: null,
      clients: [],
      locations: [],
      equipment: [],
      inspections: structuredClone(MOCK_INSPECTIONS),
      models: structuredClone(MOCK_MODELS).map((m) =>
        m.id === 'mod-1' ? { ...m, templateVersionId: 'ver-api-1' } : m
      ),
      users: [...structuredClone(MOCK_USERS), TECH],
      syncQueue: [],
    });
  });

  it('§1 login administrativo/supervisor + route guard operacional', async () => {
    mocked(apiLogin).mockResolvedValue({
      token: 'jwt-sup',
      refreshToken: 'ref-sup',
      user: SUPERVISOR,
    });

    await expect(useAppStore.getState().login(SUPERVISOR.email, 'DemoPass123!')).resolves.toEqual({
      ok: true,
    });
    expect(useAppStore.getState().currentUser?.role).toBe('SUPERVISOR');

    for (const path of ['/', '/inspections', '/inspections/review-queue', '/schedule', '/models', '/clients']) {
      expect(isAllowed(path, 'SUPERVISOR')).toBe(true);
    }
    expect(isAllowed('/users', 'SUPERVISOR')).toBe(false);
    expect(isAllowed('/audit', 'SUPERVISOR')).toBe(false);
  });

  it('§2 cadastro encadeado cliente → local → equipamento', async () => {
    const client: Client = {
      id: 'cli-new',
      nome: 'Cliente Fluxo',
      cnpj: '12.345.678/0001-90',
      ativo: true,
      version: 0,
    };
    const location: Location = {
      id: 'loc-new',
      clienteId: client.id,
      nome: 'Planta 1',
      endereco: 'Rua A',
      ativo: true,
      version: 0,
    };
    const equipment: Equipment = {
      id: 'eq-new',
      localId: location.id,
      nome: 'Compressor',
      qrCode: 'QR-FLOW-1',
      ativo: true,
      version: 0,
    };

    mocked(clientsApi.createClient).mockResolvedValue(client);
    mocked(locationsApi.createLocation).mockResolvedValue(location);
    mocked(equipmentApi.createEquipment).mockResolvedValue(equipment);

    await expect(useAppStore.getState().createClient(client.nome, client.cnpj)).resolves.toEqual({
      ok: true,
      id: client.id,
    });
    await expect(
      useAppStore.getState().createLocation(client.id, location.nome, location.endereco)
    ).resolves.toEqual({ ok: true, id: location.id });
    await expect(
      useAppStore.getState().createEquipment(location.id, equipment.nome, equipment.qrCode)
    ).resolves.toEqual({ ok: true, id: equipment.id });

    expect(useAppStore.getState().clients.some((c) => c.id === client.id)).toBe(true);
    expect(useAppStore.getState().locations.some((l) => l.id === location.id && l.clienteId === client.id)).toBe(
      true
    );
    expect(useAppStore.getState().equipment.some((e) => e.id === equipment.id && e.localId === location.id)).toBe(
      true
    );
  });

  it('§3–4 + §16–17 agendar → iniciar revisão → aprovar (happy path supervisor)', async () => {
    useAppStore.setState({ currentUser: SUPERVISOR });
    const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const scheduleInput = {
      modeloId: 'mod-1',
      clienteId: CONTRACT_IDS.client,
      localId: CONTRACT_IDS.site,
      tecnicoId: TECH.id,
      prioridade: 'ALTA' as const,
      dataPrevista: inDays(3),
    };
    const created: Inspection = {
      ...scheduleInput,
      id: 'insp-flow-1',
      modeloVersao: 3,
      status: 'ATRIBUIDA',
      answers: {},
      nonConformities: {},
      version: 1,
    };

    mocked(inspectionsApi.scheduleInspection).mockResolvedValue(created);
    await expect(useAppStore.getState().scheduleInspection(scheduleInput)).resolves.toEqual({
      ok: true,
      id: created.id,
    });
    expect(useAppStore.getState().inspections[0].status).toBe('ATRIBUIDA');

    // Simula inspeção já enviada pelo técnico (itens 5–15 fora do web).
    useAppStore.setState((s) => ({
      inspections: s.inspections.map((i) =>
        i.id === created.id ? { ...i, status: 'ENVIADA', version: 2 } : i
      ),
    }));

    mocked(inspectionsApi.startReview).mockResolvedValue({
      id: created.id,
      status: 'EM_REVISAO',
      version: 3,
    });
    await expect(useAppStore.getState().startReview(created.id)).resolves.toEqual({ ok: true });
    expect(useAppStore.getState().inspections.find((i) => i.id === created.id)?.status).toBe('EM_REVISAO');

    mocked(inspectionsApi.approveInspection).mockResolvedValue({
      id: created.id,
      status: 'APROVADA',
      version: 4,
    });
    await expect(useAppStore.getState().approveInspection(created.id, 'Checklist ok')).resolves.toEqual({
      ok: true,
    });
    const approved = useAppStore.getState().inspections.find((i) => i.id === created.id)!;
    expect(approved.status).toBe('APROVADA');
    expect(approved.review?.comentario).toBe('Checklist ok');
  });

  it('§17 ramo reprovação com motivo (após startReview)', async () => {
    useAppStore.setState({ currentUser: SUPERVISOR });
    mocked(inspectionsApi.startReview).mockResolvedValue({
      id: SENT_ID,
      status: 'EM_REVISAO',
      version: 3,
    });
    mocked(inspectionsApi.rejectInspection).mockResolvedValue({
      id: SENT_ID,
      status: 'REPROVADA',
      version: 4,
    });

    await useAppStore.getState().startReview(SENT_ID);
    await expect(useAppStore.getState().rejectInspection(SENT_ID, 'Evidência ilegível')).resolves.toEqual({
      ok: true,
    });

    const rejected = useAppStore.getState().inspections.find((i) => i.id === SENT_ID)!;
    expect(rejected.status).toBe('REPROVADA');
    expect(rejected.review?.motivoReprovacao).toBe('Evidência ilegível');
  });

  it('fila → detalhe: hydrate stub then startReview (0059/0060 path)', async () => {
    useAppStore.setState({
      currentUser: SUPERVISOR,
      inspections: MOCK_INSPECTIONS.filter((i) => i.id !== 'queue-only-1'),
    });
    const queueItem = {
      id: 'queue-only-1',
      clientId: CONTRACT_IDS.client,
      clientName: 'Cliente Fila',
      siteId: CONTRACT_IDS.site,
      siteName: 'Site Fila',
      technicianId: TECH.id,
      technicianName: TECH.nome,
      title: 'Inspeção da fila',
      prioridade: 'MEDIA' as const,
      scheduledFor: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
    };

    useAppStore.getState().ensureInspectionFromReviewQueue(queueItem);
    expect(useAppStore.getState().inspections.some((i) => i.id === 'queue-only-1')).toBe(true);

    mocked(inspectionsApi.startReview).mockResolvedValue({
      id: 'queue-only-1',
      status: 'EM_REVISAO',
      version: 2,
    });
    await expect(useAppStore.getState().startReview('queue-only-1')).resolves.toEqual({ ok: true });
    expect(useAppStore.getState().inspections.find((i) => i.id === 'queue-only-1')?.status).toBe('EM_REVISAO');
  });

  it('14.15: rede e 403 mapeados para copy sem retry em autorização', () => {
    expect(describeLoadError(new NetworkError())).toMatchObject({
      message: NETWORK_LOAD_MESSAGE,
      retry: true,
    });
    expect(describeLoadError(new ApiError('x', 403, undefined, 'ACCESS_DENIED'))).toMatchObject({
      message: FORBIDDEN_MESSAGE,
      retry: false,
    });
  });
});
