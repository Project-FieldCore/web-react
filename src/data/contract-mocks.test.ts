import { describe, expect, it } from 'vitest';
import {
  CONTRACT_IDS,
  CONTRACT_MOCKS,
  MOCK_CLIENTS,
  MOCK_EQUIPMENT,
  MOCK_LOCATIONS,
  MOCK_USERS,
} from './contract-mocks';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('contract mocks (OpenAPI fieldops-v1.json)', () => {
  it('expõe os grupos de recurso do contrato', () => {
    expect(Object.keys(CONTRACT_MOCKS).sort()).toEqual(['clients', 'equipment', 'sites', 'users']);
  });

  it('users usam name/status ACTIVE|… e UUID (não nome/ATIVO/cli-*)', () => {
    expect(CONTRACT_MOCKS.users.length).toBeGreaterThan(0);
    for (const user of CONTRACT_MOCKS.users) {
      expect(user.id).toMatch(UUID_RE);
      expect(user).toHaveProperty('name');
      expect(user).not.toHaveProperty('nome');
      expect(['ACTIVE', 'INACTIVE', 'BLOCKED']).toContain(user.status);
    }
  });

  it('clients/sites/equipment alinhados ao contrato', () => {
    for (const client of CONTRACT_MOCKS.clients) {
      expect(client.id).toMatch(UUID_RE);
      expect(client).toHaveProperty('name');
      expect(['ACTIVE', 'INACTIVE']).toContain(client.status);
    }
    for (const site of CONTRACT_MOCKS.sites) {
      expect(site.id).toMatch(UUID_RE);
      expect(site.clientId).toMatch(UUID_RE);
      expect(site.clientId).toBe(CONTRACT_IDS.client);
      expect(['ACTIVE', 'INACTIVE']).toContain(site.status);
    }
    for (const equipment of CONTRACT_MOCKS.equipment) {
      expect(equipment.id).toMatch(UUID_RE);
      expect(equipment.siteId).toBe(CONTRACT_IDS.site);
      expect(['ACTIVE', 'INACTIVE', 'DECOMMISSIONED']).toContain(equipment.status);
      expect(equipment.qrCode).toBeTruthy();
    }
  });

  it('adapters produzem domínio do painel a partir do contrato', () => {
    expect(MOCK_USERS[0]).toMatchObject({
      id: CONTRACT_IDS.user,
      nome: 'Ana Silva',
      status: 'ATIVO',
      role: 'SUPERVISOR',
    });
    expect(MOCK_CLIENTS[0]).toMatchObject({
      id: CONTRACT_IDS.client,
      nome: 'Industria ABC',
      ativo: true,
    });
    expect(MOCK_LOCATIONS[0]).toMatchObject({
      id: CONTRACT_IDS.site,
      clienteId: CONTRACT_IDS.client,
      ativo: true,
    });
    expect(MOCK_EQUIPMENT[0]).toMatchObject({
      id: CONTRACT_IDS.equipment,
      localId: CONTRACT_IDS.site,
      ativo: true,
    });
  });
});
