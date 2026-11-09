import { CloudOff, FlaskConical } from 'lucide-react';
import { useApi } from '../api/ApiProvider';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

/** Bandeaux globaux permanents : données de démonstration et mode hors-ligne. */
export function GlobalDataBanners() {
  const api = useApi();
  const online = useOnlineStatus();
  return (
    <>
      {!online && (
        <div className="banner banner--offline" role="status">
          <CloudOff size={16} aria-hidden="true" />
          Hors-ligne : les dernières données en cache sont affichées et peuvent être anciennes.
        </div>
      )}
      {api.isMock && (
        <div className="banner banner--mock" role="note">
          <FlaskConical size={14} aria-hidden="true" />
          Données de démonstration : valeurs simulées, à ne pas utiliser pour une décision sanitaire.
        </div>
      )}
    </>
  );
}
