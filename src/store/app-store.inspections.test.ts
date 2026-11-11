import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from './app-store';
import { ApiError, NetworkError } from '@/lib/http';
import { MOCK_INSPECTIONS, MOCK_MODELS, MOCK_USERS } from '@/data/mock-data';
import { CONTRACT_IDS } from '@/data/contract-mocks';
import type { Inspection, User } from '@/types';

/** Fixture local de teste (não está no mock OpenAPI — contrato só traz SUPERVISOR). */
const DEMO_TECHNICIAN: User = {
  id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  nome: 'Demo Technician',
  email: 'tec.demo@example.com',
  role: 'TECHNICIAN',
  status: 'ATIVO',
};

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

import * as inspectionsApi from '@/lib/inspections-api';

function mocked<T extends (...args: never[]) => unknown>(fn: T) {
  return fn as unknown as ReturnType<typeof vi.fn>;
}

const SENT_ID = 'INS-4471'; // ENVIADA, checklist completo
const WITH_NC_ID = 'INS-4459'; // ENVIADA, com não conformidade e1
const ASSIGNED_ID = 'INS-4482'; // ATRIBUIDA, sem respostas

const find = (id: string) => useAppStore.getState().inspections.find((i) => i.id === id)!;

/** Preenche todo item do modelo — a validação local (RN-039/040) só deixa enviar checklist completo. */
function fillAllAnswers(inspectionId: string) {
  const state = useAppStore.getState();
  const insp = state.inspections.find((i) => i.id === inspectionId)!;
  const model = state.models.find((m) => m.id === insp.modeloId)!;
  const answers = Object.fromEntries(
    model.sections.flatMap((sec) =>
      sec.items.map((it) => [it.id, { itemId: it.id, conformity: 'CONFORME' as const, value: 'ok', evidenceCount: 0 }])
    )
  );
  useAppStore.setState((s) => ({ inspections: s.inspections.map((i) => (i.id === inspectionId ? { ...i, answers } : i)) }));
}

