import { http } from './http';
import { toRevision, type ApiResponseHistoryEntry } from './answer-history-rules';
import type { AnswerRevision } from '@/types';

/**
 * Histórico imutável de respostas (somente ADMIN/SUPERVISOR) —
 * `GET /inspections/{id}/response-history`, ordem cronológica.
 */
export async function fetchResponseHistory(inspectionId: string): Promise<AnswerRevision[]> {
  const entries = await http.get<ApiResponseHistoryEntry[]>(`/inspections/${inspectionId}/response-history`);
  return entries.map((entry) => toRevision(inspectionId, entry));
}
