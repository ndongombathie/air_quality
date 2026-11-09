import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={cx('badge', `badge--${tone}`, className)}>{children}</span>;
}
