import type { SenairApi } from './contracts';
import { createHttpClient, type HttpClientConfig } from './http';
import { createRestApi } from './rest';
import { createMockApi } from '../mock/api';

export type ApiMode = 'rest' | 'mock';

export interface SenairApiConfig extends HttpClientConfig {
  mode: ApiMode;
  mockLatencyMs?: number;
}

/**
 * Point d'entrée unique : chaque app choisit le mode via sa configuration d'environnement
 * (`VITE_API_MODE` / `EXPO_PUBLIC_API_MODE`) sans que les écrans le sachent.
 */
export function createSenairApi(config: SenairApiConfig): SenairApi {
  if (config.mode === 'mock') {
    return createMockApi({ latencyMs: config.mockLatencyMs, getAccessToken: config.getAccessToken });
  }
  return createRestApi(createHttpClient(config));
}
