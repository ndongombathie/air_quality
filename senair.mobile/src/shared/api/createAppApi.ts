import { createSenairApi, type SenairApi } from '@senair/core';
import { ENV } from '@/config/env';
import type { SessionManager } from '@/shared/session/sessionManager';
import { withDemoMedia } from './demoMedia';

/** Seul point de construction du client : le transport (mock/REST) reste invisible des écrans. */
export function createAppApi(session: SessionManager): SenairApi {
  const api = createSenairApi({
    mode: ENV.apiMode,
    baseUrl: ENV.apiBaseUrl,
    clientName: 'senair-mobile',
    getAccessToken: () => session.getAccessToken(),
    refreshSession: () => session.refresh(),
    onUnauthorized: () => {
      void session.purge();
    },
  });
  session.attach({ auth: api.auth, account: api.account });
  return api.isMock && ENV.demoMedia ? withDemoMedia(api) : api;
}
