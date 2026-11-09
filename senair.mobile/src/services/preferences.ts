/**
 * Préférences locales non sensibles. Stockées dans expo-secure-store faute d'autre stockage
 * installé : ce n'est pas un secret, seulement un drapeau « onboarding déjà vu ».
 */
import * as SecureStore from 'expo-secure-store';

const ONBOARDING_KEY = 'senair.onboardingDone';

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(ONBOARDING_KEY)) === '1';
  } catch {
    // Stockage indisponible (ex. navigateur) : on ne bloque pas l'accès à l'app.
    return true;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await SecureStore.setItemAsync(ONBOARDING_KEY, '1');
  } catch {
    // Sans stockage, l'onboarding pourra simplement réapparaître au prochain lancement.
  }
}
