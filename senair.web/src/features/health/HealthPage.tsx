import { useState, type CSSProperties } from 'react';
import { ShieldAlert } from 'lucide-react';
import { AQI_LEVELS, aqiLevelRank, HEALTH_PROFILE_IDS, HEALTH_PROFILES, MEDICAL_DISCLAIMER, type HealthGuidance, type HealthProfileId } from '@senair/core';
import { PageHeader } from '../../shared/ui/PageHeader';
import { QueryState } from '../../shared/ui/QueryState';
import { AqiBadge } from '../../shared/ui/AqiBadge';
import { Card } from '../../shared/ui/Card';
import { cx } from '../../shared/lib/cx';
import { useAuth } from '../auth/AuthProvider';
import { useAirQualitySummary } from '../air-quality/hooks';
import { useHealthGuidance } from './hooks';

export function MedicalDisclaimer() {
  return (
    <aside className="disclaimer" role="note">
      <ShieldAlert size={18} aria-hidden="true" />
      <p>{MEDICAL_DISCLAIMER}</p>
    </aside>
  );
}

function ProfilePicker({ value, onChange }: { value: HealthProfileId; onChange: (id: HealthProfileId) => void }) {
  return (
    <fieldset className="fieldset">
      <legend className="field__label">Votre profil</legend>
      <div className="profile-grid">
        {HEALTH_PROFILE_IDS.map((id) => {
          const profile = HEALTH_PROFILES[id];
          return (
            <label key={id} className={cx('profile-option', value === id && 'profile-option--selected')}>
              <input type="radio" name="health-profile" value={id} checked={value === id} onChange={() => onChange(id)} />
              <span className="strong">{profile.label}</span>
              <span className="muted small">{profile.description}</span>
              {profile.sensitive && <span className="badge badge--warning">Sensible</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function GuidanceCard({ guidance, current }: { guidance: HealthGuidance; current: boolean }) {
  return (
    <article className={cx('guidance', current && 'guidance--current')} style={{ '--level-color': AQI_LEVELS[guidance.level].color } as CSSProperties}>
      <header className="guidance__header">
        <AqiBadge aqi={null} level={guidance.level} labelOnly size="sm" />
        {current && <span className="badge badge--info">Niveau actuel</span>}
      </header>
      <h3 className="guidance__title">{guidance.title}</h3>
      <ul>
        {guidance.actions.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ul>
    </article>
  );
}

export function HealthPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<HealthProfileId>(user?.healthProfile ?? 'general');
  const summary = useAirQualitySummary();
  const guidance = useHealthGuidance(profile);
  const currentLevel = summary.data?.level ?? null;

  return (
    <div className="stack">
      <PageHeader title="Santé et recommandations" description="Conseils adaptés à votre profil et au niveau actuel de la qualité de l'air." />
      <MedicalDisclaimer />
      {summary.data && (
        <p>
          Qualité de l'air actuelle à Thiès : <AqiBadge aqi={summary.data.aqi} level={summary.data.level} size="sm" />
        </p>
      )}
      <ProfilePicker value={profile} onChange={setProfile} />
      <Card title={`Recommandations : ${HEALTH_PROFILES[profile].label.toLowerCase()}`}>
        <QueryState query={guidance} isEmpty={(list) => list.length === 0} emptyMessage="Aucune recommandation pour ce profil.">
          {(list) => (
            <div className="stack stack--sm">
              {[...list]
                .sort((a, b) => aqiLevelRank(a.level) - aqiLevelRank(b.level))
                .map((item) => (
                  <GuidanceCard key={`${item.profile}-${item.level}`} guidance={item} current={item.level === currentLevel} />
                ))}
            </div>
          )}
        </QueryState>
      </Card>
      <MedicalDisclaimer />
    </div>
  );
}
