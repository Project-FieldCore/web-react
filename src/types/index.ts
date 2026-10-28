/**
 * Tipos de domínio do painel administrativo/supervisor do FieldCore.
 * Derivados de 05 - Perfis de Usuário, 06 - Casos de Uso, 08 - Funcionalidades, 09 - Regras de Negócio.
 */

export type Priority = 'ALTA' | 'MEDIA' | 'BAIXA';

export type InspectionStatus =
  | 'RASCUNHO'
  | 'ATRIBUIDA'
  | 'EM_ANDAMENTO'
  | 'ENVIADA'
  | 'EM_REVISAO'
  | 'DEVOLVIDA'
  | 'APROVADA'
  | 'REPROVADA'
  | 'CANCELADA';

export type ModelStatus = 'RASCUNHO' | 'PUBLICADO';

export type ItemType =
  | 'TEXT_SHORT'
  | 'TEXT_LONG'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'CONFORMITY'
  | 'SINGLE_CHOICE'
  | 'DATE';

export interface ModelItem {
  id: string;
  title: string;
  type: ItemType;
  required: boolean;
  /** RN-039: item crítico — exige evidência quando não conforme. */
  needsEvidenceOnNok: boolean;
  /** Alternativas disponíveis quando type === 'SINGLE_CHOICE'. */
  options?: string[];
}

export interface ModelSection {
  id: string;
  title: string;
  items: ModelItem[];
}

export interface InspectionModel {
  id: string;
  title: string;
  description: string;
  category: string;
  status: ModelStatus;
  /** RN-020: alterações em um modelo publicado geram nova versão. */
  version: number;
  sections: ModelSection[];
  updatedAt: string;
}

/**
 * Perfis de acesso (Seção 5). O app mobile é o canal do TECHNICIAN; o painel
 * administrativo web é usado por ADMIN e SUPERVISOR. CLIENT_VIEWER existe no
 * modelo de autorização, mas o portal do cliente é funcionalidade futura.
 */
export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'TECHNICIAN' | 'CLIENT_VIEWER';

/** RN-002: inativação não exclui histórico — por isso nunca há exclusão física de usuário. */
export type UserStatus = 'ATIVO' | 'INATIVO' | 'BLOQUEADO';

export interface User {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  /** Versão da API (trava otimista): obrigatória para editar e mudar status. */
  version?: number;
  phone?: string;
}

export interface Client {
  id: string;
  nome: string;
  cnpj?: string;
  /** RN-013: inativação em vez de exclusão física. */
  ativo: boolean;
  /** Versão da API (trava otimista): obrigatória para editar e mudar status. */
  version?: number;
}

export interface Location {
  id: string;
  clienteId: string;
  nome: string;
  endereco?: string;
  ativo: boolean;
  lat?: number;
  lng?: number;
}

export interface Equipment {
  id: string;
  localId: string;
  nome: string;
  tipo?: string;
  qrCode: string;
  ativo: boolean;
}

export type ConformityAnswer = 'CONFORME' | 'NAO_CONFORME' | 'NAO_APLICAVEL';

export interface Answer {
  itemId: string;
  conformity?: ConformityAnswer;
  value?: string;
  observacao?: string;
  evidenceCount: number;
  /** Fotos de evidência (data URLs) anexadas pelo técnico. */
  photos?: string[];
}

export function isAnswerFilled(answer: Answer | undefined): boolean {
  if (!answer) return false;
  return Boolean(answer.conformity || (answer.value && answer.value.trim().length > 0));
}

export type Criticidade = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';

export type NonConformityStatus = 'ABERTA' | 'RESOLVIDA';

export interface NonConformity {
  id: string;
  itemId?: string;
  titulo: string;
  descricao: string;
  criticidade: Criticidade;
  evidenceCount: number;
  status: NonConformityStatus;
  /** Fotos de evidência (data URLs) anexadas para a não conformidade. */
  photos?: string[];
}

export interface Geolocalizacao {
  lat: number;
  lng: number;
  capturedAt: string;
}

export interface SyncQueueItem {
  id: string;
  inspectionId: string;
  descricao: string;
  createdAt: string;
}

export interface ReviewInfo {
  supervisorNome: string;
  comentario?: string;
  motivoReprovacao?: string;
  decidedAt?: string;
}

/** Registro de devolução da inspeção para correção do técnico (feedback do gestor). */
export interface CorrectionFeedback {
  supervisorNome: string;
  comentario: string;
  createdAt: string;
}

export interface Inspection {
  id: string;
  clienteId: string;
  localId: string;
  equipamentoId?: string;
  modeloId: string;
  modeloVersao: number;
  tecnicoId: string;
  prioridade: Priority;
  dataPrevista: string;
  orientacoes?: string;
  status: InspectionStatus;
  answers: Record<string, Answer>;
  nonConformities: Record<string, NonConformity>;
  review?: ReviewInfo;
  geolocalizacao?: Geolocalizacao;
  /** Data/hora em que o QR Code do equipamento foi escaneado e confirmado. */
  qrConfirmadoEm?: string;
  /** Histórico de devoluções para correção (mais recente por último). */
  correcoes?: CorrectionFeedback[];
}

/**
 * Pedido de acesso ao painel web (tela "Solicitar acesso"). Não existe
 * autocadastro instantâneo — RN-003 (menor privilégio) exige que um ADMIN
 * confirme o perfil antes de a conta existir de fato (ver UsersPage).
 */
export type AccessRequestStatus = 'PENDENTE' | 'APROVADA' | 'REJEITADA';

export interface AccessRequest {
  id: string;
  nome: string;
  email: string;
  role: Extract<UserRole, 'ADMIN' | 'SUPERVISOR'>;
  justificativa?: string;
  status: AccessRequestStatus;
  createdAt: string;
}

/** RN-086: alterações críticas registram usuário, data, ação e entidade. RN-088: nunca exclusão física. */
export interface AuditEvent {
  id: string;
  timestamp: string;
  userNome: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
}
