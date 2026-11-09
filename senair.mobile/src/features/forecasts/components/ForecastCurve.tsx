import { Fragment, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { AQI_LEVELS, FORECAST_HORIZON_LABELS, getAqiLevel, type Forecast } from '@senair/core';
import { formatAqi, formatRange } from '@/shared/format/display';
import { COLORS, FONTS } from '@/theme';

const PAD = { left: 30, right: 20, top: 18, bottom: 26 };

/** Courbe unique des 6 horizons avec la bande de confiance (intervalle fourni par le modèle). */
export function ForecastCurve({ forecasts, height = 170 }: { forecasts: Forecast[]; height?: number }) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const highs = forecasts.map((f) => f.interval?.high ?? f.aqi ?? 0);
  const max = Math.max(...highs, 50) * 1.12;
  const chartW = Math.max(width - PAD.left - PAD.right, 1);
  const chartH = height - PAD.top - PAD.bottom;
  const step = forecasts.length > 1 ? chartW / (forecasts.length - 1) : 0;
  const xOf = (i: number) => PAD.left + i * step;
  const yOf = (v: number) => PAD.top + chartH - (v / max) * chartH;

  const withValue = forecasts.map((f, i) => ({ f, i })).filter(({ f }) => f.aqi != null);
  const line = withValue.map(({ f, i }, k) => `${k ? 'L' : 'M'} ${xOf(i)} ${yOf(f.aqi as number)}`).join(' ');
  const banded = forecasts.map((f, i) => ({ i, band: f.interval })).filter((b): b is { i: number; band: { low: number; high: number } } => b.band != null);
  const band =
    banded.length > 1
      ? `${banded.map(({ i, band: b }, k) => `${k ? 'L' : 'M'} ${xOf(i)} ${yOf(b.high)}`).join(' ')} ${[...banded]
          .reverse()
          .map(({ i, band: b }) => `L ${xOf(i)} ${yOf(b.low)}`)
          .join(' ')} Z`
      : '';

  const summary = forecasts
    .map((f) => `${FORECAST_HORIZON_LABELS[f.horizon].long} : ${formatAqi(f.aqi)}, intervalle ${formatRange(f.interval?.low, f.interval?.high)}`)
    .join(' ; ');

  return (
    <View onLayout={onLayout} style={{ height }} accessible accessibilityRole="image" accessibilityLabel={`Courbe des prévisions. ${summary}`}>
      {width > 0 ? (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          {[0, 0.5, 1].map((r) => {
            const v = Math.round(max * r);
            return (
              <Fragment key={r}>
                <Line x1={PAD.left} x2={width - PAD.right} y1={yOf(v)} y2={yOf(v)} stroke={COLORS.border} />
                <SvgText x={PAD.left - 6} y={yOf(v) + 4} fontSize={11} fill={COLORS.textMuted} fontFamily={FONTS.medium} textAnchor="end">
                  {v}
                </SvgText>
              </Fragment>
            );
          })}
          {band ? <Path d={band} fill={COLORS.primary} fillOpacity={0.12} /> : null}
          <Path d={line} fill="none" stroke={COLORS.primary} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {withValue.map(({ f, i }) => {
            const info = f.level ? AQI_LEVELS[f.level] : getAqiLevel(f.aqi);
            return <Circle key={f.horizon} cx={xOf(i)} cy={yOf(f.aqi as number)} r={4.5} fill={COLORS.surface} stroke={info?.color ?? COLORS.primary} strokeWidth={2.5} />;
          })}
          {forecasts.map((f, i) => (
            <SvgText key={`x-${f.horizon}`} x={xOf(i)} y={height - 6} fontSize={11} fill={COLORS.textMuted} fontFamily={FONTS.semibold} textAnchor="middle">
              {FORECAST_HORIZON_LABELS[f.horizon].short}
            </SvgText>
          ))}
        </Svg>
      ) : null}
    </View>
  );
}
