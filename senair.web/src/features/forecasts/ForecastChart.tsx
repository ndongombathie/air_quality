import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FORECAST_HORIZON_LABELS, MISSING_VALUE, type Forecast } from '@senair/core';
import { AXIS_TICK, CHART, aqiBands, aqiDomainMax } from '../../shared/ui/chart';
import { formatAqi, resolveLevel } from '../../shared/ui/aqi';

interface Point {
  label: string;
  long: string;
  aqi: number | null;
  band: [number, number] | null;
  color: string;
  levelLabel: string;
}

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: Point;
}

/** Point coloré selon le niveau fourni par l'API, cerclé de blanc pour rester lisible. */
function LevelDotShape({ cx, cy, payload }: DotProps) {
  if (cx == null || cy == null || !payload || payload.aqi == null) return <g />;
  return <circle cx={cx} cy={cy} r={6} fill={payload.color} stroke="#FFFFFF" strokeWidth={2.5} />;
}

interface TooltipProps {
  active?: boolean;
  payload?: readonly { payload?: Point }[];
}

function ForecastTooltip({ active, payload }: TooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="chart-tooltip">
      <strong>{point.long}</strong>
      <span>
        IQA {formatAqi(point.aqi)}, {point.levelLabel.toLowerCase()}
      </span>
      <span className="caption">Intervalle : {point.band ? `${point.band[0]} à ${point.band[1]}` : MISSING_VALUE}</span>
    </div>
  );
}

/** Courbe unique des 6 horizons avec la bande de confiance (intervalle bas à haut). */
export function ForecastChart({ forecasts }: { forecasts: readonly Forecast[] }) {
  const data: Point[] = forecasts.map((f) => {
    const info = resolveLevel(f.aqi, f.level);
    return {
      label: FORECAST_HORIZON_LABELS[f.horizon].short,
      long: FORECAST_HORIZON_LABELS[f.horizon].long,
      aqi: f.aqi,
      band: f.interval ? [Math.round(f.interval.low), Math.round(f.interval.high)] : null,
      color: info?.color ?? CHART.muted,
      levelLabel: info?.label ?? 'Indisponible',
    };
  });
  const domainMax = aqiDomainMax(data.flatMap((d) => [d.aqi, d.band?.[1] ?? null]));
  const description = data.map((d) => `${d.long} : IQA ${formatAqi(d.aqi)}, ${d.levelLabel.toLowerCase()}`).join('. ');

  return (
    <figure className="chart">
      <div className="chart__canvas" role="img" aria-label={`Prévisions de l'IQA. ${description}.`}>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: -20 }}>
            {aqiBands(domainMax)}
            <CartesianGrid strokeDasharray="2 4" stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} padding={{ left: 16, right: 16 }} />
            <YAxis tick={AXIS_TICK} allowDecimals={false} domain={[0, domainMax]} axisLine={false} tickLine={false} />
            <Tooltip content={<ForecastTooltip />} cursor={{ stroke: CHART.band, strokeDasharray: '3 3' }} />
            <Area dataKey="band" stroke="none" fill={CHART.fill} fillOpacity={0.22} isAnimationActive={false} connectNulls />
            <Line dataKey="aqi" stroke={CHART.line} strokeWidth={2.5} dot={<LevelDotShape />} activeDot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="caption">
        Ligne : IQA prévu. Zone bleutée : intervalle probable fourni par le modèle. Bandes de fond : niveaux de l'échelle IQA.
      </figcaption>
    </figure>
  );
}
