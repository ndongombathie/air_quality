import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, FlaskConical, UserRound } from 'lucide-react-native';
import { useApi, useSession } from '@/shared/api/AppProviders';
import { COLORS, RADIUS, SPACING, TOUCH_TARGET, TYPE } from '@/theme';
import { BrandLogo } from './BrandLogo';
import { PressableScale } from './PressableScale';

const BAR_HEIGHT = 56;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Barre fixe des onglets : logo à gauche ; à droite, la cloche des préférences de notification (compte connecté) et le profil.
 * En mode démonstration, une pastille « Démo » rappelle que les valeurs sont simulées (une seule fois pour toute l'app).
 */
export function AppHeader() {
  const insets = useSafeAreaInsets();
  const { isMock } = useApi();
  const { status, user } = useSession();
  const signedIn = status === 'authenticated' && user != null;

  return (
    <View style={[styles.bar, { paddingTop: insets.top, height: insets.top + BAR_HEIGHT }]}>
      <BrandLogo size={28} />
      <View style={styles.right}>
        {isMock ? (
          <View style={styles.demo} accessible accessibilityLabel="Données de démonstration : valeurs simulées">
            <FlaskConical size={13} color={COLORS.primaryText} />
            <Text style={styles.demoText}>Démo</Text>
          </View>
        ) : null}
        {signedIn ? (
          <PressableScale
            onPress={() => router.push('/account/notifications')}
            accessibilityRole="button"
            accessibilityLabel="Préférences de notification"
            style={styles.profile}
          >
            <Bell size={21} color={COLORS.primaryText} />
          </PressableScale>
        ) : null}
        <PressableScale
          onPress={() => router.push('/account')}
          accessibilityRole="button"
          accessibilityLabel={signedIn ? `Mon compte, ${user.fullName}` : 'Se connecter ou créer un compte'}
          style={[styles.profile, signedIn && styles.profileSignedIn]}
        >
          {signedIn ? <Text style={styles.initials}>{initials(user.fullName)}</Text> : <UserRound size={22} color={COLORS.primaryText} />}
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs + 1,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primarySoft,
  },
  demoText: { ...TYPE.captionMedium, color: COLORS.primaryText },
  profile: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  profileSignedIn: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primarySoft,
  },
  initials: { ...TYPE.smallSemibold, color: COLORS.primaryText },
});
