import { Droplets, Gauge, Thermometer, Wind } from 'lucide-react';
import { formatMeasure, formatRelativeTime, MISSING_VALUE, type Weather } from '@senair/core';

const SOURCE_LABELS: Record<Weather['source'], string> = {
  sensor: 'capteur de la station',
  openweathermap: 'OpenWeatherMap (ville)',
  mock: 'démonstration',
};

const withUnit = (value: number | null, unit: string, digits = 1) => (value == null ? MISSING_VALUE : `${formatMeasure(value, digits)} ${unit}`);

export function WeatherPanel({ weather }: { weather: Weather | null }) {
  if (!weather) return <p className="muted">Météo indisponible.</p>;
  const items = [
    { icon: Thermometer, label: 'Température', value: withUnit(weather.temperatureC, '°C') },
    { icon: Droplets, label: 'Humidité', value: withUnit(weather.humidityPct, '%', 0) },
    { icon: Wind, label: 'Vent', value: withUnit(weather.windSpeedMs, 'm/s') },
    { icon: Gauge, label: 'Pression', value: withUnit(weather.pressureHpa, 'hPa', 0) },
  ];
  return (
    <div className="stack stack--sm">
      <dl className="weather">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="weather__item">
            <span className="weather__icon" aria-hidden="true">
              <Icon size={18} />
            </span>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="caption">
        Source : {SOURCE_LABELS[weather.source]}, {formatRelativeTime(weather.observedAt)}
      </p>
    </div>
  );
}
