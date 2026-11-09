export const HEALTH_PROFILE_IDS = [
  'general',
  'children',
  'elderly',
  'asthma',
  'cardiac',
  'pregnant',
  'outdoor_worker',
  'athlete',
] as const;

export type HealthProfileId = (typeof HEALTH_PROFILE_IDS)[number];

export interface HealthProfileInfo {
  id: HealthProfileId;
  label: string;
  description: string;
  /** Profil plus vulnérable : les recommandations se déclenchent dès le niveau « Modéré ». */
  sensitive: boolean;
}

export const HEALTH_PROFILES: Readonly<Record<HealthProfileId, HealthProfileInfo>> = {
  general: { id: 'general', label: 'Adulte en bonne santé', description: 'Population générale', sensitive: false },
  children: { id: 'children', label: 'Enfant', description: 'Moins de 12 ans', sensitive: true },
  elderly: { id: 'elderly', label: 'Personne âgée', description: 'Plus de 65 ans', sensitive: true },
  asthma: { id: 'asthma', label: 'Personne asthmatique', description: 'Maladies respiratoires', sensitive: true },
  cardiac: { id: 'cardiac', label: 'Personne cardiaque', description: 'Maladies cardiovasculaires', sensitive: true },
  pregnant: { id: 'pregnant', label: 'Femme enceinte', description: 'Grossesse', sensitive: true },
  outdoor_worker: {
    id: 'outdoor_worker',
    label: 'Travailleur en extérieur',
    description: 'Exposition professionnelle',
    sensitive: false,
  },
  athlete: { id: 'athlete', label: 'Sportif', description: 'Activité physique intense', sensitive: false },
};

export const MEDICAL_DISCLAIMER =
  "Ces conseils sont informatifs et ne remplacent pas l'avis d'un professionnel de santé. En cas de symptômes, consultez un médecin.";
