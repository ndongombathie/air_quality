import { describe, expect, it, vi } from 'vitest';
import { downloadFile, isDownloadableUrl, safeFileName } from '../shared/lib/download';
import { safeMediaUrl } from '../shared/lib/labels';

describe('downloadFile', () => {
  it('accepte https, blob et data ; refuse le reste', () => {
    expect(isDownloadableUrl('https://api.senair.sn/f.pdf')).toBe(true);
    expect(isDownloadableUrl('blob:http://localhost/abc')).toBe(true);
    expect(isDownloadableUrl('data:text/csv;base64,YQ==')).toBe(true);
    expect(isDownloadableUrl('javascript:alert(1)')).toBe(false);
    expect(isDownloadableUrl('http://example.com/f.pdf')).toBe(false);
    expect(isDownloadableUrl('http://localhost:8000/api/v1/downloads/x', 'http://localhost:8000')).toBe(true);
    expect(isDownloadableUrl('http://localhost:9000/f.pdf', 'http://localhost:8000')).toBe(false);
    expect(isDownloadableUrl('about:blank')).toBe(false);
    expect(isDownloadableUrl(null)).toBe(false);
  });

  it('clique un lien <a download> temporaire', () => {
    const click = vi.fn();
    const link = { href: '', download: '', rel: '', style: { display: '' }, click, remove: vi.fn() };
    const doc = { createElement: vi.fn(() => link), body: { appendChild: vi.fn() } } as unknown as Document;
    expect(downloadFile('blob:http://localhost/x', 'rapport/../hebdo.pdf', doc)).toBe(true);
    expect(click).toHaveBeenCalledOnce();
    expect(link.download).toBe('rapport_.._hebdo.pdf');
    expect(link.remove).toHaveBeenCalledOnce();
    expect(downloadFile('javascript:alert(1)', 'x', doc)).toBe(false);
  });

  it('nettoie les noms de fichier', () => {
    expect(safeFileName('../../etc/passwd')).toBe('_.._etc_passwd');
    expect(safeFileName('   ')).toBe('telechargement');
  });
});

describe('safeMediaUrl', () => {
  it("n'accepte que https et blob", () => {
    expect(safeMediaUrl('https://cdn.senair.sn/a.jpg')).toBe('https://cdn.senair.sn/a.jpg');
    expect(safeMediaUrl('blob:http://localhost:4173/uuid')).toBe('blob:http://localhost:4173/uuid');
    expect(safeMediaUrl('data:image/png;base64,AA')).toBeNull();
    expect(safeMediaUrl('http://x/a.jpg')).toBeNull();
    expect(safeMediaUrl('javascript:alert(1)')).toBeNull();
  });
});
