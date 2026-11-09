import type { CSSProperties } from 'react';
import type { AqiLevel, AqiLevelInfo } from '@senair/core';
import { cx } from '../lib/cx';
import { formatAqi, resolveLevel } from './aqi';

interface AqiBadgeProps {
  aqi: number | null | undefined;
  level?: AqiLevel | null;
  size?: 'sm' | 'md' | 'lg';
  /** Affiche seulement la puce du niveau (ex. niveau d'alerte). */
  labelOnly?: boolean;
  short?: boolean;
}

/** Puce de niveau : fond doux du niveau, bordure de sa couleur, texte foncé. */
export function LevelChip({ info, short = false, withDot = false }: { info: AqiLevelInfo; short?: boolean; withDot?: boolean }) {
  const style: CSSProperties = { backgroundColor: info.surface, borderColor: info.color };
  return (
    <span className="level-chip" style={style}>
      {withDot && <span className="level-dot" aria-hidden="true" style={{ backgroundColor: info.color, width: 8, height: 8 }} />}
      {short ? info.shortLabel : info.label}
    </span>
  );
}

/**
 * Chiffre de l'IQA en encre + point de couleur + libellé en toutes lettres.
 * Jamais de bloc saturé : la couleur n'est qu'un indicateur.
 */
export function AqiBadge({ aqi, level, size = 'md', labelOnly = false, short = false }: AqiBadgeProps) {
  const info = resolveLevel(aqi, level);
  if (!info) {
    return (
      <span className={cx('aqi', `aqi--${size}`, 'aqi--unknown')}>
        <span className="aqi__value">{formatAqi(null)}</span>
        <span className="level-chip" style={{ borderColor: 'var(--border-strong)' }}>
          Indisponible
        </span>
      </span>
    );
  }
  return (
    <span className={cx('aqi', `aqi--${size}`)}>
      {!labelOnly && (
        <span className="aqi__value">
          <span className="level-dot" aria-hidden="true" style={{ backgroundColor: info.color }} />
          {formatAqi(aqi)}
          <span className="sr-only"> IQA,</span>
        </span>
      )}
      <LevelChip info={info} short={short} withDot={labelOnly} />
    </span>
  );
}

/** Point de couleur décoratif, toujours accompagné d'un libellé ailleurs. */
export function LevelDot({ level, aqi }: { level?: AqiLevel | null; aqi?: number | null }) {
  const info = resolveLevel(aqi, level);
  return <span className="level-dot" aria-hidden="true" style={{ backgroundColor: info?.color ?? 'var(--ink-300)' }} />;
}
