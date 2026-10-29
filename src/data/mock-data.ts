import type { AccessRequest, AuditEvent, Inspection, InspectionModel } from '@/types';
import { CONTRACT_IDS, MOCK_CLIENTS, MOCK_EQUIPMENT, MOCK_LOCATIONS, MOCK_USERS } from './contract-mocks';

/** Cadastros: reexport do mock OpenAPI (ver `contract-mocks.ts` + `openapi/fieldops-v1.json`). */
export { MOCK_CLIENTS, MOCK_EQUIPMENT, MOCK_LOCATIONS, MOCK_USERS, CONTRACT_IDS };

/**
 * Modelos / inspeções / auditoria abaixo são **demo local do painel** (fora do
 * baseline de cadastros OpenAPI). FKs de cliente/local/equipamento/técnico
 * apontam para UUIDs do mock canônico para não divergir dos cadastros.
 */

export const MOCK_MODELS: InspectionModel[] = [
  {
    id: 'mod-1',
    title: 'Checklist de Manutenção Preventiva',
    description: 'Verificação estrutural, de segurança e elétrica de equipamentos industriais.',
    category: 'Manutenção',
    status: 'PUBLICADO',
    version: 3,
    updatedAt: '2026-07-28T10:00:00.000Z',
    sections: [
      {
        id: 'estrutura',
        title: 'Estrutura',
        displayOrder: 0,
        items: [
          { id: 'e1', title: 'Estrutura sem trincas ou corrosão visível', type: 'CONFORMITY', required: true, evidenceRequiredOnFailure: true, observationRequiredOnFailure: false },
          { id: 'e2', title: 'Pintura e identificação em bom estado', type: 'CONFORMITY', required: false, evidenceRequiredOnFailure: false, observationRequiredOnFailure: false },
        ],
      },
      {
        id: 'seguranca',
        title: 'Segurança',
        displayOrder: 1,
        items: [
          { id: 's1', title: 'Extintor de incêndio dentro da validade', type: 'CONFORMITY', required: true, evidenceRequiredOnFailure: false, observationRequiredOnFailure: false },
          { id: 's2', title: 'Sinalização de segurança visível e legível', type: 'CONFORMITY', required: false, evidenceRequiredOnFailure: false, observationRequiredOnFailure: false },
          {
            id: 's3',
            title: 'Condição geral de conservação do local',
            type: 'SINGLE_CHOICE',
            required: true,
            evidenceRequiredOnFailure: false, observationRequiredOnFailure: false,
            options: ['Boa', 'Regular', 'Ruim'],
          },
        ],
      },
      {
        id: 'eletrica',
        title: 'Elétrica',
        displayOrder: 2,
        items: [
          { id: 'l1', title: 'Temperatura do painel elétrico (°C)', type: 'NUMBER', required: true, evidenceRequiredOnFailure: false, observationRequiredOnFailure: false },
          { id: 'l2', title: 'Observações gerais do quadro elétrico', type: 'TEXT_LONG', required: false, evidenceRequiredOnFailure: false, observationRequiredOnFailure: false },
        ],
      },
    ],
  },
  {
    id: 'mod-2',
    title: 'Checklist de Segurança do Trabalho',
    description: 'Verificação de EPIs, sinalização e condições do ambiente de trabalho.',
    category: 'Segurança',
    status: 'RASCUNHO',
    version: 1,
    updatedAt: '2026-08-05T14:30:00.000Z',
    sections: [
      {
        id: 'epi',
        title: 'EPIs',
        displayOrder: 0,
        items: [{ id: 'p1', title: 'Uso correto de EPI pela equipe', type: 'CONFORMITY', required: true, evidenceRequiredOnFailure: true, observationRequiredOnFailure: false }],
      },
    ],
  },
];

