import type { AccessRequest, AuditEvent, Client, Equipment, Inspection, InspectionModel, Location, User } from '@/types';

export const MOCK_CLIENTS: Client[] = [
  { id: 'cli-1', nome: 'Grupo Sorocaba Alimentos', cnpj: '12.345.678/0001-90', ativo: true },
  { id: 'cli-2', nome: 'Fazenda Bela Vista', cnpj: '23.456.789/0001-01', ativo: true },
  { id: 'cli-3', nome: 'Metalúrgica Rio Verde', cnpj: '34.567.890/0001-12', ativo: true },
];

export const MOCK_LOCATIONS: Location[] = [
  { id: 'loc-1', clienteId: 'cli-1', nome: 'Planta Industrial · Galpão 2', endereco: 'Av. Independência, 1200 - Sorocaba/SP', ativo: true, lat: -23.4917, lng: -47.4525 },
  { id: 'loc-2', clienteId: 'cli-2', nome: 'Barracão de Máquinas', endereco: 'Estrada da Bela Vista, km 8 - Itu/SP', ativo: true, lat: -23.2645, lng: -47.2996 },
  { id: 'loc-3', clienteId: 'cli-3', nome: 'Linha de Produção 3', endereco: 'Rua das Indústrias, 450 - Rio Verde/GO', ativo: true, lat: -17.7943, lng: -50.9264 },
];

export const MOCK_EQUIPMENT: Equipment[] = [
  { id: 'eq-1', localId: 'loc-1', nome: 'Compressor de Ar CA-14', tipo: 'Compressor', qrCode: 'QR-CA14', ativo: true },
  { id: 'eq-2', localId: 'loc-2', nome: 'Trator Agrícola TR-08', tipo: 'Veículo', qrCode: 'QR-TR08', ativo: true },
  { id: 'eq-3', localId: 'loc-3', nome: 'Painel Elétrico PE-22', tipo: 'Painel elétrico', qrCode: 'QR-PE22', ativo: true },
];

/**
 * Contas do sistema (Seção 5 — Perfis de Usuário e Autorização). No painel
 * web só ADMIN e SUPERVISOR autenticam (RN-001); TECHNICIAN usa o app
 * mobile e CLIENT_VIEWER é escopo futuro — ambos aparecem aqui porque o
 * cadastro de usuários é único e centralizado (evita duplicidade — dor da
 * Ana em 03 - Problema).
 */
export const MOCK_USERS: User[] = [
  { id: 'usr-admin', nome: 'Ana Ribeiro', email: 'ana.ribeiro@fieldcore.com', role: 'ADMIN', status: 'ATIVO' },
  { id: 'usr-super', nome: 'Marina Costa', email: 'marina.costa@fieldcore.com', role: 'SUPERVISOR', status: 'ATIVO' },
  { id: 'tec-1', nome: 'Marcos Silva', email: 'marcos.silva@fieldcore.com', role: 'TECHNICIAN', status: 'ATIVO' },
  { id: 'tec-2', nome: 'Juliana Prado', email: 'juliana.prado@fieldcore.com', role: 'TECHNICIAN', status: 'ATIVO' },
  { id: 'tec-3', nome: 'Rafael Nunes', email: 'rafael.nunes@fieldcore.com', role: 'TECHNICIAN', status: 'INATIVO' },
  { id: 'usr-client', nome: 'Roberto Almeida', email: 'roberto.almeida@fieldcore.com', role: 'CLIENT_VIEWER', status: 'ATIVO' },
];

