/**
 * Données de démonstration. Les 9 stations et leurs coordonnées sont celles du réseau AirGradient de Thiès ;
 * toutes les valeurs mesurées sont SIMULÉES et marquées `status: 'mock'`.
 */
import type { AqiLevel } from '../domain/aqi';
import { HEALTH_PROFILE_IDS, MEDICAL_DISCLAIMER, type HealthProfileId } from '../domain/health';
import { AQI_LEVEL_IDS } from '../domain/aqi';
import type { AiModel, Article, DataSource, HealthGuidance, Station, Threshold, User, Zone } from '../api/types';
import { REFERENCE_THRESHOLDS } from '../domain/thresholds';

interface StationSeed {
  id: string;
  name: string;
  shortName: string;
  zone: string;
  lat: number;
  lon: number;
  type: Station['type'];
  /** Niveau moyen de pollution simulé pour la station. */
  baseAqi: number;
}

const STATION_SEEDS: StationSeed[] = [
  { id: '89441', name: 'Université Iba Der Thiam', shortName: 'Univ. Iba Der Thiam', zone: 'Université', lat: 14.794498, lon: -16.961054, type: 'residential', baseAqi: 55 },
  { id: '166062', name: 'École élémentaire Sud Stade', shortName: 'Sud Stade', zone: 'Sud Stade', lat: 14.767584, lon: -16.943625, type: 'residential', baseAqi: 62 },
  { id: '168373', name: 'Hôtel de Ville', shortName: 'Hôtel de Ville', zone: 'Centre-ville', lat: 14.791343, lon: -16.924869, type: 'road', baseAqi: 128 },
  { id: '168377', name: 'Lycée Malick Sy', shortName: 'Lycée Malick Sy', zone: 'Malick Sy', lat: 14.784821, lon: -16.93947, type: 'residential', baseAqi: 74 },
  { id: '168388', name: 'Lycée Jules Sagna', shortName: 'Jules Sagna', zone: 'Jules Sagna', lat: 14.796931, lon: -16.927132, type: 'road', baseAqi: 96 },
  { id: '168393', name: 'Lycée Médina Fall', shortName: 'Médina Fall', zone: 'Médina Fall', lat: 14.800603, lon: -16.907473, type: 'industrial', baseAqi: 112 },
  { id: '168394', name: 'École élémentaire Kaba Sall', shortName: 'Kaba Sall', zone: 'Kaba Sall', lat: 14.777709, lon: -16.91475, type: 'residential', baseAqi: 68 },
  { id: '168397', name: 'Collège Cité Lamy', shortName: 'Cité Lamy', zone: 'Cité Lamy', lat: 14.775552, lon: -16.931766, type: 'residential', baseAqi: 58 },
  { id: '168401', name: 'Lycée de Fahu', shortName: 'Fahu', zone: 'Fahu', lat: 14.765215, lon: -16.944521, type: 'residential', baseAqi: 45 },
];

export const zoneIdOf = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export const MOCK_STATIONS: (Omit<Station, 'lastObservedAt' | 'latest'> & { baseAqi: number })[] = STATION_SEEDS.map((s) => ({
  id: s.id,
  externalId: s.id,
  name: s.name,
  shortName: s.shortName,
  zoneId: zoneIdOf(s.zone),
  zoneName: s.zone,
  location: { latitude: s.lat, longitude: s.lon },
  type: s.type,
  status: s.id === '168401' ? 'maintenance' : 'online',
  provider: 'AirGradient',
  baseAqi: s.baseAqi,
}));

export const MOCK_ZONES: Zone[] = MOCK_STATIONS.map((s) => ({ id: s.zoneId, name: s.zoneName, centroid: s.location }));

export const THIES_CENTER = { latitude: 14.7885, longitude: -16.926 } as const;

const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const H = 3_600_000;
const D = 24 * H;

