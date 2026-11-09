import { cx } from '../lib/cx';

/** Blocs gris-bleu affichés pendant le chargement (annoncés une fois aux lecteurs d'écran). */
export function Skeleton({ variant = 'line', className }: { variant?: 'line' | 'title' | 'block' | 'short'; className?: string }) {
  return <span className={cx('skeleton', variant !== 'line' && `skeleton--${variant}`, className)} aria-hidden="true" />;
}

export function SkeletonGroup({ label = 'Chargement', lines = 3, block = false }: { label?: string; lines?: number; block?: boolean }) {
  return (
    <div className="skeleton-group" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton variant="title" />
      {block && <Skeleton variant="block" />}
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} variant={index === lines - 1 ? 'short' : 'line'} />
      ))}
    </div>
  );
}
