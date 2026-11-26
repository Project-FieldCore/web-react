import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REPORT_NOT_APPROVED_MESSAGE,
  describeReportError,
  downloadInspectionReport,
  fetchInspectionReport,
  reportFileName,
  saveBlobAsFile,
} from './inspection-report-api';
import { ApiError, NetworkError } from './http';
import { setAuthToken } from './auth-token';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function pdfResponse(): Response {
  return new Response(new Blob(['%PDF-1.7 teste'], { type: 'application/pdf' }), {
    status: 200,
    headers: { 'Content-Type': 'application/pdf' },
  });
}

describe('inspection-report-api', () => {
  const originalFetch = global.fetch;

  beforeEach(() => setAuthToken('token-teste'));
  afterEach(() => {
    global.fetch = originalFetch;
    setAuthToken(null);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('nome do arquivo segue o da API (inspection-{id}.pdf)', () => {
    expect(reportFileName('abc-123')).toBe('inspection-abc-123.pdf');
  });

  it('GET /inspections/{id}/report.pdf com token e devolve o PDF', async () => {
    const fetchMock = vi.fn().mockResolvedValue(pdfResponse());
    global.fetch = fetchMock;

    const blob = await fetchInspectionReport('insp-1');

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/inspections\/insp-1\/report\.pdf$/);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token-teste');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('saveBlobAsFile cria o link com o nome, clica e revoga a URL temporária', () => {
    const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    const append = vi.fn();
    vi.stubGlobal('document', { createElement: vi.fn(() => link), body: { appendChild: append } });
    const createObjectURL = vi.fn(() => 'blob:fake-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    saveBlobAsFile(new Blob(['x']), 'inspection-1.pdf');

    expect(link.href).toBe('blob:fake-url');
    expect(link.download).toBe('inspection-1.pdf');
    expect(append).toHaveBeenCalledWith(link);
    expect(link.click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });

  it('downloadInspectionReport baixa e salva com o nome esperado', async () => {
    global.fetch = vi.fn().mockResolvedValue(pdfResponse());
    const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('document', { createElement: vi.fn(() => link), body: { appendChild: vi.fn() } });
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });

    await expect(downloadInspectionReport('insp-9')).resolves.toBe('inspection-insp-9.pdf');
    expect(link.download).toBe('inspection-insp-9.pdf');
    expect(link.click).toHaveBeenCalledOnce();
  });

  it('409 (inspeção não aprovada) mostra mensagem própria, sem retry', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(409, { status: 409, code: 'INSPECTION_NOT_APPROVED', message: 'Inspection is not approved', path: '/p' })
    );
    const error = await fetchInspectionReport('insp-1').catch((e: unknown) => e);

    expect(error).toMatchObject({ name: 'ApiError', status: 409 });
    expect(describeReportError(error)).toMatchObject({ message: REPORT_NOT_APPROVED_MESSAGE, retry: false, status: 409 });
  });

  it('403 (perfil sem acesso) não oferece nova tentativa', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(403, { status: 403, code: 'ACCESS_DENIED', message: 'Forbidden', path: '/p' }));
    const error = await fetchInspectionReport('insp-1').catch((e: unknown) => e);
    expect(describeReportError(error)).toMatchObject({ status: 403, retry: false });
  });

  it('404 e 500 seguem o padrão de erro de carga; 500 permite retry', async () => {
    expect(describeReportError(new ApiError('Not found', 404, undefined, 'NOT_FOUND')).retry).toBe(false);
    expect(describeReportError(new ApiError('boom', 500, undefined, 'INTERNAL_ERROR')).retry).toBe(true);
  });

  it('falha de rede permite nova tentativa', () => {
    expect(describeReportError(new NetworkError())).toMatchObject({ retry: true });
  });
});
