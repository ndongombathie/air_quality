import { StyleSheet, Text, View } from 'react-native';
import { CloudRain, Compass, Droplets, Gauge, Thermometer, Wind } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { formatRelativeTime, type Weather } from '@senair/core';
import { Card } from '@/shared/ui';
import { formatWindDirection, withUnit } from '@/shared/format/display';
import { COLORS, SPACING, TYPE } from '@/theme';

const SOURCE_LABELS: Record<Weather['source'], string> = {
  sensor: 'capteur de la station',
  openweathermap: 'OpenWeatherMap (ville)',
  mock: 'démonstration',
};

const ICON = { size: 18, color: COLORS.primaryText, strokeWidth: 1.8 } as const;

/** Conditions météo (influence sur la dispersion). Valeurs absentes : « N/D ». */
export function WeatherCard({ weather }: { weather: Weather | null }) {
  if (!weather) {
    return (
      <Card>
        <Text style={styles.empty}>Météo indisponible pour le moment.</Text>
      </Card>
    );
  }
  const windKmh = weather.windSpeedMs == null ? null : weather.windSpeedMs * 3.6;
  return (
    <Card>
      <View style={styles.grid}>
        <Metric icon={<Thermometer {...ICON} />} label="Température" value={withUnit(weather.temperatureC, '°C')} />
        <Metric icon={<Droplets {...ICON} />} label="Humidité" value={withUnit(weather.humidityPct, '%', 0)} />
        <Metric icon={<Wind {...ICON} />} label="Vent" value={withUnit(windKmh, 'km/h', 0)} />
        <Metric icon={<Compass {...ICON} />} label="Direction" value={formatWindDirection(weather.windDirectionDeg)} />
        <Metric icon={<Gauge {...ICON} />} label="Pression" value={withUnit(weather.pressureHpa, 'hPa', 0)} />
        <Metric icon={<CloudRain {...ICON} />} label="Pluie" value={withUnit(weather.precipitationMm, 'mm')} />
      </View>
      <Text style={styles.source}>
        Source : {SOURCE_LABELS[weather.source]}, {formatRelativeTime(weather.observedAt)}
      </Text>
    </Card>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={styles.metric} accessible accessibilityLabel={`${label} : ${value}`}>
      <View style={styles.icon}>{icon}</View>
      <View>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: SPACING.lg },
  metric: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  label: { ...TYPE.caption, color: COLORS.textMuted },
  value: { ...TYPE.bodySemibold, color: COLORS.text, fontVariant: ['tabular-nums'] },
  source: { ...TYPE.caption, color: COLORS.textMuted, marginTop: SPACING.lg },
  empty: { ...TYPE.body, color: COLORS.textSecondary },
});