describe('useAppStore agendamento, execução, revisão e NC — #135', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      inspections: structuredClone(MOCK_INSPECTIONS),
      models: structuredClone(MOCK_MODELS),
      users: [...structuredClone(MOCK_USERS), structuredClone(DEMO_TECHNICIAN)],
      syncQueue: [],
      syncing: false,
      lastSyncAt: null,
    });
  });

  describe('scheduleInspection', () => {
    // Data sempre no futuro (a API e o store recusam data passada).
    const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const input = {
      modeloId: 'mod-1',
      clienteId: CONTRACT_IDS.client,
      localId: CONTRACT_IDS.site,
      tecnicoId: DEMO_TECHNICIAN.id,
      prioridade: 'ALTA' as const,
      dataPrevista: inDays(7),
    };
    /** Liga o modelo publicado a uma versão na API (hoje a API ainda não expõe esse id). */
    const linkModelToApiVersion = () =>
      useAppStore.setState((s) => ({
        models: s.models.map((m) => (m.id === 'mod-1' ? { ...m, templateVersionId: 'ver-api-1' } : m)),
      }));

    it('modelo com versão na API: agenda via API e guarda a inspeção devolvida (id do servidor)', async () => {
      linkModelToApiVersion();
      const created: Inspection = { ...input, id: 'srv-1', modeloVersao: 3, status: 'ATRIBUIDA', answers: {}, nonConformities: {} };
      mocked(inspectionsApi.scheduleInspection).mockResolvedValue(created);

      const result = await useAppStore.getState().scheduleInspection(input);

      expect(result).toEqual({ ok: true, id: 'srv-1' });
      expect(inspectionsApi.scheduleInspection).toHaveBeenCalledWith(input, 'ver-api-1', 3);
      expect(useAppStore.getState().inspections[0]).toEqual(created);
    });

    it('modelo sem versão na API: agenda só na tela, ATRIBUÍDA, sem chamar a API', async () => {
      const result = await useAppStore.getState().scheduleInspection({ ...input, orientacoes: '  Levar EPI  ' });

      expect(result.ok).toBe(true);
      expect(inspectionsApi.scheduleInspection).not.toHaveBeenCalled();
      const created = useAppStore.getState().inspections[0];
      expect(created).toMatchObject({
        id: (result as { id: string }).id,
        clienteId: CONTRACT_IDS.client,
        localId: CONTRACT_IDS.site,
        tecnicoId: DEMO_TECHNICIAN.id,
        modeloId: 'mod-1',
        modeloVersao: 3,
        prioridade: 'ALTA',
        status: 'ATRIBUIDA',
        orientacoes: 'Levar EPI',
        answers: {},
        nonConformities: {},
      });
      expect(created.id).toMatch(/^INS-\d{4}$/);
    });

    it('o equipamento escolhido fica na inspeção local', async () => {
      await useAppStore.getState().scheduleInspection({ ...input, equipamentoId: CONTRACT_IDS.equipment });

      expect(useAppStore.getState().inspections[0].equipamentoId).toBe(CONTRACT_IDS.equipment);
    });

    it('registra o agendamento no histórico', async () => {
      await useAppStore.getState().scheduleInspection(input);

      expect(useAppStore.getState().auditEvents[0]).toMatchObject({ action: 'AGENDOU', entity: 'Inspeção' });
    });

    it('RN-024: modelo em rascunho não chama a API', async () => {
      const result = await useAppStore.getState().scheduleInspection({ ...input, modeloId: 'mod-2' });

      expect(result.ok).toBe(false);
      expect(inspectionsApi.scheduleInspection).not.toHaveBeenCalled();
    });

    it('RN-027: técnico inativo não chama a API', async () => {
      const result = await useAppStore.getState().scheduleInspection({ ...input, tecnicoId: 'tec-3' });

      expect(result.ok).toBe(false);
      expect(inspectionsApi.scheduleInspection).not.toHaveBeenCalled();
    });

    it('cliente inativo fica fora de novos agendamentos e não chama a API', async () => {
      const initialClients = useAppStore.getState().clients;
      useAppStore.setState({
        clients: [{ id: CONTRACT_IDS.client, nome: 'Acme', ativo: false, version: 1 }],
      });
      try {
        const result = await useAppStore.getState().scheduleInspection(input);

        expect(result).toEqual({ ok: false, error: 'Cliente inativo não pode receber novos agendamentos.' });
        expect(inspectionsApi.scheduleInspection).not.toHaveBeenCalled();
      } finally {
        useAppStore.setState({ clients: initialClients });
      }
    });

    it('local inativo fica fora de novos agendamentos e não chama a API', async () => {
      const initialLocations = useAppStore.getState().locations;
      useAppStore.setState({
        locations: [{ id: CONTRACT_IDS.site, clienteId: CONTRACT_IDS.client, nome: 'Matriz', ativo: false, version: 1 }],
      });
      try {
        const result = await useAppStore.getState().scheduleInspection(input);

        expect(result).toEqual({ ok: false, error: 'Local inativo não pode receber novos agendamentos.' });
        expect(inspectionsApi.scheduleInspection).not.toHaveBeenCalled();
      } finally {
        useAppStore.setState({ locations: initialLocations });
      }
    });

    describe('técnico (RN-027)', () => {
      const withUsers = (extra: User[]) => {
        const initial = useAppStore.getState().users;
        useAppStore.setState({ users: [...initial, ...extra] });
        return () => useAppStore.setState({ users: initial });
      };
      const person = (over: Partial<User>): User => ({ id: 'u-x', nome: 'Pessoa', email: 'p@x.com', role: 'TECHNICIAN', status: 'ATIVO', ...over });

      it('técnico inativo é recusado com a mensagem da RN-027, sem chamar a API', async () => {
        const restore = withUsers([person({ id: 'u-inativo', status: 'INATIVO' })]);
        try {
          const result = await useAppStore.getState().scheduleInspection({ ...input, tecnicoId: 'u-inativo' });

          expect(result).toEqual({ ok: false, error: 'Somente técnicos ativos podem receber uma nova atribuição (RN-027).' });
          expect(inspectionsApi.scheduleInspection).not.toHaveBeenCalled();
        } finally {
          restore();
        }
      });

      it('técnico bloqueado também é recusado', async () => {
        const restore = withUsers([person({ id: 'u-bloq', status: 'BLOQUEADO' })]);
        try {
          expect((await useAppStore.getState().scheduleInspection({ ...input, tecnicoId: 'u-bloq' })).ok).toBe(false);
        } finally {
          restore();
        }
      });

      it('quem não é técnico é recusado, mesmo ativo', async () => {
        const restore = withUsers([person({ id: 'u-admin', role: 'ADMIN' })]);
        try {
          const result = await useAppStore.getState().scheduleInspection({ ...input, tecnicoId: 'u-admin' });

          expect(result).toEqual({ ok: false, error: 'O usuário escolhido não é um técnico.' });
        } finally {
          restore();
        }
      });

      it('técnico que não está na lista carregada pede para recarregar', async () => {
        const result = await useAppStore.getState().scheduleInspection({ ...input, tecnicoId: 'nao-existe' });

        expect(result).toEqual({ ok: false, error: 'Técnico não encontrado. Recarregue a lista de técnicos e tente de novo.' });
        expect(inspectionsApi.scheduleInspection).not.toHaveBeenCalled();
      });
    });

    it('RN-025: data prevista obrigatória', async () => {
      const result = await useAppStore.getState().scheduleInspection({ ...input, dataPrevista: '' });

      expect(result).toEqual({ ok: false, error: 'Cliente, local e data prevista são obrigatórios (RN-025).' });
      expect(inspectionsApi.scheduleInspection).not.toHaveBeenCalled();
    });

    it('data no passado é recusada, sem chamar a API nem criar a inspeção', async () => {
      linkModelToApiVersion();
      const before = useAppStore.getState().inspections.length;

      const result = await useAppStore.getState().scheduleInspection({ ...input, dataPrevista: new Date(Date.now() - 60_000).toISOString() });

      expect(result).toEqual({ ok: false, error: 'A data prevista precisa estar no futuro.' });
      expect(inspectionsApi.scheduleInspection).not.toHaveBeenCalled();
      expect(useAppStore.getState().inspections).toHaveLength(before);
    });

    it('orientações acima de 2000 caracteres são recusadas', async () => {
      const result = await useAppStore.getState().scheduleInspection({ ...input, orientacoes: 'x'.repeat(2001) });

      expect(result).toEqual({ ok: false, error: 'As orientações devem ter no máximo 2000 caracteres.' });
    });

    it('propaga ApiError (ex.: técnico inativo no servidor) e não altera a lista', async () => {
      linkModelToApiVersion();
      mocked(inspectionsApi.scheduleInspection).mockRejectedValue(new ApiError('Técnico indisponível.', 409));
      const before = useAppStore.getState().inspections.length;

      const result = await useAppStore.getState().scheduleInspection(input);

      expect(result).toEqual({ ok: false, error: 'Técnico indisponível.' });
      expect(useAppStore.getState().inspections).toHaveLength(before);
    });

    it('erro de rede ao agendar na API não cria a inspeção', async () => {
      linkModelToApiVersion();
      mocked(inspectionsApi.scheduleInspection).mockRejectedValue(new NetworkError('Sem conexão.'));
      const before = useAppStore.getState().inspections.length;

      const result = await useAppStore.getState().scheduleInspection(input);

      expect(result).toEqual({ ok: false, error: 'Sem conexão.' });
      expect(useAppStore.getState().inspections).toHaveLength(before);
    });
  });

  describe('revisão', () => {
    it('startReview aplica status EM_REVISAO e version da API', async () => {
      mocked(inspectionsApi.startReview).mockResolvedValue({ id: SENT_ID, status: 'EM_REVISAO', version: 3 });

      const result = await useAppStore.getState().startReview(SENT_ID);

      expect(result).toEqual({ ok: true });
      expect(find(SENT_ID).status).toBe('EM_REVISAO');
      expect(find(SENT_ID).version).toBe(3);
    });

    it('startReview traduz 403 e 409 INSPECTION_NOT_REVIEWABLE', async () => {
      mocked(inspectionsApi.startReview)
        .mockRejectedValueOnce(new ApiError('forbidden', 403, undefined, 'ACCESS_DENIED'))
        .mockRejectedValueOnce(new ApiError('conflict', 409, undefined, 'INSPECTION_NOT_REVIEWABLE'));

      await expect(useAppStore.getState().startReview(SENT_ID)).resolves.toEqual({
        ok: false,
        error: 'Seu perfil não pode iniciar a revisão.',
        code: 'ACCESS_DENIED',
      });
      await expect(useAppStore.getState().startReview(SENT_ID)).resolves.toEqual({
        ok: false,
        error: 'Esta inspeção não está aguardando revisão.',
        code: 'INSPECTION_NOT_REVIEWABLE',
      });
      expect(find(SENT_ID).status).toBe('ENVIADA');
    });

    it('approveInspection aplica APROVADA e guarda comentário local', async () => {
      useAppStore.setState({ currentUser: MOCK_USERS.find((u) => u.role === 'SUPERVISOR') ?? MOCK_USERS[0] });
      mocked(inspectionsApi.approveInspection).mockResolvedValue({ id: SENT_ID, status: 'APROVADA', version: 4 });

      const result = await useAppStore.getState().approveInspection(SENT_ID, 'Ok');

      expect(result).toEqual({ ok: true });
      expect(inspectionsApi.approveInspection).toHaveBeenCalledWith(SENT_ID, 'Ok');
      expect(find(SENT_ID).status).toBe('APROVADA');
      expect(find(SENT_ID).version).toBe(4);
      expect(find(SENT_ID).review?.comentario).toBe('Ok');
    });

    it('approveInspection traduz 403 e 409', async () => {
      mocked(inspectionsApi.approveInspection)
        .mockRejectedValueOnce(new ApiError('forbidden', 403, undefined, 'ACCESS_DENIED'))
        .mockRejectedValueOnce(new ApiError('conflict', 409, undefined, 'INSPECTION_NOT_REVIEWABLE'));

      await expect(useAppStore.getState().approveInspection(SENT_ID)).resolves.toEqual({
        ok: false,
        error: 'Seu perfil não pode aprovar esta inspeção.',
        code: 'ACCESS_DENIED',
      });
      await expect(useAppStore.getState().approveInspection(SENT_ID)).resolves.toEqual({
        ok: false,
        error: 'Esta inspeção não está em revisão.',
        code: 'INSPECTION_NOT_REVIEWABLE',
      });
      expect(find(SENT_ID).status).toBe('ENVIADA');
    });

    it('approveInspection mantém o status quando a rede falha', async () => {
      mocked(inspectionsApi.approveInspection).mockRejectedValue(new NetworkError('Sem conexão.'));

      const result = await useAppStore.getState().approveInspection(SENT_ID);

      expect(result).toEqual({ ok: false, error: 'Não foi possível aprovar a inspeção. Tente novamente.' });
      expect(find(SENT_ID).status).toBe('ENVIADA');
    });

    it('RN-080: reprovação sem motivo não chama a API', async () => {
      const result = await useAppStore.getState().rejectInspection(SENT_ID, '   ');

      expect(result).toEqual({ ok: false, error: 'Informe o motivo da reprovação.' });
      expect(inspectionsApi.rejectInspection).not.toHaveBeenCalled();
      expect(find(SENT_ID).status).toBe('ENVIADA');
    });

    it('rejectInspection com motivo aplica REPROVADA', async () => {
      useAppStore.setState({ currentUser: MOCK_USERS.find((u) => u.role === 'SUPERVISOR') ?? MOCK_USERS[0] });
      mocked(inspectionsApi.rejectInspection).mockResolvedValue({
        id: SENT_ID,
        status: 'REPROVADA',
        version: 6,
      });

      const result = await useAppStore.getState().rejectInspection(SENT_ID, ' Evidência ausente ');

      expect(result).toEqual({ ok: true });
      expect(inspectionsApi.rejectInspection).toHaveBeenCalledWith(SENT_ID, 'Evidência ausente');
      expect(find(SENT_ID).status).toBe('REPROVADA');
      expect(find(SENT_ID).version).toBe(6);
      expect(find(SENT_ID).review?.motivoReprovacao).toBe('Evidência ausente');
    });

    it('rejectInspection traduz 403 e 409', async () => {
      mocked(inspectionsApi.rejectInspection)
        .mockRejectedValueOnce(new ApiError('forbidden', 403, undefined, 'ACCESS_DENIED'))
        .mockRejectedValueOnce(new ApiError('conflict', 409, undefined, 'INSPECTION_NOT_REVIEWABLE'));

      await expect(useAppStore.getState().rejectInspection(SENT_ID, 'motivo')).resolves.toEqual({
        ok: false,
        error: 'Seu perfil não pode reprovar esta inspeção.',
        code: 'ACCESS_DENIED',
      });
      await expect(useAppStore.getState().rejectInspection(SENT_ID, 'motivo')).resolves.toEqual({
        ok: false,
        error: 'Esta inspeção não está em revisão.',
        code: 'INSPECTION_NOT_REVIEWABLE',
      });
    });

    it('returnForCorrection exige comentário e registra a devolução da API', async () => {
      const blocked = await useAppStore.getState().returnForCorrection(SENT_ID, '');
      expect(blocked.ok).toBe(false);
      expect(inspectionsApi.returnForCorrection).not.toHaveBeenCalled();

      const correcoes = [{ supervisorNome: 'Marina Costa', comentario: 'Refazer item e1', createdAt: '2026-10-01T10:00:00.000Z' }];
      mocked(inspectionsApi.returnForCorrection).mockResolvedValue({ ...find(SENT_ID), status: 'DEVOLVIDA', correcoes });

      const result = await useAppStore.getState().returnForCorrection(SENT_ID, 'Refazer item e1');

      expect(result).toEqual({ ok: true });
      expect(find(SENT_ID).status).toBe('DEVOLVIDA');
      expect(find(SENT_ID).correcoes).toEqual(correcoes);
    });
  });

  describe('resolveNonConformity', () => {
    it('chama a API e guarda a NC atualizada', async () => {
      const current = find(WITH_NC_ID);
      mocked(inspectionsApi.setNonConformityStatus).mockResolvedValue({
        ...current,
        nonConformities: { ...current.nonConformities, e1: { ...current.nonConformities.e1, status: 'RESOLVIDA' } },
      });

      const result = await useAppStore.getState().resolveNonConformity(WITH_NC_ID, 'e1', 'RESOLVIDA');

      expect(result).toEqual({ ok: true });
      expect(inspectionsApi.setNonConformityStatus).toHaveBeenCalledWith(WITH_NC_ID, 'e1', 'RESOLVIDA');
      expect(find(WITH_NC_ID).nonConformities.e1.status).toBe('RESOLVIDA');
    });

    it('mantém o status quando a API falha', async () => {
      const before = find(WITH_NC_ID).nonConformities.e1.status;
      mocked(inspectionsApi.setNonConformityStatus).mockRejectedValue(new ApiError('Sem permissão.', 403));

      const result = await useAppStore.getState().resolveNonConformity(WITH_NC_ID, 'e1', 'RESOLVIDA');

      expect(result).toEqual({ ok: false, error: 'Sem permissão.' });
      expect(find(WITH_NC_ID).nonConformities.e1.status).toBe(before);
    });
  });

  describe('execução do checklist', () => {
    it('submitInspection bloqueia item obrigatório sem resposta, sem chamar a API', async () => {
      const result = await useAppStore.getState().submitInspection(ASSIGNED_ID);

      expect(result.ok).toBe(false);
      expect(inspectionsApi.syncResponses).not.toHaveBeenCalled();
      expect(inspectionsApi.submitInspection).not.toHaveBeenCalled();
    });

    it('submitInspection envia respostas, fecha na API e limpa a fila da inspeção', async () => {
      fillAllAnswers(SENT_ID);
      useAppStore.getState().saveAnswer(SENT_ID, 'e1', { conformity: 'CONFORME' });
      useAppStore.getState().saveGeolocation(ASSIGNED_ID, { lat: 1, lng: 2 });
      mocked(inspectionsApi.syncResponses).mockResolvedValue(find(SENT_ID));
      mocked(inspectionsApi.submitInspection).mockResolvedValue({ ...find(SENT_ID), status: 'ENVIADA' });

      const result = await useAppStore.getState().submitInspection(SENT_ID);

      expect(result).toEqual({ ok: true });
      expect(inspectionsApi.syncResponses).toHaveBeenCalledWith(expect.objectContaining({ id: SENT_ID }));
      expect(inspectionsApi.submitInspection).toHaveBeenCalledWith(SENT_ID);
      expect(useAppStore.getState().syncQueue.map((q) => q.inspectionId)).toEqual([ASSIGNED_ID]);
    });

    describe('regras "na falha" por item (PBI-0021.1)', () => {
      const MODEL_ID = 'mod-1';
      const ITEM_ID = 'e1'; // item de conformidade do modelo de exemplo

      function setItemFlags(patch: { observationRequiredOnFailure?: boolean; evidenceRequiredOnFailure?: boolean }) {
        useAppStore.setState((s) => ({
          models: s.models.map((m) =>
            m.id === MODEL_ID
              ? { ...m, sections: m.sections.map((sec) => ({ ...sec, items: sec.items.map((it) => (it.id === ITEM_ID ? { ...it, ...patch } : it)) })) }
              : m
          ),
        }));
      }

      function answerNonConforming(observacao?: string, evidenceCount = 0) {
        fillAllAnswers(SENT_ID);
        useAppStore.setState((s) => ({
          inspections: s.inspections.map((i) =>
            i.id === SENT_ID
              ? {
                  ...i,
                  answers: { ...i.answers, [ITEM_ID]: { itemId: ITEM_ID, conformity: 'NAO_CONFORME', observacao, evidenceCount } },
                  nonConformities: { ...i.nonConformities, [ITEM_ID]: { itemId: ITEM_ID, status: 'ABERTA', evidenceCount } as never },
                }
              : i
          ),
        }));
        mocked(inspectionsApi.syncResponses).mockResolvedValue(find(SENT_ID));
        mocked(inspectionsApi.submitInspection).mockResolvedValue({ ...find(SENT_ID), status: 'ENVIADA' });
      }

      it('observação obrigatória: não conforme sem observação bloqueia o envio, sem chamar a API', async () => {
        setItemFlags({ observationRequiredOnFailure: true, evidenceRequiredOnFailure: false });
        answerNonConforming(undefined);

        const result = await useAppStore.getState().submitInspection(SENT_ID);

        expect(result.ok).toBe(false);
        expect((result as { error: string }).error).toContain('exige uma observação quando não conforme');
        expect(inspectionsApi.syncResponses).not.toHaveBeenCalled();
      });

      it('observação só com espaços conta como vazia', async () => {
        setItemFlags({ observationRequiredOnFailure: true, evidenceRequiredOnFailure: false });
        answerNonConforming('   ');

        const result = await useAppStore.getState().submitInspection(SENT_ID);

        expect(result.ok).toBe(false);
        expect(inspectionsApi.submitInspection).not.toHaveBeenCalled();
      });

      it('observação preenchida libera o envio', async () => {
        setItemFlags({ observationRequiredOnFailure: true, evidenceRequiredOnFailure: false });
        answerNonConforming('Corrosão na base.');

        const result = await useAppStore.getState().submitInspection(SENT_ID);

        expect(result).toEqual({ ok: true });
        expect(inspectionsApi.submitInspection).toHaveBeenCalledWith(SENT_ID);
      });

      it('sem a flag de observação, não conforme sem observação continua podendo enviar', async () => {
        setItemFlags({ observationRequiredOnFailure: false, evidenceRequiredOnFailure: false });
        answerNonConforming(undefined);

        expect((await useAppStore.getState().submitInspection(SENT_ID)).ok).toBe(true);
      });

      it('conforme não exige observação, mesmo com a flag ligada', async () => {
        setItemFlags({ observationRequiredOnFailure: true, evidenceRequiredOnFailure: true });
        fillAllAnswers(SENT_ID);
        mocked(inspectionsApi.syncResponses).mockResolvedValue(find(SENT_ID));
        mocked(inspectionsApi.submitInspection).mockResolvedValue({ ...find(SENT_ID), status: 'ENVIADA' });

        expect((await useAppStore.getState().submitInspection(SENT_ID)).ok).toBe(true);
      });

      it('evidência obrigatória (RN-039): não conforme sem evidência bloqueia, com evidência libera', async () => {
        setItemFlags({ observationRequiredOnFailure: false, evidenceRequiredOnFailure: true });
        answerNonConforming('Corrosão.', 0);

        const blocked = await useAppStore.getState().submitInspection(SENT_ID);
        expect(blocked.ok).toBe(false);
        expect((blocked as { error: string }).error).toContain('exige evidência');
        expect(inspectionsApi.syncResponses).not.toHaveBeenCalled();

        answerNonConforming('Corrosão.', 2);
        expect((await useAppStore.getState().submitInspection(SENT_ID)).ok).toBe(true);
      });

      it('com as duas regras, a observação é cobrada antes da evidência', async () => {
        setItemFlags({ observationRequiredOnFailure: true, evidenceRequiredOnFailure: true });
        answerNonConforming(undefined, 0);

        const result = await useAppStore.getState().submitInspection(SENT_ID);

        expect((result as { error: string }).error).toContain('observação');
      });
    });

    it('submitInspection mantém a fila e o status quando a API falha', async () => {
      fillAllAnswers(SENT_ID);
      useAppStore.getState().saveAnswer(SENT_ID, 'e1', { conformity: 'CONFORME' });
      useAppStore.setState((s) => ({
        inspections: s.inspections.map((i) => (i.id === SENT_ID ? { ...i, status: 'EM_ANDAMENTO' } : i)),
      }));
      mocked(inspectionsApi.syncResponses).mockRejectedValue(new NetworkError('Sem conexão.'));

      const result = await useAppStore.getState().submitInspection(SENT_ID);

      expect(result).toEqual({ ok: false, error: 'Sem conexão.' });
      expect(find(SENT_ID).status).toBe('EM_ANDAMENTO');
      expect(useAppStore.getState().syncQueue).toHaveLength(1);
    });
  });

  describe('reatribuição de técnico (RN-027)', () => {
    const NEW_TECH: User = { id: 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee', nome: 'Bia Costa', email: 'bia@x.com', role: 'TECHNICIAN', status: 'ATIVO' };
    const INACTIVE_TECH: User = { ...NEW_TECH, id: 'cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee', nome: 'Caio Inativo', status: 'INATIVO' };
    const setInspection = (patch: Partial<Inspection>) =>
      useAppStore.setState((s) => ({ inspections: s.inspections.map((i) => (i.id === ASSIGNED_ID ? { ...i, ...patch } : i)) }));

    beforeEach(() => {
      useAppStore.setState((s) => ({ users: [...s.users, NEW_TECH, INACTIVE_TECH] }));
    });

    it('inspeção só da tela (sem version): troca localmente, sem chamar a API, e registra no histórico', async () => {
      const result = await useAppStore.getState().reassignInspection(ASSIGNED_ID, NEW_TECH.id);

      expect(result).toEqual({ ok: true });
      expect(find(ASSIGNED_ID)).toMatchObject({ tecnicoId: NEW_TECH.id, status: 'ATRIBUIDA' });
      expect(inspectionsApi.assignInspection).not.toHaveBeenCalled();
      expect(useAppStore.getState().auditEvents[0]).toMatchObject({ action: 'REATRIBUIU', entityId: ASSIGNED_ID, details: 'Bia Costa' });
    });

    it('inspeção da API (com version): chama PATCH assignee e guarda o que voltou (com o version novo)', async () => {
      setInspection({ version: 2 });
      mocked(inspectionsApi.assignInspection).mockResolvedValue({ tecnicoId: NEW_TECH.id, status: 'ATRIBUIDA', version: 3 });

      const result = await useAppStore.getState().reassignInspection(ASSIGNED_ID, NEW_TECH.id);

      expect(result).toEqual({ ok: true });
      expect(inspectionsApi.assignInspection).toHaveBeenCalledWith(ASSIGNED_ID, NEW_TECH.id, 2);
      expect(find(ASSIGNED_ID)).toMatchObject({ tecnicoId: NEW_TECH.id, version: 3 });
    });

    it('preserva o resto da inspeção (respostas, modelo, data)', async () => {
      const before = find(ASSIGNED_ID);

      await useAppStore.getState().reassignInspection(ASSIGNED_ID, NEW_TECH.id);

      expect(find(ASSIGNED_ID)).toMatchObject({ modeloId: before.modeloId, dataPrevista: before.dataPrevista, answers: before.answers });
    });

    it('técnico inativo é recusado antes de ir à API e nada muda', async () => {
      setInspection({ version: 2 });
      const before = find(ASSIGNED_ID);

      const result = await useAppStore.getState().reassignInspection(ASSIGNED_ID, INACTIVE_TECH.id);

      expect(result).toEqual({ ok: false, error: 'Somente técnicos ativos podem receber uma nova atribuição (RN-027).' });
      expect(inspectionsApi.assignInspection).not.toHaveBeenCalled();
      expect(find(ASSIGNED_ID)).toEqual(before);
    });

    it('inspeção que não é atribuída (ex.: em andamento ou enviada) não troca de técnico', async () => {
      for (const status of ['EM_ANDAMENTO', 'ENVIADA', 'EM_REVISAO', 'APROVADA', 'CANCELADA'] as const) {
        setInspection({ status });

        const result = await useAppStore.getState().reassignInspection(ASSIGNED_ID, NEW_TECH.id);

        expect(result, status).toEqual({ ok: false, error: 'Esta inspeção já não pode ser reatribuída no estado atual.' });
      }
      expect(inspectionsApi.assignInspection).not.toHaveBeenCalled();
    });

    it('o mesmo técnico não conta como troca', async () => {
      const current = find(ASSIGNED_ID).tecnicoId;

      const result = await useAppStore.getState().reassignInspection(ASSIGNED_ID, current);

      expect(result).toEqual({ ok: false, error: 'Esta inspeção já está atribuída a esse técnico.' });
    });

    it('erro da API (ex.: 409 INSPECTION_NOT_ASSIGNABLE) volta em português e não altera a inspeção', async () => {
      setInspection({ version: 2 });
      mocked(inspectionsApi.assignInspection).mockRejectedValue(
        new ApiError('Esta inspeção já não pode ser reatribuída no estado atual.', 409, undefined, 'INSPECTION_NOT_ASSIGNABLE')
      );
      const before = find(ASSIGNED_ID);

      const result = await useAppStore.getState().reassignInspection(ASSIGNED_ID, NEW_TECH.id);

      expect(result).toMatchObject({ ok: false, error: 'Esta inspeção já não pode ser reatribuída no estado atual.', code: 'INSPECTION_NOT_ASSIGNABLE' });
      expect(find(ASSIGNED_ID)).toEqual(before);
    });

    it('erro de rede não altera a inspeção', async () => {
      setInspection({ version: 2 });
      mocked(inspectionsApi.assignInspection).mockRejectedValue(new NetworkError('Sem conexão.'));

      expect(await useAppStore.getState().reassignInspection(ASSIGNED_ID, NEW_TECH.id)).toEqual({ ok: false, error: 'Sem conexão.' });
      expect(find(ASSIGNED_ID).tecnicoId).not.toBe(NEW_TECH.id);
    });

    it('inspeção ou técnico inexistentes devolvem erro', async () => {
      expect(await useAppStore.getState().reassignInspection('INS-0000', NEW_TECH.id)).toEqual({ ok: false, error: 'Inspeção não encontrada.' });
      expect((await useAppStore.getState().reassignInspection(ASSIGNED_ID, 'nao-existe')).ok).toBe(false);
    });
  });

  describe('cancelamento com justificativa (RN-029/030)', () => {
    const SUPERVISOR = { id: 'usr-super', nome: 'Marina Costa', email: 'marina@fieldcore.com', role: 'SUPERVISOR' as const, status: 'ATIVO' as const };
    const setStatus = (id: string, status: Inspection['status']) =>
      useAppStore.setState((s) => ({ inspections: s.inspections.map((i) => (i.id === id ? { ...i, status } : i)) }));
    const apiMocks = () => Object.values(inspectionsApi).filter((fn) => typeof fn === 'function');

    beforeEach(() => {
      useAppStore.setState({ currentUser: SUPERVISOR });
    });
    afterEach(() => {
      useAppStore.setState({ currentUser: null });
    });

    it('inspeção da API (com version) cancela no PATCH e guarda a trilha que voltou', async () => {
      useAppStore.setState((s) => ({
        inspections: s.inspections.map((i) => (i.id === ASSIGNED_ID ? { ...i, version: 4 } : i)),
      }));
      mocked(inspectionsApi.cancelInspection).mockResolvedValue({
        ...find(ASSIGNED_ID),
        status: 'CANCELADA',
        version: 5,
        cancelamento: {
          porId: 'usr-super',
          porNome: 'Supervisor',
          em: '2026-11-05T12:00:00.000Z',
          justificativa: 'Cliente pediu o cancelamento.',
        },
      });

      const result = await useAppStore.getState().cancelInspection(ASSIGNED_ID, '  Cliente pediu o cancelamento.  ');

      expect(result).toEqual({ ok: true });
      expect(inspectionsApi.cancelInspection).toHaveBeenCalledWith(ASSIGNED_ID, '  Cliente pediu o cancelamento.  ', 4);
      expect(find(ASSIGNED_ID).status).toBe('CANCELADA');
      expect(find(ASSIGNED_ID).version).toBe(5);
      expect(find(ASSIGNED_ID).cancelamento).toMatchObject({ porNome: 'Marina Costa', porId: 'usr-super' });
    });

    it('cancela, vira CANCELADA e registra usuário, data e justificativa (RN-029)', async () => {
      const before = Date.now();

      const result = await useAppStore.getState().cancelInspection(ASSIGNED_ID, '  Cliente pediu o cancelamento.  ');

      expect(result).toEqual({ ok: true });
      const inspection = find(ASSIGNED_ID);
      expect(inspection.status).toBe('CANCELADA');
      expect(inspection.cancelamento).toMatchObject({
        porNome: 'Marina Costa',
        porId: 'usr-super',
        justificativa: 'Cliente pediu o cancelamento.',
      });
      const when = new Date(inspection.cancelamento!.em).getTime();
      expect(when).toBeGreaterThanOrEqual(before);
      expect(when).toBeLessThanOrEqual(Date.now());
    });

    it('registra no histórico quem cancelou e por quê', async () => {
      await useAppStore.getState().cancelInspection(ASSIGNED_ID, 'Equipamento desativado');

      expect(useAppStore.getState().auditEvents[0]).toMatchObject({
        action: 'CANCELOU',
        entity: 'Inspeção',
        entityId: ASSIGNED_ID,
        details: 'Equipamento desativado',
        userNome: 'Marina Costa',
      });
    });

    it('aprovada não cancela pelo fluxo comum (RN-030) e nada muda', async () => {
      setStatus(SENT_ID, 'APROVADA');
      const before = find(SENT_ID);
      const auditBefore = useAppStore.getState().auditEvents.length;

      const result = await useAppStore.getState().cancelInspection(SENT_ID, 'Tentativa');

      expect(result).toEqual({ ok: false, error: 'Inspeção aprovada não pode ser cancelada pelo fluxo comum (RN-030).' });
      expect(find(SENT_ID)).toEqual(before);
      expect(useAppStore.getState().auditEvents).toHaveLength(auditBefore);
    });

    it('já cancelada não cancela de novo e preserva o primeiro registro', async () => {
      await useAppStore.getState().cancelInspection(ASSIGNED_ID, 'Primeiro motivo');
      const first = find(ASSIGNED_ID).cancelamento;

      const again = await useAppStore.getState().cancelInspection(ASSIGNED_ID, 'Segundo motivo');

      expect(again).toEqual({ ok: false, error: 'Esta inspeção já está cancelada.' });
      expect(find(ASSIGNED_ID).cancelamento).toEqual(first);
    });

    it('justificativa vazia, só com espaços ou longa demais é recusada e nada muda', async () => {
      const before = find(ASSIGNED_ID);

      for (const text of ['', '   ', '\n\t']) {
        expect(await useAppStore.getState().cancelInspection(ASSIGNED_ID, text)).toEqual({
          ok: false,
          error: 'Informe a justificativa do cancelamento (RN-029).',
        });
      }
      expect(await useAppStore.getState().cancelInspection(ASSIGNED_ID, 'x'.repeat(1001))).toEqual({
        ok: false,
        error: 'A justificativa deve ter no máximo 1000 caracteres.',
      });
      expect(find(ASSIGNED_ID)).toEqual(before);
    });

    it('justificativa com exatamente 1000 caracteres é aceita', async () => {
      expect((await useAppStore.getState().cancelInspection(ASSIGNED_ID, 'x'.repeat(1000))).ok).toBe(true);
    });

    it('sem sessão (usuário desconhecido), não cancela: o registro exige quem cancelou', async () => {
      useAppStore.setState({ currentUser: null });

      const result = await useAppStore.getState().cancelInspection(ASSIGNED_ID, 'Motivo');

      expect(result).toEqual({ ok: false, error: 'Sua sessão expirou. Entre novamente para cancelar a inspeção.' });
      expect(find(ASSIGNED_ID).status).toBe('ATRIBUIDA');
    });

    it('inspeção inexistente devolve erro', async () => {
      expect(await useAppStore.getState().cancelInspection('INS-0000', 'Motivo')).toEqual({ ok: false, error: 'Inspeção não encontrada.' });
    });

    it('todos os estados em andamento ou pendentes podem ser cancelados', async () => {
      for (const status of ['RASCUNHO', 'ATRIBUIDA', 'EM_ANDAMENTO', 'ENVIADA', 'EM_REVISAO', 'DEVOLVIDA', 'REPROVADA'] as const) {
        setStatus(ASSIGNED_ID, status);
        useAppStore.setState((s) => ({ inspections: s.inspections.map((i) => (i.id === ASSIGNED_ID ? { ...i, cancelamento: undefined } : i)) }));

        const result = await useAppStore.getState().cancelInspection(ASSIGNED_ID, `Cancelar a partir de ${status}`);

        expect(result, status).toEqual({ ok: true });
        expect(find(ASSIGNED_ID).status).toBe('CANCELADA');
      }
    });

    it('só a inspeção cancelada muda; as outras ficam intactas', async () => {
      const others = useAppStore.getState().inspections.filter((i) => i.id !== ASSIGNED_ID);

      await useAppStore.getState().cancelInspection(ASSIGNED_ID, 'Motivo');

      expect(useAppStore.getState().inspections.filter((i) => i.id !== ASSIGNED_ID)).toEqual(others);
    });

    it('limpa da fila de sincronização só os itens da inspeção cancelada', async () => {
      useAppStore.setState({
        syncQueue: [
          { id: 's1', inspectionId: ASSIGNED_ID, descricao: 'Resposta do checklist', createdAt: '2026-10-01T10:00:00.000Z' },
          { id: 's2', inspectionId: SENT_ID, descricao: 'Resposta do checklist', createdAt: '2026-10-01T10:00:00.000Z' },
        ],
      });

      await useAppStore.getState().cancelInspection(ASSIGNED_ID, 'Motivo');

      expect(useAppStore.getState().syncQueue.map((q) => q.id)).toEqual(['s2']);
    });

    it('ainda não chama a API: o backend não tem endpoint de cancelar', async () => {
      await useAppStore.getState().cancelInspection(ASSIGNED_ID, 'Motivo');

      for (const fn of apiMocks()) expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('syncNow', () => {
    it('não faz nada com a fila vazia', async () => {
      const result = await useAppStore.getState().syncNow();

      expect(result).toEqual({ ok: true });
      expect(inspectionsApi.syncResponses).not.toHaveBeenCalled();
    });

    it('envia uma vez por inspeção pendente e esvazia a fila', async () => {
      useAppStore.getState().saveAnswer(ASSIGNED_ID, 'e1', { conformity: 'CONFORME' });
      useAppStore.getState().saveAnswer(ASSIGNED_ID, 'e2', { conformity: 'CONFORME' });
      mocked(inspectionsApi.syncResponses).mockResolvedValue(find(ASSIGNED_ID));

      const result = await useAppStore.getState().syncNow();

      expect(result).toEqual({ ok: true });
      expect(inspectionsApi.syncResponses).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().syncQueue).toEqual([]);
      expect(useAppStore.getState().lastSyncAt).not.toBeNull();
      expect(useAppStore.getState().syncing).toBe(false);
    });

    it('mantém na fila só a inspeção que falhou e reporta o erro', async () => {
      useAppStore.getState().saveAnswer(ASSIGNED_ID, 'e1', { conformity: 'CONFORME' });
      useAppStore.getState().saveAnswer(SENT_ID, 'e1', { conformity: 'CONFORME' });
      mocked(inspectionsApi.syncResponses).mockImplementation(async (insp: { id: string }) => {
        if (insp.id === ASSIGNED_ID) throw new ApiError('Conflito de versão.', 409);
        return find(insp.id);
      });

      const result = await useAppStore.getState().syncNow();

      expect(result).toEqual({ ok: false, error: 'Conflito de versão.' });
      expect(useAppStore.getState().syncQueue.map((q) => q.inspectionId)).toEqual([ASSIGNED_ID]);
      expect(useAppStore.getState().syncing).toBe(false);
    });
  });
});