export const MOCK_INSPECTIONS: Inspection[] = [
  {
    id: 'INS-4471',
    clienteId: 'd7fd13a8-caf8-4399-9eb4-68a7f56c18cd',
    localId: 'cdb42e4c-df5e-4cec-956f-c5e0f9348887',
    equipamentoId: '3d1945b0-39a7-4452-8eb4-2e504aadcf2d',
    modeloId: 'mod-1',
    modeloVersao: 3,
    tecnicoId: '0c3b2fd1-7e7a-48c3-9eeb-c7a872db3df1',
    prioridade: 'ALTA',
    dataPrevista: '2026-08-10T14:00:00.000Z',
    orientacoes: 'Verificar especialmente o painel elétrico — houve queixa de superaquecimento.',
    status: 'ENVIADA',
    answers: {
      e1: { itemId: 'e1', conformity: 'CONFORME', evidenceCount: 0 },
      e2: { itemId: 'e2', conformity: 'CONFORME', evidenceCount: 0 },
      s1: { itemId: 's1', conformity: 'CONFORME', evidenceCount: 0 },
      s2: { itemId: 's2', conformity: 'NAO_APLICAVEL', evidenceCount: 0 },
      l1: { itemId: 'l1', value: '58', evidenceCount: 0 },
      l2: { itemId: 'l2', value: 'Painel dentro do esperado, sem pontos de atenção.', evidenceCount: 0 },
    },
    nonConformities: {},
  },
  {
    id: 'INS-4468',
    clienteId: 'd7fd13a8-caf8-4399-9eb4-68a7f56c18cd',
    localId: 'cdb42e4c-df5e-4cec-956f-c5e0f9348887',
    equipamentoId: '3d1945b0-39a7-4452-8eb4-2e504aadcf2d',
    modeloId: 'mod-1',
    modeloVersao: 3,
    tecnicoId: '0c3b2fd1-7e7a-48c3-9eeb-c7a872db3df1',
    prioridade: 'MEDIA',
    dataPrevista: '2026-08-10T16:30:00.000Z',
    status: 'EM_ANDAMENTO',
    answers: {},
    nonConformities: {},
  },
  {
    id: 'INS-4459',
    clienteId: 'd7fd13a8-caf8-4399-9eb4-68a7f56c18cd',
    localId: 'cdb42e4c-df5e-4cec-956f-c5e0f9348887',
    equipamentoId: '3d1945b0-39a7-4452-8eb4-2e504aadcf2d',
    modeloId: 'mod-1',
    modeloVersao: 2,
    tecnicoId: '0c3b2fd1-7e7a-48c3-9eeb-c7a872db3df1',
    prioridade: 'BAIXA',
    dataPrevista: '2026-08-08T09:00:00.000Z',
    status: 'ENVIADA',
    answers: {
      e1: { itemId: 'e1', conformity: 'NAO_CONFORME', observacao: 'Corrosão leve na base do painel.', evidenceCount: 1 },
      e2: { itemId: 'e2', conformity: 'CONFORME', evidenceCount: 0 },
      s1: { itemId: 's1', conformity: 'CONFORME', evidenceCount: 0 },
      s2: { itemId: 's2', conformity: 'CONFORME', evidenceCount: 0 },
      l1: { itemId: 'l1', value: '71', evidenceCount: 0 },
      l2: { itemId: 'l2', value: '', evidenceCount: 0 },
    },
    nonConformities: {
      e1: {
        id: 'NC-1',
        itemId: 'e1',
        titulo: 'Corrosão na base do painel elétrico',
        descricao: 'Ponto de corrosão identificado na base, próximo à fixação.',
        criticidade: 'MEDIA',
        evidenceCount: 1,
        status: 'ABERTA',
      },
    },
  },
  {
    id: 'INS-4482',
    clienteId: 'd7fd13a8-caf8-4399-9eb4-68a7f56c18cd',
    localId: 'cdb42e4c-df5e-4cec-956f-c5e0f9348887',
    modeloId: 'mod-1',
    modeloVersao: 3,
    tecnicoId: '0c3b2fd1-7e7a-48c3-9eeb-c7a872db3df1',
    prioridade: 'ALTA',
    dataPrevista: '2026-08-11T08:00:00.000Z',
    status: 'ATRIBUIDA',
    answers: {},
    nonConformities: {},
  },
  {
    id: 'INS-4490',
    clienteId: 'd7fd13a8-caf8-4399-9eb4-68a7f56c18cd',
    localId: 'cdb42e4c-df5e-4cec-956f-c5e0f9348887',
    equipamentoId: '3d1945b0-39a7-4452-8eb4-2e504aadcf2d',
    modeloId: 'mod-1',
    modeloVersao: 3,
    tecnicoId: '0c3b2fd1-7e7a-48c3-9eeb-c7a872db3df1',
    prioridade: 'MEDIA',
    dataPrevista: '2026-08-17T13:00:00.000Z',
    orientacoes: 'Revisão de rotina do painel elétrico após manutenção da semana passada.',
    status: 'EM_ANDAMENTO',
    answers: {
      e1: { itemId: 'e1', conformity: 'CONFORME', evidenceCount: 0 },
      e2: { itemId: 'e2', conformity: 'NAO_CONFORME', observacao: 'Pintura descascando perto da base.', evidenceCount: 0 },
      s1: { itemId: 's1', conformity: 'CONFORME', evidenceCount: 0 },
      l1: { itemId: 'l1', value: '63', evidenceCount: 0 },
    },
    nonConformities: {
      e2: { id: 'NC-2', itemId: 'e2', titulo: 'Pintura desgastada', descricao: 'Descascamento na base da estrutura, sem exposição de metal.', criticidade: 'BAIXA', evidenceCount: 0, status: 'ABERTA' },
    },
  },
  {
    id: 'INS-4491',
    clienteId: 'd7fd13a8-caf8-4399-9eb4-68a7f56c18cd',
    localId: 'cdb42e4c-df5e-4cec-956f-c5e0f9348887',
    equipamentoId: '3d1945b0-39a7-4452-8eb4-2e504aadcf2d',
    modeloId: 'mod-1',
    modeloVersao: 3,
    tecnicoId: '0c3b2fd1-7e7a-48c3-9eeb-c7a872db3df1',
    prioridade: 'ALTA',
    dataPrevista: '2026-08-18T09:30:00.000Z',
    orientacoes: 'Primeira inspeção deste compressor após a troca de peças.',
    status: 'ATRIBUIDA',
    answers: {},
    nonConformities: {},
  },
  {
    id: 'INS-4477',
    clienteId: 'd7fd13a8-caf8-4399-9eb4-68a7f56c18cd',
    localId: 'cdb42e4c-df5e-4cec-956f-c5e0f9348887',
    equipamentoId: '3d1945b0-39a7-4452-8eb4-2e504aadcf2d',
    modeloId: 'mod-1',
    modeloVersao: 3,
    tecnicoId: '0c3b2fd1-7e7a-48c3-9eeb-c7a872db3df1',
    prioridade: 'MEDIA',
    dataPrevista: '2026-08-14T11:00:00.000Z',
    status: 'DEVOLVIDA',
    answers: {
      e1: { itemId: 'e1', conformity: 'CONFORME', evidenceCount: 0 },
      e2: { itemId: 'e2', conformity: 'CONFORME', evidenceCount: 0 },
      s1: { itemId: 's1', conformity: 'CONFORME', evidenceCount: 0 },
      s3: { itemId: 's3', value: 'Boa', evidenceCount: 0 },
      l1: { itemId: 'l1', value: '54', evidenceCount: 0 },
    },
    nonConformities: {},
    correcoes: [
      {
        supervisorNome: 'Ana Silva',
        comentario: 'O item "Extintor de incêndio dentro da validade" está marcado como conforme, mas a foto anexada mostra a etiqueta vencida. Verifique e corrija antes de reenviar.',
        createdAt: '2026-08-15T09:20:00.000Z',
      },
    ],
  },
];

/** Seed de exemplo para a fila de aprovação em /users (tela "Solicitar acesso"). */
export const MOCK_ACCESS_REQUESTS: AccessRequest[] = [
  {
    id: 'req-1',
    nome: 'Paulo Mendes',
    email: 'paulo.mendes@fieldcore.com',
    role: 'SUPERVISOR',
    justificativa: 'Vou assumir a supervisão da região sul a partir da próxima semana.',
    status: 'PENDENTE',
    createdAt: '2026-08-30T13:10:00.000Z',
  },
];

/** Seed inicial da trilha de auditoria (RN-086) — o restante é gerado pelas ações do painel. */
export const MOCK_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: 'aud-1',
    timestamp: '2026-07-28T10:00:00.000Z',
    userNome: 'Ana Silva',
    action: 'PUBLICOU',
    entity: 'Modelo de inspeção',
    entityId: 'mod-1',
    details: 'Checklist de Manutenção Preventiva · v3',
  },
  {
    id: 'aud-2',
    timestamp: '2026-08-08T09:20:00.000Z',
    userNome: 'Ana Silva',
    action: 'REPROVOU',
    entity: 'Inspeção',
    entityId: 'INS-4459',
    details: 'Motivo pendente de nova revisão',
  },
];
