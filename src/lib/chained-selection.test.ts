import { describe, expect, it } from 'vitest';
import { activeEquipmentForLocation, isEquipmentCompatible } from './chained-selection';
import type { Equipment } from '@/types';

const equipment: Equipment[] = [
  { id: 'eq-a', localId: 'local-a', nome: 'Compressor', qrCode: 'QR-A', ativo: true },
  { id: 'eq-inactive', localId: 'local-a', nome: 'Bomba antiga', qrCode: 'QR-I', ativo: false },
  { id: 'eq-b', localId: 'local-b', nome: 'Gerador', qrCode: 'QR-B', ativo: true },
];

describe('seleção encadeada de equipamento (RN-014)', () => {
  it('oferece somente equipamentos ativos do local selecionado', () => {
    expect(activeEquipmentForLocation(equipment, 'local-a').map((item) => item.id)).toEqual(['eq-a']);
  });

  it('bloqueia equipamento de outro local ou inativo', () => {
    expect(isEquipmentCompatible(equipment, 'local-a', 'eq-a')).toBe(true);
    expect(isEquipmentCompatible(equipment, 'local-a', 'eq-b')).toBe(false);
    expect(isEquipmentCompatible(equipment, 'local-a', 'eq-inactive')).toBe(false);
  });
});
