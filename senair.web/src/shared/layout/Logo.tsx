import { Link } from 'react-router-dom';
import { LOGO_MARK } from '@senair/core';

/** Symbole du logo (triangle et « S »), vectoriel : net à toutes les tailles, sans requête réseau. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg className="logo__mark" viewBox={LOGO_MARK.viewBox} width={size} height={size} aria-hidden="true" focusable="false">
      {LOGO_MARK.paths.map((path) => (
        <path key={path.fill} fill={path.fill} fillRule="evenodd" d={path.d} />
      ))}
    </svg>
  );
}

/** Mot « SEN AIR » du logo : SEN en gras, AIR en léger incliné. */
export function LogoWordmark() {
  return (
    <span className="logo__title">
      <span className="logo__sen">SEN</span> <span className="logo__air">AIR</span>
    </span>
  );
}

export function Logo({ subtitle }: { subtitle?: string }) {
  return (
    <Link to="/" className="logo" aria-label="SEN AIR, retour à l'accueil">
      <LogoMark />
      <span>
        <LogoWordmark />
        {subtitle && <span className="logo__subtitle">{subtitle}</span>}
      </span>
    </Link>
  );
}
