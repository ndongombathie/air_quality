# 07. PWA, mobile et mode dégradé

Thiès connaît des connexions 3G/4G variables : l'application doit rester **utile hors ligne** et **honnête** sur l'âge des données.

## 1. PWA (`senair.web`)

| Élément | Choix |
|---|---|
| Outil | `vite-plugin-pwa` (Workbox) |
| Manifest | nom « SEN-AIR, qualité de l'air à Thiès », `short_name` SEN-AIR, `lang` fr, `display` standalone, `theme_color` #2F98DE, icônes 192/512 + maskable |
| Mise à jour | `registerType: 'prompt'` : un message propose « Nouvelle version disponible. Recharger » (pas de rechargement surprise pendant une saisie) |
| App shell | précache des assets du build (HTML, JS, CSS, polices, icônes) |
| Données publiques | `NetworkFirst` (délai ~4 s) puis cache, expiration courte : `/stations`, `/air-quality`, `/forecasts`, `/alerts`, `/articles`, `/thresholds`, `/health-guidance`, `/zones`, `/metadata` |
| Données privées | **jamais en cache** : `/auth`, `/me`, `/admin` |
| Tuiles de carte | `CacheFirst`, nombre d'entrées limité (respect de la politique d'usage OSM) |
| Indicateur | bannière « Hors ligne, dernières données connues » + badge de fraîcheur sur chaque mesure |
| Installabilité | HTTPS, manifest, service worker ; invitation d'installation discrète |

## 2. Mobile (`senair.mobile`)

| Sujet | Choix |
|---|---|
| Cache | TanStack Query (données conservées pendant la session, rafraîchissement au retour au premier plan et par « tirer pour actualiser ») |
| Carte | WebView Leaflet + OSM ; liste des stations en repli si la carte ne charge pas |
| Géolocalisation | `expo-location`, premier plan uniquement, au clic sur « Ma position » ; repli sur l'IQA de la ville |
| Push | `expo-notifications` ; jeton enregistré via `POST /me/devices` ; ouverture de l'alerte au toucher |
| Stockage sécurisé | `expo-secure-store` pour le refresh token |
| Distribution | EAS Build (APK/AAB Android, IPA iOS), mises à jour OTA possibles via EAS Update |

## 3. Règles d'affichage en mode dégradé

| Situation | Affichage |
|---|---|
| Mesure ≤ 15 min | normal, « il y a 5 min » |
| 15 min à 2 h | badge orange « Données en retard » |
| > 2 h | badge rouge « Données anciennes », valeurs grisées |
| Station hors ligne / maintenance | marqueur gris, libellé du statut, pas d'IQA |
| Valeur manquante | « N/D » (jamais 0) |
| Prévision indisponible | « Prévision indisponible » (jamais une estimation locale) |
| Mode démonstration | bandeau permanent « Données de démonstration » |
| Erreur réseau | message clair + « Réessayer » ; données en cache si disponibles |

## 4. Performance (objectif CDC : carte < 3 s)

- Routes chargées à la demande (carte, back-office) ; bibliothèque de carte isolée dans son propre chunk.
- Requêtes parallèles, `staleTime` adapté (1 à 5 min pour les mesures), pas de sondage agressif.
- Heatmap à résolution adaptée au zoom (`resolutionM`), `bbox` limitée à la vue.
- Images d'articles en `loading="lazy"`.
