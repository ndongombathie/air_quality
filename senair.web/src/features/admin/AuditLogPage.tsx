import { useMemo, useState } from 'react';
import type { AuditLogEntry } from '@senair/core';
import { Button } from '../../shared/ui/Button';
import { SelectField } from '../../shared/ui/Field';
import { PageHeader } from '../../shared/ui/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../shared/ui/QueryState';
import { cx } from '../../shared/lib/cx';
import { AUDIT_RESOURCES, actorName, dayLabel, formatAudit, timeLabel, type AuditChange } from './auditFormat';
import { useAuditLogs } from './hooks';

function ChangeLine({ change }: { change: AuditChange }) {
  return (
    <li>
      <span className="audit-change__label">{change.label}</span>
      {change.from !== null && change.to !== null ? (
        <>
          <span className="audit-change__old">{change.from}</span>
          <span aria-hidden="true">→</span>
          <span className="sr-only">devient</span>
          <strong>{change.to}</strong>
        </>
      ) : (
        <strong>{change.to ?? change.from}</strong>
      )}
    </li>
  );
}

function AuditItem({ entry }: { entry: AuditLogEntry }) {
  const view = formatAudit(entry);
  return (
    <li className={cx('audit-item', `audit-item--${view.tone}`)}>
      <span className="audit-item__dot" aria-hidden="true" />
      <div className="audit-item__body">
        <p className="audit-item__head">
          <span>
            <strong>{actorName(entry)}</strong> {view.sentence}
          </span>
          <span className="audit-item__meta">
            <span className="badge badge--neutral">{view.resourceLabel}</span>
            <time dateTime={entry.at}>{timeLabel(entry.at)}</time>
          </span>
        </p>
        {view.highlights.length > 0 && (
          <ul className="audit-item__changes">
            {view.highlights.map((change) => (
              <ChangeLine key={change.field} change={change} />
            ))}
          </ul>
        )}
        <details className="audit-item__details">
          <summary>Détails</summary>
          <dl>
            {entry.resourceId && (
              <>
                <dt>Identifiant</dt>
                <dd>
                  <code>{entry.resourceId}</code>
                </dd>
              </>
            )}
            <dt>Action</dt>
            <dd>
              <code>{entry.action}</code>
            </dd>
            <dt>Adresse IP</dt>
            <dd>{entry.ip ?? 'N/D'}</dd>
            {view.changes.map((change) => (
              <div key={change.field} className="audit-item__detail-row">
                <dt>{change.label}</dt>
                <dd>{change.from !== null && change.to !== null ? `${change.from} → ${change.to}` : (change.to ?? change.from ?? 'N/D')}</dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </li>
  );
}

/** Regroupe les entrées par jour, dans l'ordre reçu (le plus récent d'abord). */
function groupByDay(entries: AuditLogEntry[]): { day: string; entries: AuditLogEntry[] }[] {
  const groups: { day: string; entries: AuditLogEntry[] }[] = [];
  for (const entry of entries) {
    const day = dayLabel(entry.at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.entries.push(entry);
    else groups.push({ day, entries: [entry] });
  }
  return groups;
}

export function AuditLogPage() {
  const [resource, setResource] = useState('');
  const query = useAuditLogs(resource ? { resource } : {});
  const entries = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const groups = useMemo(() => groupByDay(entries), [entries]);

  return (
    <div className="stack">
      <PageHeader title="Journal d'audit" description="Qui a fait quoi, et quand, dans l'administration." />
      <form className="toolbar" role="search" onSubmit={(e) => e.preventDefault()}>
        <SelectField label="Type" value={resource} placeholder="Toutes les actions" options={AUDIT_RESOURCES} onChange={(e) => setResource(e.target.value)} />
      </form>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState message="Aucune action enregistrée pour ce type." />
      ) : (
        <div className="card audit">
          {groups.map((group) => (
            <section key={group.day} className="audit-day" aria-label={group.day}>
              <h2 className="audit-day__title">{group.day}</h2>
              <ol className="audit-list">
                {group.entries.map((entry) => (
                  <AuditItem key={entry.id} entry={entry} />
                ))}
              </ol>
            </section>
          ))}
          {query.hasNextPage && (
            <div className="audit__more">
              <Button variant="secondary" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
                Afficher plus
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
