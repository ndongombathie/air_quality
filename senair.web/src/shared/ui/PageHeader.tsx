import { useEffect, type ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

/** Titre de page (h1) + titre du document pour les lecteurs d'écran et l'historique. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  useDocumentTitle(title);
  return (
    <header className="page-header">
      <div>
        <h1 className="page-header__title">{title}</h1>
        {description && <p className="page-header__description">{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · SEN-AIR`;
  }, [title]);
}
