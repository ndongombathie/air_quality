import { describe, expect, it } from 'vitest';
import { createMockApi } from '../mock/api';
import { MOCK_OTP, MOCK_PASSWORD } from '../mock/fixtures';
import type { Session } from '../api/types';

function setup() {
  let token: string | null = null;
  const api = createMockApi({ latencyMs: 0, getAccessToken: () => token });
  return { api, setToken: (t: string | null) => (token = t) };
}

describe('mock API', () => {
  it('marque toutes les données comme simulées', async () => {
    const { api } = setup();
    expect(api.isMock).toBe(true);
    const summary = await api.airQuality.summary();
    expect(summary.status).toBe('mock');
    expect(summary.stationsTotal).toBe(9);
  });

  it('produit des valeurs stables pour une même heure', async () => {
    const { api } = setup();
    const a = await api.stations.latest('168373');
    const b = await api.stations.latest('168373');
    expect(a.aqi).toBe(b.aqi);
    expect(a.aqi).not.toBeNull();
  });

  it('renvoie les 6 horizons de prévision', async () => {
    const { api } = setup();
    const set = await api.forecasts.get();
    expect(set.forecasts.map((f) => f.horizon)).toEqual(['1h', '2h', '3h', '1d', '2d', '3d']);
  });

  it("n'expose pas les notes d'incident publiquement", async () => {
    const { api } = setup();
    const page = await api.alerts.list();
    for (const alert of page.items) expect(alert).not.toHaveProperty('incidentNote');
  });

  it('refuse les routes admin sans session puis à un citoyen', async () => {
    const { api, setToken } = setup();
    await expect(api.admin.dashboard()).rejects.toMatchObject({ kind: 'unauthorized' });
    const session = (await api.auth.login({ email: 'citoyen@senair.sn', password: MOCK_PASSWORD })) as Session;
    setToken(session.accessToken);
    await expect(api.admin.dashboard()).rejects.toMatchObject({ kind: 'forbidden' });
  });

  it('exige le second facteur pour un administrateur', async () => {
    const { api, setToken } = setup();
    const challenge = await api.auth.login({ email: 'admin@senair.sn', password: MOCK_PASSWORD });
    expect(challenge).toMatchObject({ mfaRequired: true });
    if (!('challengeId' in challenge)) throw new Error('challenge attendu');
    const session = await api.auth.verifyMfa({ challengeId: challenge.challengeId, otp: MOCK_OTP });
    setToken(session.accessToken);
    const dashboard = await api.admin.dashboard();
    expect(dashboard.stations.total).toBe(9);
  });

  it("journalise les actions d'administration", async () => {
    const { api, setToken } = setup();
    const session = (await api.auth.login({ email: 'admin@senair.sn', password: MOCK_PASSWORD, otp: MOCK_OTP })) as Session;
    setToken(session.accessToken);
    const [threshold] = await api.admin.thresholds();
    await api.admin.updateThreshold(threshold!.id, { value: 20 });
    const audit = await api.admin.auditLogs();
    expect(audit.items[0]).toMatchObject({ action: 'threshold.update', actorEmail: 'admin@senair.sn' });
  });

  it("n'autorise pas une autorité à gérer les utilisateurs", async () => {
    const { api, setToken } = setup();
    const session = (await api.auth.login({ email: 'autorite@senair.sn', password: MOCK_PASSWORD, otp: MOCK_OTP })) as Session;
    setToken(session.accessToken);
    await expect(api.admin.users()).rejects.toMatchObject({ kind: 'forbidden' });
    await expect(api.admin.alerts()).resolves.toBeDefined();
  });
});

describe('historique ville', () => {
  it("agrège l'IQA ville comme le maximum des stations", async () => {
    const { api } = setup();
    const to = new Date();
    const from = new Date(to.getTime() - 6 * 3_600_000);
    const city = await api.airQuality.cityHistory({ from: from.toISOString(), to: to.toISOString() });
    const station = await api.stations.history('168373', { from: from.toISOString(), to: to.toISOString() });
    expect(city.scope).toBe('city');
    expect(city.points.length).toBe(station.points.length);
    city.points.forEach((p, i) => expect(p.aqi).toBeGreaterThanOrEqual(station.points[i]?.aqi ?? 0));
  });
});

describe('alertes comme notifications', () => {
  it("lit, retire et marque tout comme lu, sans toucher à l'alerte publique", async () => {
    const { api, setToken } = setup();
    const session = (await api.auth.login({ email: 'citoyen@senair.sn', password: MOCK_PASSWORD })) as Session;
    setToken(session.accessToken);
    await api.account.updateNotificationPreferences({ ...(await api.account.notificationPreferences()), zoneIds: [], minLevel: 'moderate' });
    const mine = (await api.account.myAlerts()).items;
    expect(mine.length).toBeGreaterThan(1);
    expect(mine.every((a) => a.read === false)).toBe(true);
    const [first, second] = mine;
    await api.account.markAlertRead(first!.id);
    expect((await api.account.myAlerts({ unread: true })).items.some((a) => a.id === first!.id)).toBe(false);
    await api.account.dismissAlert(second!.id);
    expect((await api.account.myAlerts()).items.some((a) => a.id === second!.id)).toBe(false);
    await expect(api.alerts.get(second!.id)).resolves.toMatchObject({ id: second!.id });
    await api.account.markAllAlertsRead();
    expect((await api.account.myAlerts({ unread: true })).total).toBe(0);
  });

  it("permet à l'autorité de publier puis supprimer une alerte", async () => {
    const { api, setToken } = setup();
    const session = (await api.auth.login({ email: 'autorite@senair.sn', password: MOCK_PASSWORD, otp: MOCK_OTP })) as Session;
    setToken(session.accessToken);
    const alert = await api.admin.createAlert({
      zoneId: 'centre-ville',
      severity: 'unhealthy',
      pollutant: 'pm10',
      title: 'Épisode de poussières',
      message: "L'harmattan arrive demain matin.",
    });
    expect(alert).toMatchObject({ origin: 'manual', status: 'active', zoneName: 'Centre-ville' });
    expect((await api.alerts.list()).items[0]?.id).toBe(alert.id);
    await api.admin.deleteAlert(alert.id);
    await expect(api.alerts.get(alert.id)).rejects.toMatchObject({ kind: 'not_found' });
    await expect(api.admin.createAlert({ zoneId: 'nulle-part', severity: 'unhealthy', pollutant: 'pm10', title: 'x', message: 'y' })).rejects.toMatchObject({
      status: 422,
    });
  });
});
