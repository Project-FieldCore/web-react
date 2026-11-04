import type { Equipment } from '@/types';

/** Regras do seletor encadeado de agendamento (RN-014). */
export function activeEquipmentForLocation(equipment: Equipment[], locationId: string): Equipment[] {
  return equipment.filter((item) => item.localId === locationId && item.ativo);
}

/** Não permite equipamento de outro local ou inativo no agendamento. */
export function isEquipmentCompatible(
  equipment: Equipment[],
  locationId: string,
  equipmentId: string
): boolean {
  return activeEquipmentForLocation(equipment, locationId).some((item) => item.id === equipmentId);
}
