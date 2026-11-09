import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { AQI_LEVELS, getAqiLevel, type AqiLevel } from '@senair/core';
import { formatAqi } from '@/shared/format/display';
import { useCountUp } from '@/shared/motion/useCountUp';
import { COLORS, SPACING, TYPE } from '@/theme';
import { LevelChip } from './LevelChip';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface AqiGaugeProps {
  aqi: number | null;
  level?: AqiLevel | null;
  size?: number;
  /** Masque la puce de niveau (affichée ailleurs par le parent). */
  hideChip?: boolean;
}

/** Borne d'affichage de la jauge (au-delà : arc plein). Purement visuel. */
const GAUGE_MAX = 300;

/** Jauge en arc fin : l'arc se dessine à l'apparition et quand la valeur change ; le chiffre compte jusqu'à la valeur. */
export function AqiGauge({ aqi, level, size = 232, hideChip = false }: AqiGaugeProps) {
  const info = level ? AQI_LEVELS[level] : getAqiLevel(aqi);
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const height = radius + stroke;
  const cy = radius + stroke / 2;
  const circumference = radius * Math.PI;
  const arc = `M ${stroke / 2} ${cy} A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${cy}`;
  const { progress, display } = useCountUp(aqi == null ? null : Math.min(Math.max(aqi, 0), 999));

  const arcProps = useAnimatedProps(() => {
    const ratio = Math.min(progress.value, GAUGE_MAX) / GAUGE_MAX;
    return { strokeDashoffset: circumference * (1 - ratio) };
  });

  const finalText = formatAqi(aqi);
  const shown = aqi == null || display == null ? finalText : formatAqi(display);

  return (
    <View style={styles.container} accessible accessibilityRole="image" accessibilityLabel={`Indice de qualité de l'air ${finalText}, ${info?.label ?? 'niveau indisponible'}`}>
      <View style={{ width: size, height }}>
        <Svg width={size} height={height}>
          <Path d={arc} fill="none" stroke={COLORS.track} strokeWidth={stroke} strokeLinecap="round" />
          {aqi != null ? (
            <AnimatedPath
              d={arc}
              fill="none"
              stroke={info?.color ?? COLORS.textDisabled}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              animatedProps={arcProps}
            />
          ) : null}
        </Svg>
        <View style={styles.values}>
          <Text style={styles.caption}>IQA</Text>
          <Text style={styles.value}>{shown}</Text>
        </View>
      </View>
      {hideChip ? null : (
        <View style={styles.chip}>
          <LevelChip level={info?.id ?? null} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  values: { position: 'absolute', left: 0, right: 0, bottom: -SPACING.xs, alignItems: 'center' },
  caption: { ...TYPE.overline, color: COLORS.textMuted },
  value: { ...TYPE.display, color: COLORS.text },
  chip: { marginTop: SPACING.md },
});
