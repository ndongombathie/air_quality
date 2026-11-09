import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { UserRound } from 'lucide-react-native';
import { useSession } from '@/shared/api/AppProviders';
import { Button, StateView } from '@/shared/ui';
import { COLORS, SPACING, TYPE } from '@/theme';

/** Garde d'écran : le compte est facultatif, on propose connexion / inscription sans bloquer l'app. */
export function RequireAccount({ children, reason }: { children: ReactNode; reason: string }) {
  const { status } = useSession();
  if (status === 'restoring') return <StateView kind="loading" />;
  if (status === 'authenticated') return <>{children}</>;
  return (
    <View style={styles.container}>
      <UserRound size={40} color={COLORS.primary} />
      <Text style={styles.title}>Compte citoyen facultatif</Text>
      <Text style={styles.text}>{reason}</Text>
      <Text style={styles.text}>Toutes les données de qualité de l'air restent consultables sans compte.</Text>
      <Button label="Se connecter" onPress={() => router.push('/account/login')} style={styles.button} />
      <Button label="Créer un compte" variant="secondary" onPress={() => router.push('/account/register')} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: SPACING.lg,
    paddingVertical: SPACING.xxl,
  },
  title: { ...TYPE.h2, color: COLORS.text },
  text: { ...TYPE.body, color: COLORS.textSecondary, textAlign: 'center' },
  button: { alignSelf: 'stretch' },
});
