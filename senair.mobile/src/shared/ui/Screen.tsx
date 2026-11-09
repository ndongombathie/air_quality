import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, CONTENT_MAX_WIDTH, SPACING } from '@/theme';
import { SkyBackdrop } from './SkyBackdrop';

interface ScreenProps {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** `false` pour un écran non défilant (ex. carte). */
  scroll?: boolean;
  /** `true` pour les onglets (pas d'en-tête natif) : le contenu commence sous la barre d'état. */
  topInset?: boolean;
}

/** Conteneur d'écran : dégradé ciel en tête, défilement, pull-to-refresh, largeur bornée sur tablette. */
export function Screen({ children, refreshing = false, onRefresh, scroll = true, topInset = true }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const top = topInset ? insets.top : 0;
  if (!scroll) {
    return (
      <View style={[styles.root, { paddingTop: top }]}>
        <SkyBackdrop height={top + 200} />
        {children}
      </View>
    );
  }
  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: top }]}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primaryText} colors={[COLORS.primaryText]} progressViewOffset={top} />
          ) : undefined
        }
        keyboardShouldPersistTaps="handled"
      >
        <SkyBackdrop height={top + 240} />
        <View style={styles.inner}>{children}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: SPACING.xxxl },
  inner: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', paddingHorizontal: SPACING.lg },
});
