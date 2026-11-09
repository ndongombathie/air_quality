import { useEffect, type ComponentType } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Bell, HeartPulse, House, Map, Newspaper, type LucideProps } from 'lucide-react-native';
import { useUnreadAlertCount } from '@/features/alerts/hooks/useAlerts';
import { useOnboardingStatus } from '@/features/onboarding/useOnboardingStatus';
import { AppHeader } from '@/shared/ui';
import { haptic } from '@/shared/motion/haptics';
import { COLORS, FONTS } from '@/theme';

/** Icône d'onglet : indicateur qui s'étire et petit rebond à la sélection. */
function AnimatedTabIcon({ Icon, color, focused }: { Icon: ComponentType<LucideProps>; color: ColorValue; focused: boolean }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const bar = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    bar.value = reduced ? (focused ? 1 : 0) : withSpring(focused ? 1 : 0, { damping: 16, stiffness: 220 });
    if (focused && !reduced) scale.value = withSequence(withTiming(1.18, { duration: 110 }), withSpring(1, { damping: 9, stiffness: 260 }));
  }, [focused, reduced, bar, scale]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const barStyle = useAnimatedStyle(() => ({ opacity: bar.value, transform: [{ scaleX: bar.value }] }));

  return (
    <View style={styles.iconWrap}>
      <Animated.View style={[styles.indicator, barStyle]} />
      <Animated.View style={iconStyle}>
        <Icon size={23} color={typeof color === 'string' ? color : COLORS.textMuted} strokeWidth={focused ? 2.4 : 1.8} />
      </Animated.View>
    </View>
  );
}

const tabIcon = (Icon: ComponentType<LucideProps>) =>
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <AnimatedTabIcon Icon={Icon} color={color} focused={focused} />;
  };

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const onboarding = useOnboardingStatus();
  const unread = useUnreadAlertCount();
  if (onboarding === 'checking') return <View style={styles.blank} />;
  if (onboarding === 'todo') return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenListeners={{ tabPress: () => haptic('selection') }}
      screenOptions={{
        // Barre fixe commune à tous les onglets : logo à gauche, profil à droite.
        headerShown: true,
        header: () => <AppHeader />,
        tabBarActiveTintColor: COLORS.primaryText,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 68 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 6,
        },
        tabBarLabelStyle: { fontFamily: FONTS.semibold, fontSize: 11, lineHeight: 14, flexShrink: 0 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: tabIcon(House) }} />
      <Tabs.Screen name="map" options={{ title: 'Carte', tabBarIcon: tabIcon(Map) }} />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alertes',
          tabBarIcon: tabIcon(Bell),
          // Pastille : alertes non lues du compte connecté.
          tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.danger, fontFamily: FONTS.semibold, fontSize: 11 },
        }}
      />
      <Tabs.Screen name="health" options={{ title: 'Santé', tabBarIcon: tabIcon(HeartPulse) }} />
      <Tabs.Screen name="actualites" options={{ title: 'Actualités', tabBarIcon: tabIcon(Newspaper) }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: COLORS.background },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  indicator: { position: 'absolute', top: -9, width: 22, height: 3, borderRadius: 2, backgroundColor: COLORS.primaryText },
});
