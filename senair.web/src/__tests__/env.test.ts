import { describe, expect, it } from 'vitest';
import { EnvError, parseEnv } from '../app/config/env';

describe('parseEnv', () => {
  it('utilise le mode mock par défaut', () => {
    expect(parseEnv({})).toEqual({ apiMode: 'mock', apiBaseUrl: 'http://localhost:8000/api/v1' });
  });

  it('accepte le mode rest avec une URL HTTPS et retire la barre finale', () => {
    expect(parseEnv({ VITE_API_MODE: 'REST', VITE_API_BASE_URL: 'https://api.senair.sn/api/v1/' })).toEqual({
      apiMode: 'rest',
      apiBaseUrl: 'https://api.senair.sn/api/v1',
    });
  });

  it('autorise HTTP uniquement en local', () => {
    expect(parseEnv({ VITE_API_MODE: 'rest', VITE_API_BASE_URL: 'http://localhost:8000/api/v1' }).apiMode).toBe('rest');
    expect(() => parseEnv({ VITE_API_MODE: 'rest', VITE_API_BASE_URL: 'http://api.senair.sn/api/v1' })).toThrow(EnvError);
  });

  it('rejette un mode inconnu ou une URL relative en mode rest', () => {
    expect(() => parseEnv({ VITE_API_MODE: 'graphql' })).toThrow(EnvError);
    expect(() => parseEnv({ VITE_API_MODE: 'rest', VITE_API_BASE_URL: '/api/v1' })).toThrow(EnvError);
  });
});
