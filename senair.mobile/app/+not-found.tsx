import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, SPACING, TOUCH_TARGET, TYPE } from '@/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Page introuvable' }} />
      <View style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          Cette page n’existe pas.
        </Text>
        <Link href="/" style={styles.link} accessibilityRole="link">
          Retour à l’accueil
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, backgroundColor: COLORS.background },
  title: { ...TYPE.h2, color: COLORS.text },
  link: { ...TYPE.bodyMedium, color: COLORS.primary, marginTop: SPACING.lg, paddingVertical: SPACING.sm, minHeight: TOUCH_TARGET },
});
