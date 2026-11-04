import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from './app-store';
import { ApiError } from '@/lib/http';
import type { Equipment } from '@/types';
import { CONTRACT_IDS } from '@/data/contract-mocks';

vi.mock('@/lib/equipment-api', () => ({
  listEquipment: vi.fn(),
  createEquipment: vi.fn(),
  updateEquipment: vi.fn(),
  setEquipmentActive: vi.fn(),
  assignEquipmentQrCode: vi.fn(),
}));

import * as equipmentApi from '@/lib/equipment-api';

function mocked<T extends (...args: never[]) => unknown>(fn: T) {
  return fn as unknown as ReturnType<typeof vi.fn>;
}

const SITE_ID = CONTRACT_IDS.site;

describe('useAppStore equipamentos (PBI-0015.1 / 0016.1)', () => {
  const initial = useAppStore.getState().equipment;

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      equipment: initial,
      equipmentStatus: 'idle',
      equipmentError: null,
      locations: useAppStore.getState().locations,
    });
  });

  afterEach(() => {
    useAppStore.setState({ equipment: initial, equipmentStatus: 'idle', equipmentError: null });
  });

  it('createEquipment chama a API e guarda o equipamento', async () => {
    const created: Equipment = {
      id: 'eq-new',
      localId: SITE_ID,
      nome: 'Bomba',
      tipo: 'B-1',
      qrCode: 'QR-B1',
      ativo: true,
      version: 0,
    };
    mocked(equipmentApi.createEquipment).mockResolvedValue(created);

    const result = await useAppStore.getState().createEquipment(SITE_ID, 'Bomba', 'QR-B1', 'B-1');

    expect(result).toEqual({ ok: true, id: 'eq-new' });
    expect(equipmentApi.createEquipment).toHaveBeenCalledWith(SITE_ID, 'Bomba', 'QR-B1', 'B-1');
    expect(useAppStore.getState().equipment).toContainEqual(created);
  });

  it('createEquipment propaga QR duplicado (409)', async () => {
    mocked(equipmentApi.createEquipment).mockRejectedValue(
      new ApiError('Já existe um equipamento com esse código QR.', 409, undefined, 'QR_CODE_ALREADY_EXISTS')
    );

    const result = await useAppStore.getState().createEquipment(SITE_ID, 'Bomba', 'dup', 'B-1');

    expect(result).toEqual({
      ok: false,
      error: 'Já existe um equipamento com esse código QR.',
      code: 'QR_CODE_ALREADY_EXISTS',
    });
  });

  describe('com equipamentos carregados (com version)', () => {
    const loaded: Equipment = {
      id: 'eq-1',
      localId: SITE_ID,
      nome: 'Compressor',
      qrCode: 'QR-1',
      ativo: true,
      version: 3,
    };

    beforeEach(() => {
      useAppStore.setState({ equipment: [loaded], equipmentStatus: 'ready', equipmentError: null });
    });

    it('assignEquipmentQrCode envia version e atualiza a lista', async () => {
      const updated: Equipment = { ...loaded, qrCode: 'QR-2', version: 4 };
      mocked(equipmentApi.assignEquipmentQrCode).mockResolvedValue(updated);

      const result = await useAppStore.getState().assignEquipmentQrCode('eq-1', 'QR-2');

      expect(result).toEqual({ ok: true });
      expect(equipmentApi.assignEquipmentQrCode).toHaveBeenCalledWith('eq-1', 'QR-2', 3);
      expect(useAppStore.getState().equipment).toEqual([updated]);
    });

    it('VERSION_CONFLICT no QR recarrega a lista sem piscar loading', async () => {
      const fresh: Equipment = { ...loaded, qrCode: 'QR-outro', version: 5 };
      mocked(equipmentApi.assignEquipmentQrCode).mockRejectedValue(
        new ApiError('Este registro foi alterado por outra pessoa.', 409, undefined, 'VERSION_CONFLICT')
      );
      mocked(equipmentApi.listEquipment).mockResolvedValue([fresh]);
      const statuses: string[] = [];
      const unsubscribe = useAppStore.subscribe((s) => statuses.push(s.equipmentStatus));

      const result = await useAppStore.getState().assignEquipmentQrCode('eq-1', 'QR-2');
      unsubscribe();

      expect(result).toEqual({
        ok: false,
        error: 'Este registro foi alterado por outra pessoa.',
        code: 'VERSION_CONFLICT',
      });
      expect(useAppStore.getState().equipment).toEqual([fresh]);
      expect(statuses).not.toContain('loading');
    });

    it('setEquipmentActive envia version', async () => {
      const updated: Equipment = { ...loaded, ativo: false, version: 4 };
      mocked(equipmentApi.setEquipmentActive).mockResolvedValue(updated);

      const result = await useAppStore.getState().setEquipmentActive('eq-1', false);

      expect(result).toEqual({ ok: true });
      expect(equipmentApi.setEquipmentActive).toHaveBeenCalledWith('eq-1', false, 3);
    });
  });

  describe('loadEquipment', () => {
    it('carrega a lista da API e marca como pronta', async () => {
      const list: Equipment[] = [
        { id: 'eq-1', localId: SITE_ID, nome: 'A', qrCode: 'Q', ativo: true, version: 0 },
      ];
      mocked(equipmentApi.listEquipment).mockResolvedValue(list);
      useAppStore.setState({ equipmentStatus: 'idle' });

      const promise = useAppStore.getState().loadEquipment();
      expect(useAppStore.getState().equipmentStatus).toBe('loading');
      await promise;

      expect(useAppStore.getState().equipment).toEqual(list);
      expect(useAppStore.getState().equipmentStatus).toBe('ready');
    });
  });
});
