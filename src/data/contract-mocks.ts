/**
 * Cadastros derivados do mock canônico OpenAPI (api-java/openapi/mocks/fieldops-v1.json).
 * Shape do JSON = contrato (`name`, `status`, UUID). Domínio do painel continua
 * em PT (`nome`, `ativo`) via adapters abaixo — mesma ideia de `users-api.ts`.
 */

import type { Client, Equipment, Location, User, UserRole, UserStatus } from '@/types';
import fieldopsV1 from './openapi/fieldops-v1.json';

export type ContractUserStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
export type ContractActiveStatus = 'ACTIVE' | 'INACTIVE';
export type ContractEquipmentStatus = 'ACTIVE' | 'INACTIVE' | 'DECOMMISSIONED';

export interface ContractUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: ContractUserStatus;
  phone?: string | null;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContractClient {
  id: string;
  name: string;
  status: ContractActiveStatus;
  version: number;
  document?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContractSite {
  id: string;
  clientId: string;
  name: string;
  city?: string | null;
  state?: string | null;
  status: ContractActiveStatus;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContractEquipment {
  id: string;
  siteId: string;
  name: string;
  assetNumber?: string | null;
  qrCode: string;
  status: ContractEquipmentStatus;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContractMocksBundle {
  users: ContractUser[];
  clients: ContractClient[];
  sites: ContractSite[];
  equipment: ContractEquipment[];
}

/** Payload bruto alinhado ao contrato — use em testes de shape. */
export const CONTRACT_MOCKS: ContractMocksBundle = fieldopsV1 as ContractMocksBundle;

const USER_STATUS_FROM_API: Record<ContractUserStatus, UserStatus> = {
  ACTIVE: 'ATIVO',
  INACTIVE: 'INATIVO',
  BLOCKED: 'BLOQUEADO',
};

export function toDomainUser(user: ContractUser): User {
  return {
    id: user.id,
    nome: user.name,
    email: user.email,
    role: user.role,
    status: USER_STATUS_FROM_API[user.status],
    phone: user.phone ?? undefined,
    version: user.version,
  };
}

export function toDomainClient(client: ContractClient): Client {
  return {
    id: client.id,
    nome: client.name,
    cnpj: client.document ?? undefined,
    ativo: client.status === 'ACTIVE',
  };
}

/** Site (contrato) → Location (domínio do painel). */
export function toDomainLocation(site: ContractSite): Location {
  const endereco = [site.city, site.state].filter(Boolean).join(' / ') || undefined;
  return {
    id: site.id,
    clienteId: site.clientId,
    nome: site.name,
    endereco,
    ativo: site.status === 'ACTIVE',
  };
}

export function toDomainEquipment(equipment: ContractEquipment): Equipment {
  return {
    id: equipment.id,
    localId: equipment.siteId,
    nome: equipment.name,
    tipo: equipment.assetNumber ?? undefined,
    qrCode: equipment.qrCode,
    ativo: equipment.status === 'ACTIVE',
  };
}

/** Seeds de cadastro para o store — sempre derivados do JSON do contrato. */
export const MOCK_USERS: User[] = CONTRACT_MOCKS.users.map(toDomainUser);
export const MOCK_CLIENTS: Client[] = CONTRACT_MOCKS.clients.map(toDomainClient);
export const MOCK_LOCATIONS: Location[] = CONTRACT_MOCKS.sites.map(toDomainLocation);
export const MOCK_EQUIPMENT: Equipment[] = CONTRACT_MOCKS.equipment.map(toDomainEquipment);

/** IDs estáveis do mock canônico (úteis em testes / FKs de demos locais). */
export const CONTRACT_IDS = {
  user: CONTRACT_MOCKS.users[0]!.id,
  client: CONTRACT_MOCKS.clients[0]!.id,
  site: CONTRACT_MOCKS.sites[0]!.id,
  equipment: CONTRACT_MOCKS.equipment[0]!.id,
} as const;
