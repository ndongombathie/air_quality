import { StyleSheet, Text, View } from 'react-native';
import { AQI_LEVELS, getAqiLevel, type AqiLevel } from '@senair/core';
import { formatAqi } from '@/shared/format/display';
import { COLORS, TYPE } from '@/theme';

interface AqiBadgeProps {
  aqi: number | null | undefined;
  /** Niveau fourni par l'API ; à défaut, classement de l'IQA via core. */
  level?: AqiLevel | null;
  size?: 'sm' | 'md';
}

/** IQA compact : chiffre en encre foncée dans un anneau fin de la couleur du niveau. */
export function AqiBadge({ aqi, level, size = 'md' }: AqiBadgeProps) {
  const info = level ? AQI_LEVELS[level] : getAqiLevel(aqi);
  const value = formatAqi(aqi);
  const dimension = size === 'sm' ? 40 : 48;
  return (
    <View
      style={[styles.ring, { width: dimension, height: dimension, borderRadius: dimension / 2, borderColor: info?.color ?? COLORS.borderStrong }]}
      accessible
      accessibilityLabel={`IQA ${value}, ${info?.label ?? 'niveau indisponible'}`}
    >
      <Text style={[size === 'sm' ? styles.valueSm : styles.value, value.length > 3 && styles.valueTiny]}>{value}</Text>
    </View>
  );
}

/** Point de couleur du niveau (indicateur, jamais seul porteur d'information). */
export function LevelDot({ level, size = 10 }: { level: AqiLevel | null; size?: number }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: level ? AQI_LEVELS[level].color : COLORS.textDisabled }}
      aria-hidden
    />
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface },
  value: { ...TYPE.valueSmall, color: COLORS.text },
  valueSm: { ...TYPE.smallSemibold, fontFamily: TYPE.valueSmall.fontFamily, color: COLORS.text, fontVariant: ['tabular-nums'] },
  valueTiny: { fontSize: 11 },
});
