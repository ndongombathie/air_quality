import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { MISSING_VALUE } from '@senair/core';

function Delta({ label, value }: { label: string; value: number | null }) {
  if (value == null) {
    return (
      <div className="delta">
        <span className="delta__label">{label}</span>
        <span className="delta__value">{MISSING_VALUE}</span>
      </div>
    );
  }
  const rounded = Math.round(value);
  const Icon = rounded > 0 ? TrendingUp : rounded < 0 ? TrendingDown : Minus;
  const text = rounded > 0 ? `+${rounded} points, en hausse` : rounded < 0 ? `${rounded} points, en baisse` : 'Stable';
  return (
    <div className={`delta ${rounded > 0 ? 'delta--worse' : rounded < 0 ? 'delta--better' : ''}`}>
      <span className="delta__label">{label}</span>
      <span className="delta__value">
        <Icon size={16} aria-hidden="true" /> {text}
      </span>
    </div>
  );
}

/** Écarts d'IQA fournis par le backend (le front ne les recalcule pas). */
export function Comparison({ comparison }: { comparison: { vsYesterday: number | null; vsLastWeek: number | null } }) {
  return (
    <div className="deltas">
      <Delta label="Par rapport à hier" value={comparison.vsYesterday} />
      <Delta label="Par rapport à la semaine dernière" value={comparison.vsLastWeek} />
    </div>
  );
}
