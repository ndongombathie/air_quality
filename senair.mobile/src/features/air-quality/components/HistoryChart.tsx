import { Fragment, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { getAqiLevel, type HistoryPoint } from '@senair/core';
import { formatAqi } from '@/shared/format/display';
import { COLORS, FONTS, SPACING, TYPE } from '@/theme';

interface HistoryChartProps {
  points: HistoryPoint[];
  /** Format des étiquettes de l'axe des abscisses. */
  labelMode: 'hour' | 'day';
  height?: number;
}

const PAD = { left: 30, right: 8, top: 12, bottom: 24 };

function xLabel(iso: string, mode: 'hour' | 'day'): string {
  const date = new Date(iso);
  return mode === 'hour' ? `${date.getHours().toString().padStart(2, '0')} h` : date.toLocaleDateString('fr-FR', { weekday: 'short' });
}

/** Courbe IQA (SVG). Les trous de données restent des trous : aucune interpolation. */
export function HistoryChart({ points, labelMode, height = 180 }: HistoryChartProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const values = points.map((p) => p.aqi).filter((v): v is number => v != null);
  if (values.length === 0) return <Text style={styles.empty}>Aucune donnée sur cette période.</Text>;

  const maxValue = Math.max(...values);
  const max = maxValue * 1.15 || 1;
  const chartW = Math.max(width - PAD.left - PAD.right, 1);
  const chartH = height - PAD.top - PAD.bottom;
  const step = points.length > 1 ? chartW / (points.length - 1) : 0;
  const xOf = (i: number) => PAD.left + i * step;
  const yOf = (v: number) => PAD.top + chartH - (v / max) * chartH;
  const baseY = PAD.top + chartH;

  // Segments continus (une zone par segment, rien entre deux trous).
  const segments: { i: number; v: number }[][] = [];
  let current: { i: number; v: number }[] = [];
  points.forEach((p, i) => {
    if (p.aqi == null) {
      if (current.length) segments.push(current);
      current = [];
    } else current.push({ i, v: p.aqi });
  });
  if (current.length) segments.push(current);

  const line = segments.map((seg) => seg.map((p, k) => `${k ? 'L' : 'M'} ${xOf(p.i)} ${yOf(p.v)}`).join(' ')).join(' ');
  const area = segments
    .filter((seg) => seg.length > 1)
    .map((seg) => `${seg.map((p, k) => `${k ? 'L' : 'M'} ${xOf(p.i)} ${yOf(p.v)}`).join(' ')} L ${xOf(seg[seg.length - 1]!.i)} ${baseY} L ${xOf(seg[0]!.i)} ${baseY} Z`)
    .join(' ');

  const ticks = [0, 0.5, 1].map((r) => Math.round(max * r));
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  const last = segments.at(-1)?.at(-1);

  return (
    <View
      onLayout={onLayout}
      style={{ height }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Historique de l'IQA : minimum ${formatAqi(Math.min(...values))}, maximum ${formatAqi(maxValue)}, ${points.length} points.`}
    >
      {width > 0 ? (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="historyArea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={COLORS.primary} stopOpacity={0.18} />
              <Stop offset="1" stopColor={COLORS.primary} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {ticks.map((tick) => (
            <Fragment key={tick}>
              <Line x1={PAD.left} x2={width - PAD.right} y1={yOf(tick)} y2={yOf(tick)} stroke={COLORS.border} />
              <SvgText x={PAD.left - 6} y={yOf(tick) + 4} fontSize={11} fill={COLORS.textMuted} fontFamily={FONTS.medium} textAnchor="end">
                {tick}
              </SvgText>
            </Fragment>
          ))}
          {area ? <Path d={area} fill="url(#historyArea)" /> : null}
          <Path d={line} fill="none" stroke={COLORS.primary} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {segments
            .filter((seg) => seg.length === 1)
            .map((seg) => (
              <Circle key={`s-${seg[0]!.i}`} cx={xOf(seg[0]!.i)} cy={yOf(seg[0]!.v)} r={3} fill={COLORS.primary} />
            ))}
          {last ? (
            <Circle cx={xOf(last.i)} cy={yOf(last.v)} r={5} fill={COLORS.surface} stroke={getAqiLevel(last.v)?.color ?? COLORS.primary} strokeWidth={3} />
          ) : null}
          {points.map((p, i) =>
            i % labelEvery === 0 ? (
              <SvgText key={`l-${p.at}`} x={xOf(i)} y={height - 6} fontSize={11} fill={COLORS.textMuted} fontFamily={FONTS.medium} textAnchor="middle">
                {xLabel(p.at, labelMode)}
              </SvgText>
            ) : null,
          )}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { ...TYPE.body, color: COLORS.textSecondary, paddingVertical: SPACING.xl, textAlign: 'center' },
});
