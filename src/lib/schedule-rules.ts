import type { Inspection, InspectionModel, Priority } from '@/types';

/**
 * Regras do agendamento de inspeção (PBI-0025.1) — RN-024/025/027 e o que a
 * API exige (data futura, orientações até 2000 caracteres). Lógica pura, sem
 * React, para ser testável.
 */

export const MAX_INSTRUCTIONS = 2000;

export interface ScheduleFormValues {
  modeloId: string;
  clienteId: string;
  localId: string;
  tecnicoId: string;
  /** Data e hora previstas: `datetime-local` ou ISO. Vazio = não preenchida. */
  dataPrevista: string;
  orientacoes?: string;
}

/** RN-025: o que falta preencher, na ordem da tela. */
export function missingScheduleFields(values: ScheduleFormValues): string[] {
  const missing: string[] = [];
  if (!values.modeloId) missing.push('Modelo');
  if (!values.clienteId) missing.push('Cliente');
  if (!values.localId) missing.push('Local');
  if (!values.tecnicoId) missing.push('Técnico');
  if (!values.dataPrevista) missing.push('Data prevista');
  return missing;
}

/** A API recusa data que não seja futura (`@Future`). Vazio não é erro aqui: "falta" é outro aviso. */
export function validateScheduleDate(dataPrevista: string, now: Date = new Date()): string | null {
  if (!dataPrevista) return null;
  const date = new Date(dataPrevista);
  if (Number.isNaN(date.getTime())) return 'Informe uma data e hora válidas.';
  if (date.getTime() <= now.getTime()) return 'A data prevista precisa estar no futuro.';
  return null;
}

export function validateInstructions(text: string | undefined): string | null {
  if (text && text.trim().length > MAX_INSTRUCTIONS) {
    return `As orientações devem ter no máximo ${MAX_INSTRUCTIONS} caracteres.`;
  }
  return null;
}

/** Primeiro problema que impede agendar (campos obrigatórios, data, orientações), ou null. */
export function validateSchedule(values: ScheduleFormValues, now: Date = new Date()): string | null {
  if (!values.clienteId || !values.localId || !values.dataPrevista) {
    return 'Cliente, local e data prevista são obrigatórios (RN-025).';
  }
  return validateScheduleDate(values.dataPrevista, now) ?? validateInstructions(values.orientacoes);
}

/** Modelo sem id de versão na API só pode ser agendado na tela (nada é enviado). */
export function isLocalOnlySchedule(model: Pick<InspectionModel, 'templateVersionId'> | undefined): boolean {
  return !model?.templateVersionId;
}

/** Inspeção criada só na tela: já nasce ATRIBUÍDA, como a da API, com o checklist vazio. */
export function buildLocalInspection(
  input: {
    modeloId: string;
    clienteId: string;
    localId: string;
    equipamentoId?: string;
    tecnicoId: string;
    prioridade: Priority;
    dataPrevista: string;
    orientacoes?: string;
  },
  model: Pick<InspectionModel, 'version'>,
  id: string
): Inspection {
  return {
    id,
    clienteId: input.clienteId,
    localId: input.localId,
    equipamentoId: input.equipamentoId,
    modeloId: input.modeloId,
    modeloVersao: model.version,
    tecnicoId: input.tecnicoId,
    prioridade: input.prioridade,
    dataPrevista: input.dataPrevista,
    orientacoes: input.orientacoes?.trim() || undefined,
    status: 'ATRIBUIDA',
    answers: {},
    nonConformities: {},
  };
}
