import { createContext, useContext, type ReactNode } from 'react';
import type { SenairApi } from '@senair/core';

const ApiContext = createContext<SenairApi | null>(null);

/** Expose l'instance unique de `SenairApi` : les écrans n'accèdent jamais au transport. */
export function ApiProvider({ api, children }: { api: SenairApi; children: ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): SenairApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi() doit être utilisé sous <ApiProvider>.');
  return api;
}
