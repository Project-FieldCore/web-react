import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assignEquipmentQrCode,
  createEquipment,
  getEquipmentByQrCode,
  listEquipment,
  listEquipmentBySite,
  searchEquipment,
  setEquipmentActive,
  updateEquipment,
} from './equipment-api';
import { setAuthToken } from './auth-token';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const API_EQUIPMENT = {
  id: 'eq-1',
  siteId: 'site-1',
  name: 'Compressor CA-14',
  qrCode: 'fieldops://equipment/CA-14',
  assetNumber: 'CA-14',
  status: 'ACTIVE',
  version: 2,
};
const APP_EQUIPMENT = {
  id: 'eq-1',
  localId: 'site-1',
  nome: 'Compressor CA-14',
  tipo: 'CA-14',
  qrCode: 'fieldops://equipment/CA-14',
  ativo: true,
  version: 2,
};

describe('equipment-api', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    setAuthToken(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('listEquipment converte campos (name→nome, siteId→localId, assetNumber→tipo, ACTIVE→ativo)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        items: [API_EQUIPMENT, { ...API_EQUIPMENT, id: 'eq-2', assetNumber: null, status: 'INACTIVE' }],
        page: { page: 0, size: 100, totalElements: 2, totalPages: 1 },
      })
    );
    global.fetch = fetchMock;

    const equipment = await listEquipment();

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/equipment\?page=0&size=100$/);
    expect(equipment).toEqual([
      APP_EQUIPMENT,
      { id: 'eq-2', localId: 'site-1', nome: 'Compressor CA-14', tipo: undefined, qrCode: APP_EQUIPMENT.qrCode, ativo: false, version: 2 },
    ]);
  });

  it('listEquipment percorre todas as páginas', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { items: [API_EQUIPMENT], page: { page: 0, size: 100, totalElements: 2, totalPages: 2 } })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          items: [{ ...API_EQUIPMENT, id: 'eq-2' }],
          page: { page: 1, size: 100, totalElements: 2, totalPages: 2 },
        })
      );
    global.fetch = fetchMock;

    expect((await listEquipment()).map((e) => e.id)).toEqual(['eq-1', 'eq-2']);
  });

  it('searchEquipment envia page/size/sort/q/status/siteId', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { items: [API_EQUIPMENT], page: { page: 1, size: 12, totalElements: 12, totalPages: 1 } })
    );
    global.fetch = fetchMock;

    const result = await searchEquipment({
      page: 1,
      size: 12,
      sort: { field: 'name', dir: 'asc' },
      q: 'compressor',
      filters: { ativo: true, localId: 'site-1' },
    });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toMatch(/\/equipment$/);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '1',
      size: '12',
      sort: 'name,asc',
      q: 'compressor',
      status: 'ACTIVE',
      siteId: 'site-1',
    });
    expect(result.items).toEqual([APP_EQUIPMENT]);
  });

  it('listEquipmentBySite usa /sites/{id}/equipment', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, [API_EQUIPMENT]));
    global.fetch = fetchMock;

    expect(await listEquipmentBySite('site-1')).toEqual([APP_EQUIPMENT]);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/sites\/site-1\/equipment$/);
  });

  it('createEquipment POST /sites/{id}/equipment com name/qrCode/assetNumber', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, API_EQUIPMENT));
    global.fetch = fetchMock;

    const created = await createEquipment('site-1', 'Compressor CA-14', 'fieldops://equipment/CA-14', 'CA-14');

    expect(created).toEqual(APP_EQUIPMENT);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/sites\/site-1\/equipment$/);
    expect(JSON.parse(init.body)).toEqual({
      name: 'Compressor CA-14',
      qrCode: 'fieldops://equipment/CA-14',
      assetNumber: 'CA-14',
    });
  });

  it('updateEquipment envia version e campos parciais', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ...API_EQUIPMENT, name: 'Novo', version: 3 }));
    global.fetch = fetchMock;

    await updateEquipment('eq-1', { nome: 'Novo' }, 2);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/equipment\/eq-1$/);
    expect(JSON.parse(init.body)).toEqual({ name: 'Novo', version: 2 });
  });

  it('setEquipmentActive usa /status com ACTIVE/INACTIVE e version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ...API_EQUIPMENT, status: 'INACTIVE', version: 3 }));
    global.fetch = fetchMock;

    const updated = await setEquipmentActive('eq-1', false, 2);

    expect(updated.ativo).toBe(false);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/equipment\/eq-1\/status$/);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ status: 'INACTIVE', version: 2 });
  });

  it('assignEquipmentQrCode usa /qr-code com version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ...API_EQUIPMENT, qrCode: 'QR-NEW', version: 3 }));
    global.fetch = fetchMock;

    const updated = await assignEquipmentQrCode('eq-1', 'QR-NEW', 2);

    expect(updated.qrCode).toBe('QR-NEW');
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/equipment\/eq-1\/qr-code$/);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ qrCode: 'QR-NEW', version: 2 });
  });

  it('getEquipmentByQrCode busca por QR', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, API_EQUIPMENT));
    global.fetch = fetchMock;

    expect(await getEquipmentByQrCode('fieldops://equipment/CA-14')).toEqual(APP_EQUIPMENT);
    expect(decodeURIComponent(fetchMock.mock.calls[0][0])).toMatch(/\/equipment\/by-qr\/fieldops:\/\/equipment\/CA-14$/);
  });

  it('QR duplicado (409 QR_CODE_ALREADY_EXISTS) chega como ApiError em português', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(409, { status: 409, code: 'QR_CODE_ALREADY_EXISTS', message: 'QR code is already assigned' })
    );

    await expect(createEquipment('site-1', 'X', 'dup')).rejects.toMatchObject({
      code: 'QR_CODE_ALREADY_EXISTS',
      message: 'Já existe um equipamento com esse código QR.',
    });
  });
});
