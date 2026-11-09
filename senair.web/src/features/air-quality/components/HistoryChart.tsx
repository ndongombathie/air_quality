import type { UseQueryResult } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDateTime, type History } from '@senair/core';
import { Card } from '../../../shared/ui/Card';
import { QueryState } from '../../../shared/ui/QueryState';
import { Tabs } from '../../../shared/ui/Tabs';
import { AXIS_TICK, CHART, aqiBands, aqiDomainMax } from '../../../shared/ui/chart';
import { formatDayLabel, formatHourLabel, HISTORY_RANGE_LABELS, type HistoryRange } from '../../../shared/lib/time';
import { formatAqi } from '../../../shared/ui/aqi';

const RANGE_TABS = (Object.keys(HISTORY_RANGE_LABELS) as HistoryRange[]).map((value) => ({ value, label: HISTORY_RANGE_LABELS[value] }));

interface HistoryChartCardProps {
  title: string;
  range: HistoryRange;
  onRangeChange: (range: HistoryRange) => void;
  query: UseQueryResult<History>;
}

export function HistoryChartCard({ title, range, onRangeChange, query }: HistoryChartCardProps) {
  return (
    <Card title={title} actions={<Tabs label="Période" items={RANGE_TABS} value={range} onChange={onRangeChange} />}>
      <QueryState
        query={query}
        skeletonBlock
        isEmpty={(history) => history.points.every((p) => p.aqi == null)}
        emptyMessage="Pas d'historique disponible sur cette période."
      >
        {(history) => <HistoryChart history={history} range={range} />}
      </QueryState>
    </Card>
  );
}

function HistoryChart({ history, range }: { history: History; range: HistoryRange }) {
  const format = range === '24h' ? formatHourLabel : formatDayLabel;
  const data = history.points.map((p) => ({ at: p.at, aqi: p.aqi }));
  const values = data.map((d) => d.aqi).filter((v): v is number => v != null);
  const domainMax = aqiDomainMax(values);
  const summary = values.length
    ? `IQA entre ${Math.round(Math.min(...values))} et ${Math.round(Math.max(...values))} sur ${HISTORY_RANGE_LABELS[range]}.`
    : 'Aucune valeur.';

  return (
    <figure className="chart">
      <div className="chart__canvas" role="img" aria-label={`Évolution de l'IQA. ${summary}`}>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="history-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART.fill} stopOpacity={0.28} />
                <stop offset="100%" stopColor={CHART.fill} stopOpacity={0} />
              </linearGradient>
            </defs>
            {aqiBands(domainMax)}
            <CartesianGrid strokeDasharray="2 4" stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="at" tickFormatter={format} minTickGap={28} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} allowDecimals={false} domain={[0, domainMax]} axisLine={false} tickLine={false} />
            <Tooltip
              labelFormatter={(label) => formatDateTime(String(label))}
              formatter={(value) => [formatAqi(typeof value === 'number' ? value : null), 'IQA']}
              contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-raised)' }}
            />
            <Area type="monotone" dataKey="aqi" stroke={CHART.line} strokeWidth={2} fill="url(#history-fill)" connectNulls={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="caption">{summary} Les bandes de fond correspondent aux niveaux de l'échelle IQA.</figcaption>
      <details className="chart__data">
        <summary>Voir les données</summary>
        <div className="table-wrap">
          <table className="table table--compact">
            <caption className="sr-only">Historique de l'IQA</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">IQA</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.at}>
                  <td>{formatDateTime(d.at)}</td>
                  <td>{formatAqi(d.aqi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
