import { describe, expect, it } from 'vitest';
import { safeExternalUrl, safeMediaUrl } from '../shared/lib/labels';
import { historyWindow } from '../shared/lib/time';
import { validateStation } from '../features/admin/components/StationForm';

describe('URL sûres', () => {
  it('refuse les schémas dangereux', () => {
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('data:text/html,x')).toBeNull();
    expect(safeExternalUrl('https://who.int/')).toBe('https://who.int/');
  });

  it("n'accepte que HTTPS ou blob pour les médias", () => {
    expect(safeMediaUrl('http://example.com/a.png')).toBeNull();
    expect(safeMediaUrl('https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(safeMediaUrl(null)).toBeNull();
  });
});

describe('historyWindow', () => {
  it("reste stable au sein d'une même heure (clé de requête stable)", () => {
    const a = historyWindow('24h', new Date('2026-11-02T10:05:00Z'));
    const b = historyWindow('24h', new Date('2026-11-02T10:55:00Z'));
    expect(a).toEqual(b);
    expect(a).toEqual({ from: '2026-11-01T11:00:00.000Z', to: '2026-11-02T11:00:00.000Z', granularity: 'hour' });
    expect(historyWindow('7d', new Date('2026-11-02T10:05:00Z')).granularity).toBe('day');
  });
});

describe('validateStation', () => {
  const base = {
    name: 'Lycée Malick Sy',
    shortName: 'Malick Sy',
    zoneId: 'malick-sy',
    latitude: '14,78',
    longitude: '-16.93',
    type: 'residential' as const,
    status: 'online' as const,
    externalId: '',
    provider: 'AirGradient',
  };

  it('convertit les coordonnées et normalise externalId', () => {
    const { data } = validateStation(base);
    expect(data?.location).toEqual({ latitude: 14.78, longitude: -16.93 });
    expect(data?.externalId).toBeNull();
  });

  it('signale les champs invalides', () => {
    const { data, errors } = validateStation({ ...base, latitude: '', zoneId: '', name: 'A' });
    expect(data).toBeNull();
    expect(Object.keys(errors).sort()).toEqual(['latitude', 'name', 'zoneId']);
  });
});