export function createMockThresholds(): Threshold[] {
  return REFERENCE_THRESHOLDS.filter((t) => t.period !== '1y').map((t, index) => ({
    id: `thr-${index + 1}`,
    pollutant: t.pollutant,
    reference: t.reference,
    period: t.period,
    value: t.value,
    unit: t.unit,
    zoneId: null,
    alertLevel: t.reference === 'WHO_2021' ? 'unhealthy_sensitive' : 'unhealthy',
    enabled: true,
    updatedAt: iso(30 * D),
    updatedBy: 'admin@senair.sn',
  }));
}

export function createMockArticles(): Article[] {
  const author = (name: string, role: string) => ({ id: null, name, role });
  return [
    {
      id: 'art-1',
      slug: 'pic-pollution-hotel-de-ville',
      title: "Pic de particules fines à l'Hôtel de Ville",
      excerpt: 'Une forte concentration de PM2.5 a été mesurée au centre-ville. Les personnes sensibles sont invitées à limiter leurs sorties.',
      content:
        "## Que se passe-t-il ?\n\nLa station **Hôtel de Ville** enregistre depuis ce matin des concentrations de PM2.5 supérieures au seuil OMS de 15 µg/m³ (moyenne 24 h).\n\n## Recommandations\n\n- Limitez les efforts physiques en extérieur\n- Aérez tôt le matin (entre 6 h et 8 h)\n- Les personnes asthmatiques gardent leur traitement à portée de main",
      category: 'alert',
      status: 'published',
      featured: true,
      coverImageUrl: null,
      media: [],
      tags: ['pm25', 'centre-ville'],
      author: author('Direction de la Santé de Thiès', 'Autorité sanitaire'),
      publishedAt: iso(2 * H),
      createdAt: iso(3 * H),
      updatedAt: iso(2 * H),
    },
    {
      id: 'art-2',
      slug: 'harmattan-comprendre-les-poussieres',
      title: "Harmattan : comprendre les épisodes de poussières",
      excerpt: "De novembre à mai, l'harmattan transporte des poussières sahariennes qui font grimper les PM10.",
      content:
        "## L'harmattan\n\nVent sec et chaud venu du Sahara, il soulève de grandes quantités de poussières.\n\n## Effets\n\nLes PM10 peuvent dépasser plusieurs fois la valeur guide OMS (45 µg/m³ sur 24 h).\n\n## Se protéger\n\n- Fermer les fenêtres aux heures de vent fort\n- Porter un masque en tissu épais ou FFP2 à l'extérieur",
      category: 'education',
      status: 'published',
      featured: false,
      coverImageUrl: null,
      media: [],
      tags: ['pm10', 'harmattan'],
      author: author('Équipe SEN-AIR', 'Rédaction'),
      publishedAt: iso(2 * D),
      createdAt: iso(3 * D),
      updatedAt: iso(2 * D),
    },
    {
      id: 'art-3',
      slug: 'rapport-mensuel-octobre-2026',
      title: "Rapport mensuel de qualité de l'air : octobre 2026",
      excerpt: 'Synthèse des mesures des 9 stations de Thiès, dépassements de seuils et tendances.',
      content:
        "## Synthèse\n\nIQA moyen mensuel : **modéré**. La station Hôtel de Ville reste la plus exposée (trafic).\n\n## Dépassements\n\n- PM2.5 : 6 jours au-dessus du seuil OMS\n- PM10 : 3 jours au-dessus de la norme NS 05-062",
      category: 'report',
      status: 'published',
      featured: false,
      coverImageUrl: null,
      media: [],
      tags: ['rapport', 'mensuel'],
      author: author('Équipe SEN-AIR', 'Analyste'),
      publishedAt: iso(4 * D),
      createdAt: iso(5 * D),
      updatedAt: iso(4 * D),
    },
    {
      id: 'art-4',
      slug: 'normes-oms-2021',
      title: 'Normes OMS 2021 et norme sénégalaise NS 05-062',
      excerpt: 'Ce que signifient les valeurs guides et comment SEN-AIR les utilise pour vous alerter.',
      content:
        "## Deux référentiels\n\nSEN-AIR compare chaque mesure aux **valeurs guides OMS 2021** et à la **norme sénégalaise NS 05-062**.\n\n## Pourquoi deux ?\n\nL'OMS fixe un objectif sanitaire ; la norme nationale fixe le cadre réglementaire.",
      category: 'regulation',
      status: 'published',
      featured: false,
      coverImageUrl: null,
      media: [],
      tags: ['oms', 'normes'],
      author: author('Équipe SEN-AIR', 'Rédaction'),
      publishedAt: iso(10 * D),
      createdAt: iso(11 * D),
      updatedAt: iso(10 * D),
    },
    {
      id: 'art-5',
      slug: 'journee-sensibilisation-qualite-air',
      title: "Journée de sensibilisation à la qualité de l'air",
      excerpt: "Une journée d'ateliers est prévue à l'Université Iba Der Thiam.",
      content: "## Programme\n\n- 9 h : présentation du réseau SEN-AIR\n- 10 h : ateliers santé\n- 14 h : démonstration des capteurs",
      category: 'event',
      status: 'draft',
      featured: false,
      coverImageUrl: null,
      media: [],
      tags: ['événement'],
      author: author('Équipe SEN-AIR', 'Rédaction'),
      publishedAt: null,
      createdAt: iso(5 * H),
      updatedAt: iso(5 * H),
    },
  ];
}

