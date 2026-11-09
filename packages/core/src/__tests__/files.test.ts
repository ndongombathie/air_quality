import { describe, expect, it } from 'vitest';
import { toCsv, toPdf } from '../mock/files';
import { createMockApi } from '../mock/api';
import { MOCK_OTP, MOCK_PASSWORD } from '../mock/fixtures';
import { validateMediaFile } from '../domain/media';
import type { Session } from '../api/types';

const decode = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');

async function adminApi() {
  let token: string | null = null;
  const api = createMockApi({ latencyMs: 0, getAccessToken: () => token });
  const session = (await api.auth.login({ email: 'admin@senair.sn', password: MOCK_PASSWORD, otp: MOCK_OTP })) as Session;
  token = session.accessToken;
  return api;
}

describe('fichiers générés', () => {
  it('échappe le CSV et ajoute le BOM UTF-8', () => {
    const csv = toCsv(['a', 'b'], [['x,y', 'dit "oui"'], [null, 3]]);
    expect(csv.startsWith('﻿a,b\r\n')).toBe(true);
    expect(csv).toContain('"x,y","dit ""oui"""');
    expect(csv).toContain(',3\r\n');
  });

  it('produit un PDF dont la table xref pointe au bon endroit', () => {
    const pdf = decode(toPdf([{ text: 'Qualité de l’air : NO₂', bold: true }, ...Array.from({ length: 80 }, (_, i) => ({ text: `Ligne ${i}` }))]));
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    const startxref = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe('xref');
    expect(pdf).toContain('/Count 2');
    expect(pdf).toContain('NO2');
  });
});

describe('téléchargements du mode démonstration', () => {
  it('fournit deux rapports prêts avec un fichier', async () => {
    const api = await adminApi();
    const reports = await api.admin.reports();
    expect(reports.map((r) => r.id)).toEqual(['rep-1', 'rep-2']);
    for (const report of reports) {
      expect(report.downloadUrl).toBeTruthy();
      expect(report.fileName).toMatch(/^senair-rapport-.+\.(pdf|csv)$/);
    }
  });

  it('génère un rapport et un export réels', async () => {
    const api = await adminApi();
    const to = new Date().toISOString();
    const from = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const report = await api.admin.requestReport({ period: 'custom', from, to, format: 'json' });
    expect(report.status).toBe('ready');
    expect(report.downloadUrl).toBeTruthy();
    const link = await api.admin.exportData({ dataset: 'readings', format: 'csv', from, to });
    expect(link.fileName).toMatch(/^senair-readings-.+\.csv$/);
    expect(link.downloadUrl).toMatch(/^(blob|data):/);
  });
});

describe('médias', () => {
  it('refuse les formats et tailles non autorisés', () => {
    expect(validateMediaFile({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(validateMediaFile({ type: 'application/pdf', size: 1000 })).not.toBeNull();
    expect(validateMediaFile({ type: 'image/png', size: 6 * 1024 * 1024 })).toContain('5 Mo');
  });

  it('associe une photo envoyée à un article', async () => {
    const api = await adminApi();
    const asset = await api.admin.uploadMedia(new Blob(['x'], { type: 'image/png' }), { fileName: 'photo.png', alt: 'Station' });
    const article = await api.admin.createArticle({
      title: 'Article avec photo',
      excerpt: 'Résumé suffisant',
      content: 'Contenu suffisamment long pour être valide.',
      category: 'info',
      status: 'published',
      featured: false,
      coverImageUrl: null,
      mediaIds: [asset.id],
      tags: [],
    });
    expect(article.media).toHaveLength(1);
    expect(article.coverImageUrl).toBe(asset.url);
    await expect(api.admin.uploadMedia(new Blob(['x'], { type: 'text/html' }), { fileName: 'x.html', alt: '' })).rejects.toMatchObject({ kind: 'validation' });
  });
});
