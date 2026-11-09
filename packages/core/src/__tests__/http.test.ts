import { describe, expect, it, vi } from 'vitest';
import { buildQueryString, createHttpClient } from '../api/http';
import { ApiError } from '../api/errors';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('buildQueryString', () => {
  it('ignore les valeurs vides et joint les tableaux', () => {
    expect(buildQueryString({ a: 1, b: undefined, c: '', d: ['x', 'y'], e: [] })).toBe('?a=1&d=x%2Cy');
    expect(buildQueryString({})).toBe('');
  });
});

describe('createHttpClient', () => {
  it('ajoute le jeton Bearer et parse le JSON', async () => {
    const fetchImpl = vi.fn(async () => json(200, { ok: true }));
    const http = createHttpClient({ baseUrl: 'https://api.test/api/v1/', getAccessToken: () => 'tkn', fetchImpl });
    await expect(http.get('/stations', { query: { zoneId: 'z1' } })).resolves.toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.test/api/v1/stations?zoneId=z1');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tkn');
  });

  it("n'envoie pas de jeton sur une route anonyme", async () => {
    const fetchImpl = vi.fn(async () => json(200, {}));
    const http = createHttpClient({ baseUrl: 'https://api.test', getAccessToken: () => 'tkn', fetchImpl });
    await http.post('/auth/login', { email: 'a' }, { anonymous: true });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('normalise les erreurs sans exposer le message serveur', async () => {
    const fetchImpl = vi.fn(async () => json(422, { code: 'invalid', message: 'SQL detail', requestId: 'r1', details: { fields: { email: 'x' } } }));
    const http = createHttpClient({ baseUrl: 'https://api.test', fetchImpl });
    const error = (await http.get('/x').catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe('validation');
    expect(error.requestId).toBe('r1');
    expect(error.fieldErrors).toEqual({ email: 'x' });
    expect(error.message).not.toContain('SQL');
  });

  it('rafraîchit la session une fois sur 401 puis rejoue', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(200, { me: 1 }));
    const refreshSession = vi.fn(async () => true);
    const http = createHttpClient({ baseUrl: 'https://api.test', fetchImpl, refreshSession });
    await expect(http.get('/me')).resolves.toEqual({ me: 1 });
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it('signale une erreur réseau', async () => {
    const http = createHttpClient({ baseUrl: 'https://api.test', fetchImpl: async () => Promise.reject(new TypeError('offline')) });
    await expect(http.get('/x')).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('messages par code métier', () => {
  it('affiche un message précis pour des identifiants invalides', async () => {
    const fetchImpl = vi.fn(async () => json(401, { code: 'invalid_credentials', message: 'x' }));
    const http = createHttpClient({ baseUrl: 'https://api.test', fetchImpl });
    const error = (await http.post('/auth/login', {}, { anonymous: true }).catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe('unauthorized');
    expect(error.code).toBe('invalid_credentials');
    expect(error.userMessage).toBe('E-mail ou mot de passe incorrect.');
  });
});
