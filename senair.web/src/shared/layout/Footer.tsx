import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <p>
          <strong>SEN-AIR</strong> : surveillance de la qualité de l'air à Thiès.
        </p>
        <nav aria-label="Liens de pied de page" className="footer__links">
          <Link to="/infos">Normes et échelle IQA</Link>
          <Link to="/sante">Conseils santé</Link>
          <Link to="/articles">Actualités</Link>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
            Fond de carte © OpenStreetMap
          </a>
        </nav>
        <p className="muted small">
          Les indices sont calculés par la plateforme à partir des capteurs AirGradient et des référentiels OMS 2021 / NS 05-062.
        </p>
      </div>
    </footer>
  );
}
