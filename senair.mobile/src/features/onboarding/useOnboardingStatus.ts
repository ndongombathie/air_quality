import { useEffect, useSyncExternalStore } from 'react';
import { hasSeenOnboarding, markOnboardingSeen } from '@/services/preferences';

type Status = 'checking' | 'todo' | 'done';

// Petit état partagé (lu une seule fois au démarrage) entre le garde des onglets et l'écran d'accueil.
let status: Status = 'checking';
let started = false;
const listeners = new Set<() => void>();
const set = (next: Status) => {
  status = next;
  listeners.forEach((l) => l());
};

export function useOnboardingStatus(): Status {
  const current = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
    () => status,
  );
  useEffect(() => {
    if (started) return;
    started = true;
    void hasSeenOnboarding().then((seen) => set(seen ? 'done' : 'todo'));
  }, []);
  return current;
}

export async function completeOnboarding(): Promise<void> {
  set('done');
  await markOnboardingSeen();
}
