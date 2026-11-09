import { describe, expect, it } from 'vitest';
import type { AuditLogEntry } from '@senair/core';
import { actorName, dayLabel, formatAudit } from '../features/admin/auditFormat';

const entry = (over: Partial<AuditLogEntry>): AuditLogEntry => ({
  id: 'a1',
  at: '2026-11-03T01:51:00Z',
  actorId: 'u1',
  actorEmail: 'admin@senair.sn',
  action: 'alert.update',
  resource: 'alert',
  resourceId: '13c09a67-cde3-4b38-9342-5d2b9719efec',
  changes: null,
  ip: '127.0.0.1',
  ...over,
});

describe('formatAudit', () => {
  it('raconte une prise en charge d’alerte et masque les champs techniques', () => {
    const view = formatAudit(
      entry({
        changes: {
          status: { from: 'active', to: 'acknowledged' },
          handledById: { from: null, to: '82988756-c67e' },
          acknowledgedAt: { from: null, to: '2026-11-03T01:51:38.025767+00:00' },
        },
      }),
    );
    expect(view.sentence).toBe('a pris en charge une alerte');
    expect(view.resourceLabel).toBe('Alerte');
    expect(view.highlights).toEqual([{ field: 'status', label: 'Statut', from: 'En cours', to: 'Prise en charge' }]);
    expect(view.changes).toHaveLength(3);
  });

  it('raconte la publication et la suppression manuelles d’une alerte', () => {
    expect(formatAudit(entry({ action: 'alert.create' }))).toMatchObject({ sentence: 'a publié une alerte', tone: 'success' });
    expect(formatAudit(entry({ action: 'alert.delete' }))).toMatchObject({ sentence: 'a supprimé une alerte', tone: 'danger' });
  });

  it('présente un export comme des paramètres, sans « N/D devient »', () => {
    const view = formatAudit(
      entry({
        action: 'data.export',
        resource: 'export',
        resourceId: 'readings',
        changes: { dataset: { from: null, to: 'readings' }, format: { from: null, to: 'csv' }, rows: { from: null, to: 98 } },
      }),
    );
    expect(view.sentence).toBe('a exporté des données');
    expect(view.highlights.map((c) => [c.label, c.from, c.to])).toEqual([
      ['Données', null, 'Mesures'],
      ['Format', null, 'CSV'],
      ['Lignes', null, '98'],
    ]);
  });

  it('nomme une action système et regroupe par jour', () => {
    expect(actorName(entry({ actorEmail: '', actorId: null }))).toBe('Tâche planifiée');
    const now = new Date('2026-11-03T10:00:00');
    expect(dayLabel('2026-11-03T08:00:00', now)).toBe("Aujourd'hui");
    expect(dayLabel('2026-11-02T08:00:00', now)).toBe('Hier');
  });
});