const GUIDANCE_BY_LEVEL: Record<AqiLevel, { title: string; actions: string[] }> = {
  good: {
    title: "Qualité de l'air idéale",
    actions: ['Profitez des activités en plein air', 'Aérez votre logement', 'Aucune précaution particulière'],
  },
  moderate: {
    title: "Qualité de l'air acceptable",
    actions: ['Activités extérieures possibles', 'Aérez en début de journée', 'Restez attentif si vous êtes sensible'],
  },
  unhealthy_sensitive: {
    title: 'Prudence recommandée',
    actions: ['Limitez les efforts intenses en extérieur', "Privilégiez l'activité en intérieur", 'Aérez tôt le matin (entre 6 h et 8 h)'],
  },
  unhealthy: {
    title: "Évitez l'extérieur",
    actions: ["Restez à l'intérieur autant que possible", 'Fermez portes et fenêtres', 'Portez un masque FFP2 si vous sortez'],
  },
  very_unhealthy: {
    title: 'Alerte sanitaire',
    actions: ["Restez impérativement à l'intérieur", 'Évitez toute activité physique', 'Portez un masque FFP2 pour toute sortie'],
  },
  hazardous: {
    title: "Conditions d'urgence",
    actions: ['Ne sortez pas', 'Calfeutrez le logement', 'Contactez un médecin au moindre symptôme'],
  },
};

const PROFILE_EXTRA: Partial<Record<HealthProfileId, string>> = {
  children: 'Suspendez les jeux et le sport en extérieur ; surveillez toux et gêne respiratoire.',
  elderly: 'Évitez les sorties aux heures chaudes et de trafic.',
  asthma: 'Gardez votre bronchodilatateur à portée de main ; consultez en cas de crise.',
  cardiac: 'Évitez les efforts ; surveillez tension et rythme cardiaque.',
  pregnant: 'Limitez le temps passé près des axes routiers.',
  outdoor_worker: 'Faites des pauses en intérieur toutes les 2 heures et portez un masque FFP2.',
  athlete: "Réduisez l'intensité ou entraînez-vous en salle.",
};

export function createMockGuidance(): HealthGuidance[] {
  return HEALTH_PROFILE_IDS.flatMap((profile) =>
    AQI_LEVEL_IDS.map((level) => {
      const base = GUIDANCE_BY_LEVEL[level];
      const extra = level !== 'good' ? PROFILE_EXTRA[profile] : undefined;
      return {
        profile,
        level,
        title: base.title,
        actions: extra ? [extra, ...base.actions] : base.actions,
        disclaimer: MEDICAL_DISCLAIMER,
      };
    }),
  );
}

