import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { DesignTokens } from '@senair/core';
import { COLORS } from '@/theme';

const [FROM, TO] = DesignTokens.COLORS.skyGradient;

/** Dégradé ciel discret (sky100 vers blanc, puis fond de page), uniquement en haut des écrans. */
export function SkyBackdrop({ height }: { height: number }) {
  return (
    <View pointerEvents="none" style={[styles.backdrop, { height }]} aria-hidden>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={FROM} />
            <Stop offset="0.7" stopColor={TO} />
            <Stop offset="1" stopColor={COLORS.background} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#sky)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0 },
});
