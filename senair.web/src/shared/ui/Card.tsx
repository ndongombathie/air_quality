import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

interface CardProps {
  title?: ReactNode;
  /** Niveau du titre pour respecter la hiérarchie de la page. */
  titleLevel?: 2 | 3;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Card({ title, titleLevel = 2, actions, className, children }: CardProps) {
  const Heading = titleLevel === 2 ? 'h2' : 'h3';
  return (
    <section className={cx('card', className)}>
      {(title || actions) && (
        <header className="card__header">
          {title && <Heading className="card__title">{title}</Heading>}
          {actions && <div className="card__actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
