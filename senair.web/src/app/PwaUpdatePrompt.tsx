import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToast } from '../shared/ui/Toast';

/** Service worker en mode « prompt » : la mise à jour n'est appliquée qu'avec l'accord de l'utilisateur. */
export function PwaUpdatePrompt() {
  const { notify } = useToast();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!needRefresh) return;
    notify('Nouvelle version disponible.', 'info', {
      persistent: true,
      action: { label: 'Mettre à jour', onClick: () => void updateServiceWorker(true) },
    });
    setNeedRefresh(false);
  }, [needRefresh, notify, setNeedRefresh, updateServiceWorker]);

  useEffect(() => {
    if (!offlineReady) return;
    notify("L'application est disponible hors-ligne.", 'success');
    setOfflineReady(false);
  }, [offlineReady, notify, setOfflineReady]);

  return null;
}
