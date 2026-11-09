import type { ReactNode } from 'react';
import { useDocumentTitle } from '../../shared/ui/PageHeader';
import { LogoMark, LogoWordmark } from '../../shared/layout/Logo';

export function AuthCard({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useDocumentTitle(title);
  return (
    <div className="auth">
      <section className="card auth__card" aria-labelledby="auth-title">
        <div className="auth__brand" aria-hidden="true">
          <LogoMark size={64} />
          <LogoWordmark />
        </div>
        <h1 id="auth-title" className="h2">
          {title}
        </h1>
        {description && <p className="muted">{description}</p>}
        {children}
        {footer && <div className="auth__footer">{footer}</div>}
      </section>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="form-error" role="alert">
      {message}
    </p>
  );
}
