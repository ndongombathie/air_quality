import { useState, type FormEvent } from 'react';
import { Download } from 'lucide-react';
import { formatDateTime, type ExportQuery } from '@senair/core';
import { useApi } from '../../shared/api/ApiProvider';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { CheckboxGroup, SelectField, TextField } from '../../shared/ui/Field';
import { PageHeader } from '../../shared/ui/PageHeader';
import { useFeedbackMutation } from '../../shared/hooks/useFeedbackMutation';
import type { FieldErrors } from '../../shared/lib/forms';
import { downloadFile } from '../../shared/lib/download';
import { useToast } from '../../shared/ui/Toast';
import { fromDateInput, lastDays, toDateInput } from '../../shared/lib/time';
import { useStations } from '../air-quality/hooks';

const DATASETS: { value: ExportQuery['dataset']; label: string }[] = [
  { value: 'readings', label: 'Mesures brutes' },
  { value: 'alerts', label: 'Alertes' },
  { value: 'forecasts', label: 'Prévisions' },
];
const FORMATS: { value: ExportQuery['format']; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
];
const MAX_DAYS = 366;

/** Pas de schéma d'export dans @senair/core : contrôle local des bornes de dates. */
function validateRange(from: string, to: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!from) errors.from = 'Date de début requise';
  if (!to) errors.to = 'Date de fin requise';
  if (from && to) {
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    if (days < 0) errors.to = 'La fin doit suivre le début';
    else if (days > MAX_DAYS) errors.to = `${MAX_DAYS} jours maximum`;
  }
  return errors;
}

export function ExportPage() {
  const api = useApi();
  const stations = useStations();
  const initial = lastDays(7);
  const [dataset, setDataset] = useState<ExportQuery['dataset']>('readings');
  const [format, setFormat] = useState<ExportQuery['format']>('csv');
  const [from, setFrom] = useState(toDateInput(initial.from));
  const [to, setTo] = useState(toDateInput(initial.to));
  const [stationIds, setStationIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const { notify } = useToast();
  const exporter = useFeedbackMutation({
    mutationFn: (query: ExportQuery) => api.admin.exportData(query),
    invalidate: [],
    successMessage: (link) => `Export prêt : ${link.fileName}`,
    // Téléchargement automatique dès que le fichier est prêt.
    onSuccess: (link) => {
      if (!downloadFile(link.downloadUrl, link.fileName)) notify('Le lien reçu ne peut pas être téléchargé.', 'error');
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found = validateRange(from, to);
    setErrors(found);
    if (Object.keys(found).length) return;
    exporter.mutate({ dataset, format, from: fromDateInput(from), to: fromDateInput(to, true), ...(stationIds.length ? { stationIds } : {}) });
  };

  return (
    <div className="stack">
      <PageHeader title="Export des données brutes" description="Fichier généré côté serveur, disponible via un lien temporaire. Chaque export est journalisé." />
      <Card title="Paramètres">
        <form onSubmit={onSubmit} noValidate className="stack stack--sm">
          <div className="grid grid--2">
            <SelectField label="Jeu de données" value={dataset} options={DATASETS} onChange={(e) => setDataset(e.target.value as ExportQuery['dataset'])} />
            <SelectField label="Format" value={format} options={FORMATS} onChange={(e) => setFormat(e.target.value as ExportQuery['format'])} />
          </div>
          <div className="grid grid--2">
            <TextField label="Du" type="date" value={from} onChange={(e) => setFrom(e.target.value)} error={errors.from} required />
            <TextField label="Au" type="date" value={to} onChange={(e) => setTo(e.target.value)} error={errors.to} required />
          </div>
          <CheckboxGroup
            legend="Stations"
            hint="Sans sélection : toutes les stations."
            options={(stations.data ?? []).map((s) => ({ value: s.id, label: s.shortName }))}
            value={stationIds}
            onChange={setStationIds}
          />
          <div>
            <Button type="submit" icon={<Download size={16} aria-hidden="true" />} loading={exporter.isPending}>
              Générer l'export
            </Button>
          </div>
        </form>
      </Card>
      {exporter.data && (
        <Card title="Fichier prêt">
          <p>
            <strong>{exporter.data.fileName}</strong>
          </p>
          <p className="small muted">Le téléchargement a démarré. Lien valable jusqu'au {formatDateTime(exporter.data.expiresAt)}.</p>
          <div>
            <Button
              variant="secondary"
              icon={<Download size={16} aria-hidden="true" />}
              onClick={() => {
                const link = exporter.data;
                if (link && !downloadFile(link.downloadUrl, link.fileName)) notify('Téléchargement impossible.', 'error');
              }}
            >
              Télécharger à nouveau
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
