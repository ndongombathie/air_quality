import { useState, type FormEvent } from 'react';
import { FileDown } from 'lucide-react';
import { formatDateTime, type Report, type ReportRequest } from '@senair/core';
import { useApi } from '../../shared/api/ApiProvider';
import { queryKeys } from '../../shared/api/queryKeys';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { DataTable } from '../../shared/ui/DataTable';
import { SelectField } from '../../shared/ui/Field';
import { PageHeader } from '../../shared/ui/PageHeader';
import { QueryState } from '../../shared/ui/QueryState';
import { useFeedbackMutation } from '../../shared/hooks/useFeedbackMutation';
import { useToast } from '../../shared/ui/Toast';
import { REPORT_PERIOD_LABELS, REPORT_STATUS_LABELS } from '../../shared/lib/labels';
import { downloadFile, isDownloadableUrl } from '../../shared/lib/download';
import { lastDays } from '../../shared/lib/time';
import { useAuth } from '../auth/AuthProvider';
import { useReports } from './hooks';

const STATUS_TONE = { queued: 'neutral', running: 'info', ready: 'success', failed: 'danger' } as const;
type Period = Exclude<Report['period'], 'custom'>;
const PERIODS: { value: Period; label: string }[] = [
  { value: 'weekly', label: REPORT_PERIOD_LABELS.weekly },
  { value: 'monthly', label: REPORT_PERIOD_LABELS.monthly },
];
const FORMATS: { value: Report['format']; label: string }[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
];

function RequestReportForm() {
  const api = useApi();
  const [period, setPeriod] = useState<Period>('weekly');
  const [format, setFormat] = useState<Report['format']>('pdf');
  const mutation = useFeedbackMutation({
    mutationFn: (request: ReportRequest) => api.admin.requestReport(request),
    invalidate: [queryKeys.admin.reports],
    successMessage: (report) => (report.status === 'ready' ? 'Rapport prêt : il est en tête de la liste.' : 'Rapport demandé : il apparaîtra dans la liste une fois généré.'),
  });
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const range = lastDays(period === 'weekly' ? 7 : 30);
    mutation.mutate({ period, format, ...range });
  };
  return (
    <Card title="Demander un rapport">
      <form className="toolbar" onSubmit={onSubmit}>
        <SelectField label="Période" value={period} options={PERIODS} onChange={(e) => setPeriod(e.target.value as Period)} />
        <SelectField label="Format" value={format} options={FORMATS} onChange={(e) => setFormat(e.target.value as Report['format'])} />
        <Button type="submit" loading={mutation.isPending}>
          Générer
        </Button>
      </form>
    </Card>
  );
}

function ReportDownload({ report }: { report: Report }) {
  const { notify } = useToast();
  if (report.status !== 'ready') return <span className="caption">{report.status === 'failed' ? 'Indisponible' : 'En préparation'}</span>;
  if (!isDownloadableUrl(report.downloadUrl)) return <span className="caption">Lien indisponible</span>;
  const fileName = report.fileName ?? `rapport-${report.id}.${report.format}`;
  return (
    <div className="download-cell">
      <Button
        size="sm"
        variant="secondary"
        icon={<FileDown size={16} aria-hidden="true" />}
        onClick={() => {
          if (!downloadFile(report.downloadUrl, fileName)) notify('Téléchargement impossible.', 'error');
        }}
        aria-label={`Télécharger ${fileName}`}
      >
        Télécharger {report.format.toUpperCase()}
      </Button>
      <span className="caption download-cell__name">{fileName}</span>
    </div>
  );
}

export function ReportsPage() {
  const { can } = useAuth();
  const query = useReports();
  return (
    <div className="stack">
      <PageHeader title="Rapports" description="Synthèses hebdomadaires et mensuelles de la qualité de l'air." />
      {can('reports:generate') && <RequestReportForm />}
      <QueryState query={query} isEmpty={(list) => list.length === 0} emptyMessage="Aucun rapport pour l'instant.">
        {(reports) => (
          <DataTable
            caption="Rapports"
            rows={[...reports].sort((a, b) => (b.generatedAt ?? b.to).localeCompare(a.generatedAt ?? a.to))}
            rowKey={(r) => r.id}
            columns={[
              { key: 'period', header: 'Période', render: (r) => REPORT_PERIOD_LABELS[r.period] },
              { key: 'range', header: 'Couverture', render: (r) => `Du ${formatDateTime(r.from)} au ${formatDateTime(r.to)}` },
              { key: 'format', header: 'Format', render: (r) => r.format.toUpperCase() },
              { key: 'status', header: 'Statut', render: (r) => <Badge tone={STATUS_TONE[r.status]}>{REPORT_STATUS_LABELS[r.status]}</Badge> },
              { key: 'generated', header: 'Généré', render: (r) => formatDateTime(r.generatedAt) },
              {
                key: 'download',
                header: 'Fichier',
                render: (r) => <ReportDownload report={r} />,
              },
            ]}
          />
        )}
      </QueryState>
    </div>
  );
}