export function createMockDataSources(): DataSource[] {
  return [
    { id: 'src-airgradient', name: 'Capteurs AirGradient (9 stations)', kind: 'sensor_network', status: 'degraded', enabled: true, lastSyncAt: iso(4 * 60_000), rejectionRate24h: 0.032, description: 'PM2.5, PM10, CO₂, COV, température et humidité, via MQTT/HTTP et Kafka.' },
    { id: 'src-owm', name: 'OpenWeatherMap', kind: 'weather_api', status: 'healthy', enabled: true, lastSyncAt: iso(10 * 60_000), rejectionRate24h: 0, description: 'Gaz (CO, NO, NO₂, SO₂, O₃, NH₃) et vent à l’échelle de la ville, température, pression, précipitations.' },
    { id: 'src-s5p', name: 'Sentinel-5P TROPOMI', kind: 'satellite', status: 'healthy', enabled: false, lastSyncAt: iso(D), rejectionRate24h: null, description: 'Colonnes NO₂, SO₂, CO, O₃, mises à jour chaque jour.' },
    { id: 'src-history', name: 'Historique air_quality.csv', kind: 'dataset', status: 'healthy', enabled: true, lastSyncAt: iso(20 * D), rejectionRate24h: null, description: "Archive d'entraînement des modèles." },
  ];
}

export function createMockModels(): AiModel[] {
  return [
    { id: 'mdl-xgb', name: 'Prévision IQA court et moyen terme', task: 'forecast', algorithm: 'XGBoost', version: '1.3.0', status: 'active', metrics: { r2: 0.82, rmse: 9.4, mae: 6.8 }, trainedAt: iso(6 * D), trackingUrl: null },
    { id: 'mdl-lstm', name: 'Prévision J+3 (séries longues)', task: 'forecast', algorithm: 'LSTM', version: '0.4.0', status: 'candidate', metrics: { r2: 0.76, rmse: 11.2, mae: 8.1 }, trainedAt: iso(3 * D), trackingUrl: null },
    { id: 'mdl-krig', name: 'Interpolation spatiale PM2.5/PM10', task: 'interpolation', algorithm: 'Krigeage ordinaire + Random Forest', version: '1.1.0', status: 'active', metrics: { r2: 0.79, rmse: 7.9, mae: 5.6 }, trainedAt: iso(9 * D), trackingUrl: null },
    { id: 'mdl-gb', name: 'Dépassement de seuil OMS', task: 'classification', algorithm: 'Gradient Boosting', version: '1.0.2', status: 'active', metrics: { r2: null, rmse: null, mae: null }, trainedAt: iso(12 * D), trackingUrl: null },
  ];
}

/** Comptes de démonstration — mode mock uniquement. Mot de passe commun : MOCK_PASSWORD. */
export const MOCK_PASSWORD = 'Demo2026!';
export const MOCK_OTP = '123456';

export function createMockUsers(): User[] {
  const base = { status: 'active' as const, createdAt: iso(60 * D), lastLoginAt: iso(D) };
  return [
    { ...base, id: 'usr-citizen', email: 'citoyen@senair.sn', fullName: 'Awa Ndiaye', role: 'citizen', zoneIds: ['centre-ville'], healthProfile: 'asthma', mfaEnabled: false },
    { ...base, id: 'usr-authority', email: 'autorite@senair.sn', fullName: 'Dr Mamadou Sarr', role: 'authority', zoneIds: [], healthProfile: null, mfaEnabled: true },
    { ...base, id: 'usr-admin', email: 'admin@senair.sn', fullName: 'Fatou Diop', role: 'admin', zoneIds: [], healthProfile: null, mfaEnabled: true },
    { ...base, id: 'usr-4', email: 'ibrahima.fall@example.sn', fullName: 'Ibrahima Fall', role: 'citizen', zoneIds: ['medina-fall'], healthProfile: 'general', mfaEnabled: false },
    { ...base, id: 'usr-5', email: 'khady.ba@example.sn', fullName: 'Khady Ba', role: 'citizen', zoneIds: ['sud-stade'], healthProfile: 'children', mfaEnabled: false, status: 'pending', lastLoginAt: null },
  ];
}