/** Apenas para o mock de login — em produção a API valida hash de senha (RN-007: nunca em log/claro). */
export const MOCK_CREDENTIALS: Record<string, string> = {
  'ana.ribeiro@fieldcore.com': 'admin123',
  'marina.costa@fieldcore.com': 'super123',
  'marcos.silva@fieldcore.com': 'tec123',
  'juliana.prado@fieldcore.com': 'tec123',
  'rafael.nunes@fieldcore.com': 'tec123',
  'roberto.almeida@fieldcore.com': 'cli123',
};

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
          { id: 'e1', title: 'Estrutura sem trincas ou corrosão visível', type: 'CONFORMITY', required: true, needsEvidenceOnNok: true },
          { id: 'e2', title: 'Pintura e identificação em bom estado', type: 'CONFORMITY', required: false, needsEvidenceOnNok: false },
        ],
      },
      {
        id: 'seguranca',
        title: 'Segurança',
        displayOrder: 1,
        items: [
          { id: 's1', title: 'Extintor de incêndio dentro da validade', type: 'CONFORMITY', required: true, needsEvidenceOnNok: false },
          { id: 's2', title: 'Sinalização de segurança visível e legível', type: 'CONFORMITY', required: false, needsEvidenceOnNok: false },
          {
            id: 's3',
            title: 'Condição geral de conservação do local',
            type: 'SINGLE_CHOICE',
            required: true,
            needsEvidenceOnNok: false,
            options: ['Boa', 'Regular', 'Ruim'],
          },
        ],
      },
      {
        id: 'eletrica',
        title: 'Elétrica',
        displayOrder: 2,
        items: [
          { id: 'l1', title: 'Temperatura do painel elétrico (°C)', type: 'NUMBER', required: true, needsEvidenceOnNok: false },
          { id: 'l2', title: 'Observações gerais do quadro elétrico', type: 'TEXT_LONG', required: false, needsEvidenceOnNok: false },
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
        items: [{ id: 'p1', title: 'Uso correto de EPI pela equipe', type: 'CONFORMITY', required: true, needsEvidenceOnNok: true }],
      },
    ],
  },
];

export const MOCK_INSPECTIONS: Inspection[] = [
  {
    id: 'INS-4471',
    clienteId: 'cli-1',
    localId: 'loc-1',
    equipamentoId: 'eq-1',
    modeloId: 'mod-1',
    modeloVersao: 3,
    tecnicoId: 'tec-1',
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
    clienteId: 'cli-2',
    localId: 'loc-2',
    equipamentoId: 'eq-2',
    modeloId: 'mod-1',
    modeloVersao: 3,
    tecnicoId: 'tec-2',
    prioridade: 'MEDIA',
    dataPrevista: '2026-08-10T16:30:00.000Z',
    status: 'EM_ANDAMENTO',
    answers: {},
    nonConformities: {},
  },
  {
    id: 'INS-4459',
    clienteId: 'cli-3',
    localId: 'loc-3',
    equipamentoId: 'eq-3',
    modeloId: 'mod-1',
    modeloVersao: 2,
    tecnicoId: 'tec-1',
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
    clienteId: 'cli-1',
    localId: 'loc-1',
    modeloId: 'mod-1',
    modeloVersao: 3,
    tecnicoId: 'tec-2',
    prioridade: 'ALTA',
    dataPrevista: '2026-08-11T08:00:00.000Z',
    status: 'ATRIBUIDA',
    answers: {},
    nonConformities: {},
  },
  {
    id: 'INS-4490',
    clienteId: 'cli-3',
    localId: 'loc-3',
    equipamentoId: 'eq-3',
    modeloId: 'mod-1',
    modeloVersao: 3,
    tecnicoId: 'tec-1',
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
    clienteId: 'cli-1',
    localId: 'loc-1',
    equipamentoId: 'eq-1',
    modeloId: 'mod-1',
    modeloVersao: 3,
    tecnicoId: 'tec-1',
    prioridade: 'ALTA',
    dataPrevista: '2026-08-18T09:30:00.000Z',
    orientacoes: 'Primeira inspeção deste compressor após a troca de peças.',
    status: 'ATRIBUIDA',
    answers: {},
    nonConformities: {},
  },
  {
    id: 'INS-4477',
    clienteId: 'cli-2',
    localId: 'loc-2',
    equipamentoId: 'eq-2',
    modeloId: 'mod-1',
    modeloVersao: 3,
    tecnicoId: 'tec-1',
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
        supervisorNome: 'Marina Costa',
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
    userNome: 'Ana Ribeiro',
    action: 'PUBLICOU',
    entity: 'Modelo de inspeção',
    entityId: 'mod-1',
    details: 'Checklist de Manutenção Preventiva · v3',
  },
  {
    id: 'aud-2',
    timestamp: '2026-08-08T09:20:00.000Z',
    userNome: 'Marina Costa',
    action: 'REPROVOU',
    entity: 'Inspeção',
    entityId: 'INS-4459',
    details: 'Motivo pendente de nova revisão',
  },
];
