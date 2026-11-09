import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { DesignTokens, LOGO_MARK } from '@senair/core';
import { FONTS } from '@/theme';

/** Symbole du logo (triangle et « S »), mêmes données vectorielles que le web. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <View aria-hidden>
      <Svg width={size} height={size} viewBox={LOGO_MARK.viewBox}>
        {LOGO_MARK.paths.map((path) => (
          <Path key={path.fill} fill={path.fill} fillRule="evenodd" d={path.d} />
        ))}
      </Svg>
    </View>
  );
}

interface BrandLogoProps {
  /** `inline` : symbole à gauche du mot ; `stacked` : symbole au-dessus (écrans d'accueil) ; `mark` : symbole seul. */
  variant?: 'inline' | 'stacked' | 'mark';
  size?: number;
}

/** Logo SEN AIR : « SEN » en gras, « AIR » en léger incliné, comme le logo d'origine. */
export function BrandLogo({ variant = 'inline', size = 32 }: BrandLogoProps) {
  if (variant === 'mark') return <LogoMark size={size} />;
  const fontSize = variant === 'stacked' ? size * 0.34 : size * 0.6;
  return (
    <View style={variant === 'stacked' ? styles.stacked : styles.inline} accessible accessibilityRole="image" accessibilityLabel="SEN AIR">
      <LogoMark size={size} />
      <View style={styles.word}>
        <Text style={[styles.sen, { fontSize, lineHeight: fontSize * 1.2 }]}>SEN</Text>
        <Text style={[styles.air, { fontSize, lineHeight: fontSize * 1.2 }]}>AIR</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stacked: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  word: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  sen: { fontFamily: FONTS.extrabold, color: DesignTokens.PALETTE.logoInk, letterSpacing: 0.3 },
  // Manrope n'a pas d'italique : inclinaison légère, comme dans le logo d'origine.
  air: { fontFamily: FONTS.regular, color: DesignTokens.PALETTE.logoInk, letterSpacing: 0.5, transform: [{ skewX: '-12deg' }] },
});
