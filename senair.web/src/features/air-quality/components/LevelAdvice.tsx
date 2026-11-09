import { Link } from 'react-router-dom';
import { HeartPulse } from 'lucide-react';
import type { AqiLevel } from '@senair/core';
import { resolveLevel } from '../../../shared/ui/aqi';

export function LevelAdvice({ aqi, level }: { aqi: number | null; level: AqiLevel | null }) {
  const info = resolveLevel(aqi, level);
  if (!info) return null;
  return (
    <div className="level-advice">
      <HeartPulse size={18} aria-hidden="true" />
      <p>
        {info.healthImpact} <Link to="/sante">Conseils selon votre profil</Link>
      </p>
    </div>
  );
}
