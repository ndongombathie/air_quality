import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../shared/ui/PageHeader';
import { AlertFilters, EMPTY_ALERT_FILTERS, toAlertQuery, type AlertFilterValue } from '../alerts/AlertFilters';
import { AlertList } from '../alerts/AlertList';
import { useMyAlerts } from './hooks';

export function MyAlertsPage() {
  const [filters, setFilters] = useState<AlertFilterValue>(EMPTY_ALERT_FILTERS);
  const query = useMyAlerts(toAlertQuery(filters));
  return (
    <div className="stack">
      <PageHeader
        title="Mes alertes"
        description={
          <>
            Alertes de vos zones, selon le niveau minimum défini dans vos <Link to="/mon-espace/notifications">préférences</Link>.
          </>
        }
      />
      <AlertFilters value={filters} onChange={setFilters} showZone={false} />
      <AlertList query={query} emptyMessage="Aucune alerte pour vos zones avec ces critères." />
    </div>
  );
}
