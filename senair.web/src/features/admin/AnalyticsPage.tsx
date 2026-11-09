import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '../../shared/ui/Card';
import { AXIS_TICK, CHART } from '../../shared/ui/chart';
import { KpiTile } from '../../shared/ui/KpiTile';
import { PageHeader } from '../../shared/ui/PageHeader';
import { QueryState } from '../../shared/ui/QueryState';
import { Tabs } from '../../shared/ui/Tabs';
import { lastDays } from '../../shared/lib/time';
import { useUsage } from './hooks';

const RANGES = [
  { value: '7' as const, label: '7 jours' },
  { value: '30' as const, label: '30 jours' },
  { value: '90' as const, label: '90 jours' },
];
const PLATFORM_LABELS = { ios: 'iOS', android: 'Android', web: 'Web' } as const;

export function AnalyticsPage() {
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const query = useUsage(lastDays(Number(days)));

  return (
    <div className="stack">
      <PageHeader title="Analytique d'usage" description="Fréquentation de la plateforme web et mobile (données agrégées, sans suivi individuel)." actions={<Tabs label="Période" items={RANGES} value={days} onChange={setDays} />} />
      <QueryState query={query}>
        {(usage) => (
          <>
            <div className="kpi-grid">
              <KpiTile label="Utilisateurs actifs" value={usage.activeUsers.toLocaleString('fr-FR')} />
              <KpiTile label="Sessions" value={usage.sessions.toLocaleString('fr-FR')} />
              <KpiTile label="Notifications envoyées" value={usage.pushSent.toLocaleString('fr-FR')} />
            </div>
            <div className="grid grid--2">
              <Card title="Activité quotidienne">
                <div role="img" aria-label={`Sessions et utilisateurs actifs par jour sur ${days} jours`}>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={usage.daily} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                      <XAxis dataKey="day" tick={AXIS_TICK} minTickGap={24} />
                      <YAxis tick={AXIS_TICK} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="sessions" name="Sessions" stroke={CHART.line} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="activeUsers" name="Utilisateurs actifs" stroke={CHART.secondary} dot={false} isAnimationActive={false} strokeDasharray="5 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card title="Sessions par plateforme">
                <div role="img" aria-label={usage.byPlatform.map((p) => `${PLATFORM_LABELS[p.platform]} : ${p.sessions} sessions`).join(', ')}>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={usage.byPlatform.map((p) => ({ ...p, label: PLATFORM_LABELS[p.platform] }))} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                      <XAxis dataKey="label" tick={AXIS_TICK} />
                      <YAxis tick={AXIS_TICK} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="sessions" name="Sessions" fill={CHART.fill} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}
