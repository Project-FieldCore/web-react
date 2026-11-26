import { http, ApiError } from './http';
import { describeLoadError, type LoadErrorCopy } from './state-copy';

/** Nome sugerido do arquivo (o mesmo que a API envia em Content-Disposition). */
export function reportFileName(inspectionId: string): string {
  return `inspection-${inspectionId}.pdf`;
}

/**
 * Relatório PDF básico (`GET /inspections/{id}/report.pdf`, somente ADMIN/SUPERVISOR).
 * A API só entrega o PDF depois da aprovação formal; antes disso responde 409.
 */
export function fetchInspectionReport(inspectionId: string): Promise<Blob> {
  return http.getBlob(`/inspections/${inspectionId}/report.pdf`);
}

/** Dispara o download no navegador a partir de um Blob (link temporário, revogado em seguida). */
export function saveBlobAsFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Baixa o PDF da inspeção aprovada e devolve o nome do arquivo salvo. */
export async function downloadInspectionReport(inspectionId: string): Promise<string> {
  const blob = await fetchInspectionReport(inspectionId);
  const fileName = reportFileName(inspectionId);
  saveBlobAsFile(blob, fileName);
  return fileName;
}

export const REPORT_NOT_APPROVED_MESSAGE = 'O relatório só fica disponível depois que a inspeção for aprovada.';

/** Mensagem de erro do download (ErrorResponse padronizado); 409 = inspeção ainda não aprovada. */
export function describeReportError(error: unknown): LoadErrorCopy {
  if (error instanceof ApiError && error.status === 409) {
    return { title: 'Relatório indisponível', message: REPORT_NOT_APPROVED_MESSAGE, retry: false, status: 409, code: error.code };
  }
  return describeLoadError(error, 'Não foi possível gerar o PDF. Tente novamente.');
}
