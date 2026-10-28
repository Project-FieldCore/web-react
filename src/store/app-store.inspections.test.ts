import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from './app-store';
import { ApiError, NetworkError } from '@/lib/http';
import { MOCK_INSPECTIONS, MOCK_MODELS, MOCK_USERS } from '@/data/mock-data';
import type { Inspection } from '@/types';

vi.mock('@/lib/inspections-api', () => ({
  scheduleInspection: vi.fn(),
  startReview: vi.fn(),
  approveInspection: vi.fn(),
  rejectInspection: vi.fn(),
  returnForCorrection: vi.fn(),
  setNonConformityStatus: vi.fn(),
  syncResponses: vi.fn(),
  submitInspection: vi.fn(),
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
      users: structuredClone(MOCK_USERS),
      syncQueue: [],
      syncing: false,
      lastSyncAt: null,
    });
  });

  describe('scheduleInspection', () => {
    const input = {
      modeloId: 'mod-1',
      clienteId: 'cli-1',
      localId: 'loc-1',
      tecnicoId: 'tec-1',
      prioridade: 'ALTA' as const,
      dataPrevista: '2026-11-01T10:00:00.000Z',
    };

    it('agenda via API e guarda a inspeção devolvida (id do servidor)', async () => {
      const created: Inspection = { ...input, id: 'srv-1', modeloVersao: 3, status: 'ATRIBUIDA', answers: {}, nonConformities: {} };
      mocked(inspectionsApi.scheduleInspection).mockResolvedValue(created);

      const result = await useAppStore.getState().scheduleInspection(input);

      expect(result).toEqual({ ok: true, id: 'srv-1' });
      expect(useAppStore.getState().inspections[0]).toEqual(created);
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
      useAppStore.setState({ clients: [{ id: 'cli-1', nome: 'Acme', ativo: false, version: 1 }] });
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
      useAppStore.setState({ locations: [{ id: 'loc-1', clienteId: 'cli-1', nome: 'Matriz', ativo: false, version: 1 }] });
      try {
        const result = await useAppStore.getState().scheduleInspection(input);

        expect(result).toEqual({ ok: false, error: 'Local inativo não pode receber novos agendamentos.' });
        expect(inspectionsApi.scheduleInspection).not.toHaveBeenCalled();
      } finally {
        useAppStore.setState({ locations: initialLocations });
      }
    });

    it('RN-025: data prevista obrigatória', async () => {
      const result = await useAppStore.getState().scheduleInspection({ ...input, dataPrevista: '' });

      expect(result.ok).toBe(false);
      expect(inspectionsApi.scheduleInspection).not.toHaveBeenCalled();
    });

    it('propaga ApiError e não altera a lista', async () => {
      mocked(inspectionsApi.scheduleInspection).mockRejectedValue(new ApiError('Técnico indisponível.', 409));
      const before = useAppStore.getState().inspections.length;

      const result = await useAppStore.getState().scheduleInspection(input);

      expect(result).toEqual({ ok: false, error: 'Técnico indisponível.' });
      expect(useAppStore.getState().inspections).toHaveLength(before);
    });
  });

  describe('revisão', () => {
    it('startReview substitui a inspeção pela versão da API', async () => {
      mocked(inspectionsApi.startReview).mockResolvedValue({ ...find(SENT_ID), status: 'EM_REVISAO' });

      const result = await useAppStore.getState().startReview(SENT_ID);

      expect(result).toEqual({ ok: true });
      expect(find(SENT_ID).status).toBe('EM_REVISAO');
    });

    it('approveInspection envia o comentário e guarda a revisão devolvida', async () => {
      const review = { supervisorNome: 'Marina Costa', comentario: 'Ok', decidedAt: '2026-10-01T10:00:00.000Z' };
      mocked(inspectionsApi.approveInspection).mockResolvedValue({ ...find(SENT_ID), status: 'APROVADA', review });

      const result = await useAppStore.getState().approveInspection(SENT_ID, 'Ok');

      expect(result).toEqual({ ok: true });
      expect(inspectionsApi.approveInspection).toHaveBeenCalledWith(SENT_ID, 'Ok');
      expect(find(SENT_ID).status).toBe('APROVADA');
      expect(find(SENT_ID).review).toEqual(review);
    });

    it('approveInspection mantém o status quando a API falha', async () => {
      mocked(inspectionsApi.approveInspection).mockRejectedValue(new NetworkError('Sem conexão.'));

      const result = await useAppStore.getState().approveInspection(SENT_ID);

      expect(result).toEqual({ ok: false, error: 'Sem conexão.' });
      expect(find(SENT_ID).status).toBe('ENVIADA');
    });

    it('RN-080: reprovação sem motivo não chama a API', async () => {
      const result = await useAppStore.getState().rejectInspection(SENT_ID, '   ');

      expect(result.ok).toBe(false);
      expect(inspectionsApi.rejectInspection).not.toHaveBeenCalled();
      expect(find(SENT_ID).status).toBe('ENVIADA');
    });

    it('rejectInspection com motivo chama a API e atualiza o status', async () => {
      mocked(inspectionsApi.rejectInspection).mockResolvedValue({
        ...find(SENT_ID),
        status: 'REPROVADA',
        review: { supervisorNome: 'Marina Costa', motivoReprovacao: 'Evidência ausente' },
      });

      const result = await useAppStore.getState().rejectInspection(SENT_ID, ' Evidência ausente ');

      expect(result).toEqual({ ok: true });
      expect(inspectionsApi.rejectInspection).toHaveBeenCalledWith(SENT_ID, 'Evidência ausente');
      expect(find(SENT_ID).status).toBe('REPROVADA');
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
