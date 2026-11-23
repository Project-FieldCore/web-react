import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveBlobAsFile } from './file-download';

describe('saveBlobAsFile', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('cria o link com o nome, clica e revoga a URL temporária', () => {
    const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    const append = vi.fn();
    vi.stubGlobal('document', { createElement: vi.fn(() => link), body: { appendChild: append } });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL });

    saveBlobAsFile(new Blob(['a,b']), 'users.csv');

    expect(link.href).toBe('blob:fake');
    expect(link.download).toBe('users.csv');
    expect(append).toHaveBeenCalledWith(link);
    expect(link.click).toHaveBeenCalledOnce();
    expect(link.remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  it('revoga a URL mesmo se o clique falhar', () => {
    const link = { href: '', download: '', click: vi.fn(() => { throw new Error('bloqueado'); }), remove: vi.fn() };
    vi.stubGlobal('document', { createElement: vi.fn(() => link), body: { appendChild: vi.fn() } });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL });

    expect(() => saveBlobAsFile(new Blob(['x']), 'a.csv')).toThrow('bloqueado');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });
});
