import { ApiError, kindFromStatus } from './errors';
import type { ApiErrorBody } from './types';

export type QueryValue = string | number | boolean | null | undefined | readonly (string | number)[];
export type Query = Record<string, QueryValue>;

export interface RequestOptions {
  query?: Query;
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
  /** Désactive l'en-tête Authorization (routes publiques d'auth). */
  anonymous?: boolean;
  headers?: Record<string, string>;
}

export interface HttpClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  /** Envoi multipart (fichiers) : le navigateur fixe lui-même le Content-Type et sa frontière. */
  postForm<T>(path: string, form: FormData, options?: RequestOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  delete<T = void>(path: string, options?: RequestOptions): Promise<T>;
}

export interface HttpClientConfig {
  /** Ex. `https://api.senair.sn/api/v1`. */
  baseUrl: string;
  /** Fournit le jeton d'accès courant (stocké en mémoire côté web, SecureStore côté mobile). */
  getAccessToken?: () => string | null | Promise<string | null>;
  /** Tente un rafraîchissement de session ; retourne `true` si la requête peut être rejouée. */
  refreshSession?: () => Promise<boolean>;
  onUnauthorized?: () => void;
  timeoutMs?: number;
  /** `include` côté web pour envoyer le cookie httpOnly de refresh. */
  credentials?: RequestCredentials;
  fetchImpl?: typeof fetch;
  clientName?: string;
}

export function buildQueryString(query: Query | undefined): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(','));
    } else {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const type = response.headers.get('content-type') ?? '';
  if (type.includes('application/json')) return response.json();
  return response.text();
}

export function createHttpClient(config: HttpClientConfig): HttpClient {
  const fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = config.timeoutMs ?? 15_000;
  const baseUrl = config.baseUrl.replace(/\/+$/, '');

  async function send<T>(method: string, path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const abortFromCaller = () => controller.abort();
    options.signal?.addEventListener('abort', abortFromCaller, { once: true });

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(config.clientName ? { 'X-Client': config.clientName } : {}),
      ...options.headers,
    };
    if (options.body !== undefined && !options.form) headers['Content-Type'] = 'application/json';
    if (!options.anonymous && config.getAccessToken) {
      const token = await config.getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}${buildQueryString(options.query)}`, {
        method,
        headers,
        body: options.form ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
        signal: controller.signal,
        credentials: config.credentials,
      });
    } catch {
      const kind = options.signal?.aborted ? 'unknown' : controller.signal.aborted ? 'timeout' : 'network';
      throw new ApiError(kind);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abortFromCaller);
    }

    if (response.status === 401 && !options.anonymous && !isRetry && config.refreshSession) {
      if (await config.refreshSession()) return send<T>(method, path, options, true);
    }

    const payload = await parseBody(response).catch(() => undefined);
    if (!response.ok) {
      if (response.status === 401) config.onUnauthorized?.();
      const body = payload && typeof payload === 'object' ? (payload as ApiErrorBody) : null;
      throw new ApiError(kindFromStatus(response.status), { status: response.status, body });
    }
    return payload as T;
  }

  return {
    get: (path, options) => send('GET', path, options),
    post: (path, body, options) => send('POST', path, { ...options, body }),
    postForm: (path, form, options) => send('POST', path, { ...options, form }),
    put: (path, body, options) => send('PUT', path, { ...options, body }),
    patch: (path, body, options) => send('PATCH', path, { ...options, body }),
    delete: (path, options) => send('DELETE', path, options),
  };
}
