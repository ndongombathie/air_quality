import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export type HapticKind = 'light' | 'selection' | 'success';

/** Retour haptique discret (sans effet sur le web ; les erreurs sont ignorées). */
export function haptic(kind: HapticKind): void {
  if (Platform.OS === 'web') return;
  const run =
    kind === 'selection'
      ? Haptics.selectionAsync()
      : kind === 'success'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  run.catch(() => undefined);
}
