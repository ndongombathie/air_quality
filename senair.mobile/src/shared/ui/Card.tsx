import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { CARD_PADDING, COLORS, RADIUS, SHADOWS } from '@/theme';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Barre fine à gauche (ex. couleur de niveau IQA), toujours doublée d'un libellé texte. */
  accentColor?: string;
}

/** Carte blanche, bordure 1 px, rayon 16, ombre très légère teintée de bleu. */
export function Card({ children, style, accentColor }: CardProps) {
  return (
    <View style={[styles.card, style]}>
      {accentColor ? <View style={[styles.accent, { backgroundColor: accentColor }]} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: CARD_PADDING,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
});
