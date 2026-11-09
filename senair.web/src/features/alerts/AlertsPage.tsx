import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../shared/ui/PageHeader';
import { useAuth } from '../auth/AuthProvider';
import { AlertFilters, EMPTY_ALERT_FILTERS, toAlertQuery, type AlertFilterValue } from './AlertFilters';
import { AlertList } from './AlertList';
import { usePublicAlerts } from './hooks';

export function AlertsPage() {
  const { status } = useAuth();
  const [filters, setFilters] = useState<AlertFilterValue>({ ...EMPTY_ALERT_FILTERS, status: 'active' });
  const query = usePublicAlerts(toAlertQuery(filters));

  return (
    <div className="stack">
      <PageHeader
        title="Alertes"
        description={
          status === 'authenticated' ? (
            <>
              Dépassements de seuils à Thiès. Vos alertes personnalisées sont dans <Link to="/mon-espace/alertes">Mon espace</Link>.
            </>
          ) : (
            <>
              Dépassements de seuils à Thiès. <Link to="/inscription">Créez un compte</Link> pour recevoir des alertes sur vos zones.
            </>
          )
        }
      />
      <AlertFilters value={filters} onChange={setFilters} />
      <AlertList query={query} />
    </div>
  );
}
