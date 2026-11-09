import { describe, expect, it } from 'vitest';
import { getAqiLevel, isAtLeast } from '../domain/aqi';
import { formatMeasure, getFreshness } from '../domain/format';
import { exceedanceRatio, findReferenceThreshold } from '../domain/thresholds';
import { hasPermission } from '../auth/permissions';

describe('getAqiLevel', () => {
  it.each([
    [0, 'good'],
    [50, 'good'],
    [51, 'moderate'],
    [100, 'moderate'],
    [101, 'unhealthy_sensitive'],
    [150.4, 'unhealthy_sensitive'],
    [200, 'unhealthy'],
    [300, 'very_unhealthy'],
    [301, 'hazardous'],
    [900, 'hazardous'],
  ])('classe %s en %s', (aqi, level) => {
    expect(getAqiLevel(aqi)?.id).toBe(level);
  });

  it('retourne null pour une valeur absente ou invalide', () => {
    expect(getAqiLevel(null)).toBeNull();
    expect(getAqiLevel(Number.NaN)).toBeNull();
    expect(getAqiLevel(-3)).toBeNull();
  });

  it('compare les niveaux', () => {
    expect(isAtLeast('unhealthy', 'unhealthy_sensitive')).toBe(true);
    expect(isAtLeast('good', 'moderate')).toBe(false);
  });
});

describe('fraîcheur et formatage', () => {
  const now = new Date('2026-11-02T12:00:00Z');
  it('distingue fraîche, en retard, ancienne', () => {
    expect(getFreshness('2026-11-02T11:50:00Z', now)).toBe('fresh');
    expect(getFreshness('2026-11-02T11:00:00Z', now)).toBe('stale');
    expect(getFreshness('2026-11-02T08:00:00Z', now)).toBe('outdated');
    expect(getFreshness(null, now)).toBe('unknown');
  });

  it("n'affiche jamais 0 pour une valeur manquante", () => {
    expect(formatMeasure(null)).toBe('N/D');
    expect(formatMeasure(0)).toBe('0');
  });
});

describe('seuils', () => {
  it('trouve la valeur guide OMS 24 h des PM2.5', () => {
    expect(findReferenceThreshold('pm25')?.value).toBe(15);
    expect(findReferenceThreshold('pm25', 'NS_05_062')?.value).toBe(25);
  });
  it('calcule le ratio de dépassement', () => {
    expect(exceedanceRatio(30, 15)).toBe(2);
    expect(exceedanceRatio(null, 15)).toBeNull();
  });
});

describe('permissions', () => {
  it("n'ouvre pas l'admin aux citoyens", () => {
    expect(hasPermission({ role: 'citizen' }, 'admin:access')).toBe(false);
    expect(hasPermission({ role: 'authority' }, 'alerts:manage')).toBe(true);
    expect(hasPermission({ role: 'authority' }, 'users:manage')).toBe(false);
    expect(hasPermission({ role: 'admin' }, 'users:manage')).toBe(true);
  });
  it('privilégie la liste renvoyée par le serveur', () => {
    expect(hasPermission({ role: 'admin', permissions: ['admin:access'] }, 'users:manage')).toBe(false);
  });
  it('refuse un sujet absent', () => {
    expect(hasPermission(null, 'profile:manage')).toBe(false);
  });
});
