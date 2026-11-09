import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';

/** Erreur de navigation (page introuvable, échec de chargement d'un module lazy). */
export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main className="container main">
      <div className="state state--error" role="alert">
        <h1 className="h3">{notFound ? 'Page introuvable' : 'Une erreur est survenue'}</h1>
        <p>
          {notFound
            ? "La page demandée n'existe pas."
            : 'La page n’a pas pu être affichée. Vérifiez votre connexion puis rechargez.'}
        </p>
        <div className="row">
          <button type="button" className="btn btn--secondary" onClick={() => window.location.reload()}>
            Recharger
          </button>
          <Link to="/" className="btn btn--primary">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </main>
  );
}

export function NotFoundPage() {
  return (
    <div className="state state--empty">
      <h1 className="h3">Page introuvable</h1>
      <p>La page demandée n'existe pas ou a été déplacée.</p>
      <Link to="/" className="btn btn--primary">
        Retour à l'accueil
      </Link>
    </div>
  );
}
