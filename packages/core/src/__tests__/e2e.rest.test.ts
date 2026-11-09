/// <reference types="node" />
/**
 * Bout en bout : le client REST du front (createSenairApi, mode rest) contre une vraie API SEN-AIR.
 * Ignoré par défaut. Lancement (API démarrée, comptes de démo créés) :
 *   SENAIR_API_URL=http://127.0.0.1:8000/api/v1 SENAIR_ADMIN_TOTP_SECRET=<secret> npx vitest run e2e
 */
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createSenairApi, isMfaChallenge, type Session } from '../index';

const BASE_URL = process.env.SENAIR_API_URL;
const ADMIN_SECRET = process.env.SENAIR_ADMIN_TOTP_SECRET;
const PASSWORD = process.env.SENAIR_DEMO_PASSWORD ?? 'Demo2026!';

/** Code TOTP (RFC 6238, SHA-1, 30 s, 6 chiffres). */
function totp(secret: string, at = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of secret.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const hmac = createHmac('sha1', key).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

function client() {
  let token: string | null = null;
  const api = createSenairApi({ mode: 'rest', baseUrl: BASE_URL!, clientName: 'senair-mobile', getAccessToken: () => token });
  return { api, use: (session: Session) => (token = session.accessToken) };
}

/** PNG 1×1 valide. */
const PNG = Uint8Array.from(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
);

describe.skipIf(!BASE_URL)('bout en bout : client REST du front contre l’API', () => {
  it('sert la consultation publique', async () => {
    const { api } = client();
    const meta = await api.reference.metadata();
    const stations = await api.stations.list({ includeLatest: true });
    expect(stations.length).toBeGreaterThanOrEqual(9);
    const to = meta.dataUpdatedAt ?? new Date().toISOString();
    const from = new Date(Date.parse(to) - 24 * 3_600_000).toISOString();
    const history = await api.stations.history(stations[0]!.id, { from, to, granularity: 'hour' });
    expect(history.points.length).toBeGreaterThan(0);
    expect((await api.airQuality.cityHistory({ from, to })).scope).toBe('city');
    const summary = await api.airQuality.summary();
    expect(summary.stationsTotal).toBeGreaterThanOrEqual(9);
    const here = await api.airQuality.atLocation({ latitude: 14.79, longitude: -16.93 });
    expect(here.status).toBe('estimated');
    expect((await api.airQuality.heatmap({ layer: 'aqi' })).cells.length).toBeGreaterThan(0);
    await expect(api.forecasts.get()).rejects.toMatchObject({ code: 'forecast_unavailable' });
    expect((await api.reference.thresholds()).length).toBeGreaterThan(0);
    expect((await api.reference.healthGuidance({ profile: 'asthma', level: 'unhealthy' }))[0]?.disclaimer).toBeTruthy();
    const articles = await api.articles.list();
    expect(articles.items.length).toBeGreaterThan(0);
    expect((await api.articles.getBySlug(articles.items[0]!.slug)).content).toBeTruthy();
    await api.alerts.list({ status: ['active', 'resolved'] });
  });

  it('gère le compte citoyen (mobile) et la rotation du refresh token', async () => {
    const { api, use } = client();
    await expect(api.auth.login({ email: 'citoyen@senair.sn', password: 'mauvais-mot-de-passe' })).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
    const outcome = await api.auth.login({ email: 'citoyen@senair.sn', password: PASSWORD });
    if (isMfaChallenge(outcome)) throw new Error('pas de MFA attendue pour un citoyen');
    expect(outcome.refreshToken).toBeTruthy();
    use(outcome);
    expect((await api.account.me()).permissions).toContain('notifications:manage');
    const prefs = await api.account.notificationPreferences();
    await api.account.updateNotificationPreferences({ ...prefs, minLevel: 'unhealthy' });
    await api.account.registerDevice({ token: 'ExponentPushToken[e2e-test]', platform: 'android' });
    await api.account.myAlerts();
    const rotated = await api.auth.refresh(outcome.refreshToken);
    use(rotated);
    // Réutiliser l'ancien refresh token révoque toutes les sessions.
    await expect(api.auth.refresh(outcome.refreshToken)).rejects.toMatchObject({ kind: 'unauthorized' });
    await expect(api.auth.refresh(rotated.refreshToken)).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it.skipIf(!ADMIN_SECRET)('pilote le back-office avec MFA, médias, rapports et exports', async () => {
    const { api, use } = client();
    const challenge = await api.auth.login({ email: 'admin@senair.sn', password: PASSWORD });
    if (!isMfaChallenge(challenge)) throw new Error('MFA attendue pour un administrateur');
    await expect(api.auth.verifyMfa({ challengeId: challenge.challengeId, otp: '000000' })).rejects.toMatchObject({ code: 'invalid_otp' });
    use(await api.auth.verifyMfa({ challengeId: challenge.challengeId, otp: totp(ADMIN_SECRET!) }));

    expect((await api.admin.dashboard()).stations.total).toBeGreaterThanOrEqual(9);
    const [threshold] = await api.admin.thresholds();
    await api.admin.updateThreshold(threshold!.id, { value: threshold!.value + 1 });
    await api.admin.updateThreshold(threshold!.id, { value: threshold!.value });
    expect((await api.admin.auditLogs({ resource: 'threshold' })).items[0]?.action).toBe('threshold.update');

    const media = await api.admin.uploadMedia(new Blob([PNG], { type: 'image/png' }), { fileName: 'pixel.png', alt: 'Pixel de test' });
    expect(media.url).toMatch(/^https?:\/\//);
    const article = await api.admin.createArticle({
      title: 'Article de test bout en bout',
      excerpt: 'Vérification du parcours complet.',
      content: 'Contenu suffisamment long pour être valide.',
      category: 'info',
      status: 'draft',
      featured: false,
      coverImageUrl: null,
      mediaIds: [media.id],
      tags: [],
    });
    expect(article.media).toHaveLength(1);
    await api.admin.deleteArticle(article.id);

    const to = new Date().toISOString();
    const from = new Date(Date.now() - 180 * 86_400_000).toISOString();
    const report = await api.admin.requestReport({ period: 'custom', from, to, format: 'pdf' });
    expect(report.status).toBe('ready');
    const pdf = await fetch(report.downloadUrl!);
    expect(pdf.headers.get('content-disposition')).toContain('attachment');
    expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString()).toBe('%PDF');
    const link = await api.admin.exportData({ dataset: 'readings', format: 'csv', from, to });
    expect((await (await fetch(link.downloadUrl)).text()).split('\r\n')[0]).toContain('location_id');

    expect((await api.admin.models()).some((m) => m.task === 'interpolation')).toBe(true);
    expect((await api.admin.users()).items.length).toBeGreaterThanOrEqual(3);
    await api.admin.usage({ from, to });
    await api.auth.logout();
  });
});
