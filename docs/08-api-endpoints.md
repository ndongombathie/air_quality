# 08. Endpoints attendus du backend

> **Destinataires : équipe backend (Django / DRF).**
> Ce document liste tout ce dont `senair.web` et `senair.mobile` ont besoin. La spécification machine (à importer dans Swagger UI / drf-spectacular) est [api/openapi.yaml](./api/openapi.yaml). Le contrat côté front est codé dans [packages/core/src/api](../packages/core/src/api) : `types.ts` (schémas), `endpoints.ts` (chemins), `contracts.ts` (opérations). **Les trois doivent rester alignés** : toute évolution passe par une PR qui modifie les trois.

## 1. Conventions communes

| Sujet | Règle |
|---|---|
| Base | `https://<hôte>/api/v1`, versionnement dans l'URL ; rupture de contrat ⇒ `/api/v2` |
| Format | JSON UTF-8, **clés en camelCase** (ex. `djangorestframework-camel-case`) |
| Dates | ISO-8601 **UTC** avec `Z` (`2026-11-02T14:00:00Z`) |
| Valeur absente | `null`, **jamais 0** ni chaîne vide (le front affiche « N/D ») |
| Listes évolutives | Pagination par curseur : `?cursor=&limit=` → `{ "items": [...], "nextCursor": "…" \| null, "total"?: n }` (limit max 100, défaut 20) |
| Tableaux en query | Valeurs séparées par des virgules : `?status=active,acknowledged` |
| Erreurs | `{ "code": "slug_taken", "message": "…", "details"?: { "fields": { "slug": "…" } }, "requestId": "…" }` |
| Codes HTTP | 200/201/204 ; 400/422 validation ; 401 non authentifié ; 403 interdit ; 404 ; 409 conflit ; 429 limite ; 5xx |
| Corrélation | En-tête `X-Request-Id` en réponse (et `requestId` dans le corps d'erreur) |
| Cache | `ETag` + `Cache-Control: public, max-age=60` sur les lectures publiques ; `Cache-Control: no-store` sur `/auth`, `/me`, `/admin` |
| Provenance | Chaque mesure / agrégat porte `status` : `measured` \| `estimated` \| `forecast` et `observedAt` ; `freshness` : `fresh` (≤ 15 min) \| `stale` (≤ 2 h) \| `outdated` \| `unknown` |
| Provenance par variable | chaque `Measure` porte `source` : `sensor` (capteur de la station), `openweathermap` (échelle ville), `satellite`, `model` |
| IQA | **Calculé par le backend** : sous-indice = concentration / valeur limite × 100 ; IQA station = max des sous-indices ; IQA zone/ville = max des stations (présentation §8). Le front ne recalcule rien |
| Énumérations | voir § 6 |
| Performance (CDC) | p95 < 500 ms ; 5 000 utilisateurs simultanés |

### Authentification

- **JWT** court (`accessToken`, 15 min) envoyé en `Authorization: Bearer …`.
- **Refresh token** rotatif (révocation au logout, détection de réutilisation) :
  - **Web** : cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`, jamais dans le corps. CORS : origines explicites + `Access-Control-Allow-Credentials: true`. Protection CSRF sur `/auth/refresh` et `/auth/logout` (SameSite strict + vérification `Origin`).
  - **Mobile** (en-tête `X-Client: senair-mobile`) : `refreshToken` renvoyé dans le corps, stocké dans le trousseau (SecureStore).
- **MFA TOTP obligatoire** pour les rôles `authority` et `admin` (CDC : « authentification forte »).
- Mots de passe hachés **bcrypt/argon2** ; verrouillage progressif après échecs ; rate limiting sur `/auth/*`.
- Les permissions sont calculées **côté serveur depuis le rôle** et renvoyées par `GET /me` ; le front ne fait que masquer l'interface.

### Rôles et permissions

| Permission | citizen | authority | admin |
|---|:-:|:-:|:-:|
| `profile:manage`, `notifications:manage` | ✓ | ✓ | ✓ |
| `admin:access`, `alerts:manage`, `articles:manage`, `reports:read`, `reports:generate`, `analytics:read` | | ✓ | ✓ |
| `stations:manage`, `thresholds:manage`, `sources:manage`, `models:manage`, `users:manage`, `audit:read`, `data:export_raw` | | | ✓ |

Source : [packages/core/src/auth/permissions.ts](../packages/core/src/auth/permissions.ts).

## 2. Lecture publique (sans compte)

| # | Méthode | Chemin | Paramètres | Réponse | Utilisé par |
|---|---|---|---|---|---|
| P1 | GET | `/metadata` | aucun | `ApiMetadata` (version API, date des données, modèles actifs, référentiels) | pied de page, « à propos » |
| P2 | GET | `/zones` | aucun | `Zone[]` (id, nom, centroïde, `geometry` GeoJSON optionnel) | filtres, inscription, préférences |
| P3 | GET | `/stations` | `zoneId`, `type`, `include=latest` | `Station[]` (+ `latest: AirQualitySnapshot` si demandé) | carte, accueil |
| P4 | GET | `/stations/{stationId}` | aucun | `Station` avec `latest` | détail station |
| P5 | GET | `/stations/{stationId}/latest` | aucun | `AirQualitySnapshot` (IQA, niveau, polluant dominant, mesures + sous-indices, météo, fraîcheur) | détail station |
| P6 | GET | `/stations/{stationId}/history` | `from`, `to`, `granularity=raw\|hour\|day`, `pollutants=pm25,pm10` | `History` (points `{at, aqi, values}`) | graphes 24 h / 7 j / mois |
| P7 | GET | `/air-quality/summary` | `zoneId` (sinon ville) | `AirQualitySummary` (IQA, niveau, comparaisons vs hier / semaine dernière, `worstZones`, stations remontantes/total) | accueil (widget principal), tableau de bord |
| P8 | GET | `/air-quality/at` | `lat`, `lon` | `LocationAirQuality` (IQA estimé au point, zone, station la plus proche, distance, `confidence`) | « IQA de ma position » (mobile) |
| P9 | GET | `/air-quality/heatmap` | `layer=aqi\|pm25\|pm10\|no2\|so2\|co\|o3`, `at`, `bbox=minLon,minLat,maxLon,maxLat`, `resolutionM` | `Heatmap` (cellules `{location, value, aqi, level, uncertainty}`, méthode, version modèle) | couches de la carte |
| P10 | GET | `/zones/{zoneId}/history` | comme P6 | `History` | page zone |
| P11 | GET | `/forecasts` | `scope=city\|zone\|station`, `scopeId`, `horizons=1h,2h,3h,1d,2d,3d` | `ForecastSet` (modèle, version, `generatedAt`, prévisions avec `confidence`, `interval`, `trend`, `drivers`) | accueil, page prévisions, couche carte |
| P12 | GET | `/alerts` | `status`, `severity`, `pollutant`, `zoneId`, `from`, `to`, `cursor`, `limit` | `Page<Alert>` (**sans** `incidentNote` ni `handledBy`) | écran alertes, bannière |
| P13 | GET | `/alerts/{alertId}` | aucun | `Alert` public | détail / lien de notification push |
| P14 | GET | `/thresholds` | aucun | `Threshold[]` actifs | affichage des seuils, contexte des alertes |
| P15 | GET | `/health-guidance` | `profile`, `level` | `HealthGuidance[]` (titre, actions, `disclaimer`) | écran santé, alertes |
| P16 | GET | `/articles` | `category`, `featured`, `search`, `cursor`, `limit` | `Page<ArticleSummary>` (publiés uniquement) | actualités, infos |
| P17 | GET | `/articles/{slug}` | aucun | `Article` (contenu **Markdown**, le HTML brut sera ignoré par le front) | lecture d'article |
| P18 | GET | `/air-quality/history` | comme P6 | `History` (`scope: city` ; IQA ville = max des stations à chaque pas) | graphe 24 h / 7 j de l'accueil |

> Horizons : on utilise `1d/2d/3d` (affichés J+1/J+2/J+3) car `+` est décodé en espace dans une URL.

## 3. Authentification

| # | Méthode | Chemin | Corps | Réponse | Notes |
|---|---|---|---|---|---|
| A1 | POST | `/auth/register` | `RegisterRequest` (email, password, fullName, zoneIds, healthProfile, `consent: {terms: true, healthData}`) | `201 Session` | rôle forcé `citizen` côté serveur ; `healthProfile` ignoré si `consent.healthData=false` ; e-mail de vérification recommandé |
| A2 | POST | `/auth/login` | `LoginRequest` (email, password, otp?) | `Session` ou `{ mfaRequired: true, challengeId }` | message d'échec générique (pas d'énumération de comptes) |
| A3 | POST | `/auth/mfa/verify` | `{ challengeId, otp }` | `Session` | challenge à usage unique, expiration 5 min |
| A4 | POST | `/auth/refresh` | web : vide (cookie) / mobile : `{ refreshToken }` | `Session` | rotation obligatoire |
| A5 | POST | `/auth/logout` | mobile : `{ refreshToken }` | `204` | révoque le refresh token, efface le cookie |
| A6 | POST | `/auth/password/forgot` | `{ email }` | `204` toujours | lien à usage unique, 30 min |
| A7 | POST | `/auth/password/reset` | `{ token, password }` | `204` | révoque toutes les sessions |

## 4. Compte citoyen (authentifié)

| # | Méthode | Chemin | Corps / paramètres | Réponse | Permission |
|---|---|---|---|---|---|
| C1 | GET | `/me` | aucun | `Me` (= `User` + `permissions[]`) | authentifié |
| C2 | PATCH | `/me` | `ProfileUpdate` (fullName, zoneIds, healthProfile) | `Me` | `profile:manage` |
| C3 | DELETE | `/me` | aucun | `204`, suppression/anonymisation (droit à l'effacement) | authentifié |
| C4 | GET | `/me/notification-preferences` | aucun | `NotificationPreferences` | `notifications:manage` |
| C5 | PUT | `/me/notification-preferences` | `NotificationPreferences` (push, email, zones, niveau minimum, polluants, heures calmes) | idem | `notifications:manage` |
| C6 | POST | `/me/devices` | `{ token, platform: ios\|android\|web }` (jeton Expo/FCM) | `204` | authentifié |
| C7 | DELETE | `/me/devices/{token}` | aucun | `204` | authentifié |
| C8 | GET | `/me/alerts` | comme P12, plus `unread=true` | `Page<Alert>` filtrée sur les zones et le niveau minimum, avec `read`, sans les alertes retirées | authentifié |
| C8b | POST | `/me/alerts/{id}/read` | | 204 | authentifié |
| C8c | POST | `/me/alerts/read-all` | | 204 | authentifié |
| C8d | DELETE | `/me/alerts/{id}` | | 204 (retirée de mes alertes, reste publique) | authentifié |

**Notifications push (backend → Firebase/Expo Push)** : à chaque nouvelle alerte ≥ `minLevel` dans une zone suivie, hors heures calmes, envoyer `{ title, body, data: { alertId } }` ; le mobile ouvre `/alerts/{alertId}`. Supprimer les jetons invalides renvoyés par le fournisseur.

## 5. Administration et autorités

Médias (D28) : vérifier le type réel du fichier (signature, pas seulement l'extension), recadrer ou réencoder, retirer les métadonnées EXIF (position GPS), analyse antivirus, stockage objet (MinIO) servi en HTTPS avec `Content-Type` exact ; produire une miniature pour les vidéos (`posterUrl`).

Toutes ces routes : authentification + MFA, permission vérifiée **serveur**, validation de schéma, **journalisation d'audit** (auteur, horodatage, avant/après) pour chaque écriture (CDC « Traçabilité »).

| # | Méthode | Chemin | Corps / paramètres | Réponse | Permission |
|---|---|---|---|---|---|
| D1 | GET | `/admin/dashboard` | aucun | `AdminDashboard` (IQA ville/max, stations par statut, alertes par niveau, articles, utilisateurs, top zones, santé des sources) | `admin:access` |
| D2 | GET | `/admin/stations` | aucun | `Station[]` avec `latest` (y compris hors ligne / maintenance) | `admin:access` |
| D3 | POST | `/admin/stations` | `StationInput` | `201 Station` | `stations:manage` |
| D4 | PATCH | `/admin/stations/{id}` | `Partial<StationInput>` (statut, zone, type…) | `Station` | `stations:manage` |
| D5 | GET | `/admin/thresholds` | aucun | `Threshold[]` (y compris désactivés) | `admin:access` |
| D6 | POST | `/admin/thresholds` | `ThresholdInput` (polluant, référentiel, période, valeur, unité, `zoneId` ou `null`, niveau d'alerte, actif) | `201 Threshold` | `thresholds:manage` |
| D7 | PATCH | `/admin/thresholds/{id}` | `Partial<ThresholdInput>` | `Threshold` | `thresholds:manage` |
| D8 | DELETE | `/admin/thresholds/{id}` | aucun | `204` | `thresholds:manage` |
| D9 | GET | `/admin/alerts` | comme P12 | `Page<Alert>` complet (`incidentNote`, `handledBy`) | `admin:access` |
| D10 | PATCH | `/admin/alerts/{id}` | `{ status: acknowledged\|resolved, incidentNote? }` | `Alert` | `alerts:manage` |
| D10b | POST | `/admin/alerts` | `AlertCreate` (zone, niveau, polluant, titre, message, conseils) | 201 `Alert` (`origin: manual`), push aux abonnés de la zone | `alerts:manage` |
| D10c | DELETE | `/admin/alerts/{id}` | | 204 | `alerts:manage` |
| D11 | GET | `/admin/articles` | `status`, `category`, `cursor`, `limit` | `Page<ArticleSummary>` (tous statuts) | `articles:manage` |
| D12 | GET | `/admin/articles/{id}` | aucun | `Article` | `articles:manage` |
| D13 | POST | `/admin/articles` | `ArticleInput` (dont `mediaIds` : médias de D28 dans l'ordre d'affichage) | `201 Article` (`slug` généré si absent, 422 `slug_taken`) | `articles:manage` |
| D14 | PATCH | `/admin/articles/{id}` | `Partial<ArticleInput>` | `Article` (`publishedAt` fixé au 1er passage en `published`) | `articles:manage` |
| D15 | DELETE | `/admin/articles/{id}` | aucun | `204` | `articles:manage` |
| D28 | POST | `/admin/media` | `multipart/form-data` : `file` (photo JPEG, PNG, WebP ≤ 5 Mo ou vidéo MP4, WebM ≤ 50 Mo), `alt` | `201 MediaAsset` (`id`, `kind`, `url` HTTPS, `mimeType`, `sizeBytes`, `width`, `height`, `durationSec`, `posterUrl`) ; l'article y fait référence via `mediaIds` | `articles:manage` |
| D16 | GET | `/admin/data-sources` | aucun | `DataSource[]` (capteurs AirGradient, OpenWeatherMap, Sentinel-5P, historique : statut, dernière synchro, taux de rejet IQR/z-score 24 h) | `admin:access` |
| D17 | PATCH | `/admin/data-sources/{id}` | `{ enabled }` | `DataSource` | `sources:manage` |
| D18 | GET | `/admin/models` | aucun | `AiModel[]` (tâche, algorithme, version, statut, R²/RMSE/MAE, date, lien MLflow) | `admin:access` |
| D19 | PATCH | `/admin/models/{id}` | `{ status: active\|candidate\|archived }` (activer = archiver l'actif de même tâche) | `AiModel` | `models:manage` |
| D20 | GET | `/admin/reports` | aucun | `Report[]` | `reports:read` |
| D21 | POST | `/admin/reports` | `ReportRequest` (période hebdo/mensuelle/custom, dates, format pdf/csv/json) | `202 Report` (`queued`), puis `ready` avec `downloadUrl` (URL signée) et `fileName` | `reports:generate` |
| D22 | GET | `/admin/users` | `role`, `status`, `search`, `cursor`, `limit` | `Page<User>` | `users:manage` |
| D23 | POST | `/admin/users` | `UserInvite` (email, nom, rôle) | `201 User` (`pending`, e-mail d'invitation) | `users:manage` |
| D24 | PATCH | `/admin/users/{id}` | `{ role?, status? }`, interdit sur soi-même (403) | `User` | `users:manage` |
| D25 | GET | `/admin/analytics/usage` | `from`, `to` | `UsageStats` (utilisateurs actifs, sessions, push envoyés, par plateforme, par jour) | `analytics:read` |
| D26 | GET | `/admin/audit-logs` | `actorId`, `resource`, `from`, `to`, `cursor`, `limit` | `Page<AuditLogEntry>` | `audit:read` |
| D27 | POST | `/admin/exports` | `ExportQuery` (dataset readings/alerts/forecasts, format csv/json, période, stations) | `DownloadLink` : `{ downloadUrl, fileName, expiresAt }` (URL signée ≤ 10 min, en-tête `Content-Disposition: attachment`) | `data:export_raw` |

Tâches planifiées côté backend (Airflow) attendues par le front : génération automatique des rapports hebdomadaires/mensuels (visibles en D20), recalcul des prévisions (horodatées par `generatedAt`), réentraînement des modèles (D18).

## 6. Énumérations

| Nom | Valeurs |
|---|---|
| `AqiLevel` | `good` (0 à 50), `moderate` (51 à 100), `unhealthy_sensitive` (101 à 150), `unhealthy` (151 à 200), `very_unhealthy` (201 à 300), `hazardous` (> 300) |
| `PollutantCode` (IQA) | `pm25`, `pm10`, `no2`, `so2`, `co`, `o3` |
| `MeasureCode` (en plus) | `co2`, `tvoc`, `nh3`, `no` |
| `Unit` | `µg/m³`, `mg/m³`, `ppm`, `ppb`, `index` |
| `ForecastHorizon` | `1h`, `2h`, `3h`, `1d`, `2d`, `3d` |
| `ReferenceStandard` | `WHO_2021`, `NS_05_062` |
| `AveragingPeriod` | `1h`, `8h`, `24h`, `1y` |
| `DataStatus` | `measured`, `estimated`, `forecast` (`mock` réservé au front) |
| `StationType` / `StationStatus` | `industrial`, `residential`, `road`, `reference` / `online`, `offline`, `maintenance` |
| `AlertStatus` | `active`, `acknowledged`, `resolved` |
| `ArticleCategory` / `ArticleStatus` | `alert`, `info`, `report`, `regulation`, `event`, `education` / `draft`, `published`, `archived` |
| `HealthProfileId` | `general`, `children`, `elderly`, `asthma`, `cardiac`, `pregnant`, `outdoor_worker`, `athlete` |
| `Role` | `citizen`, `authority`, `admin` |

## 7. Correspondance avec le backend existant

| Existant (`air_quality/`, `projet-transversal/`) | Cible |
|---|---|
| `POST /predict/` (vue unique) | remplacé par la lecture `GET /forecasts` ; la prédiction est produite par un job planifié, pas à la demande du client |
| Colonne `iqr` + `categorie_iqa` (texte « Modérée »…) | `aqi` (nombre) + `level` (énumération ci-dessus) ; garder `iqr` uniquement comme alias interne |
| Table `readings` à plat (pm25, pm10, …, `vitesse_vent`, `direction_vent`) | `measures[]` + `weather` normalisés, unités explicites |
| `location_id` AirGradient (89441, 168373…) | `Station.externalId` ; `Station.id` reste l'identifiant SEN-AIR |
| Politiques Supabase « CRUD anonyme » des templates | **à abandonner** : lecture publique seulement, écriture via `/admin/*` authentifié |

### Constats sur les données actuelles (`projet-transversal/air_quality.csv`)

| Constat | Ce que le backend doit faire |
|---|---|
| `co`, `no`, `no2`, `so2`, `o3`, `nh3`, `vitesse_vent`, `direction_vent` ont des valeurs **identiques pour toutes les stations** au même moment : elles viennent d'OpenWeatherMap (un point pour la ville) | renvoyer `source: openweathermap` pour ces variables ; ne pas les présenter comme une mesure locale |
| `iqr` = max(PM2.5 / **75** × 100, O₃ / 100 × 100) (ex. 205,1 / 75 × 100 = 273,47 à l'Hôtel de Ville) : la limite PM2.5 utilisée est 75 µg/m³ (cible intermédiaire OMS 1), pas 15 µg/m³ comme dans la présentation | **décision d'équipe à prendre** et à documenter ; exposer la valeur limite utilisée via `GET /thresholds` |
| L'Hôtel de Ville renvoie la même mesure (`timestamp` 13:02:03) à chaque collecte, alors que `created_at` avance | `observedAt` = `timestamp` du capteur, **jamais** `created_at` ; le front affichera alors « Données en retard » |
| Valeurs vides (`temperature`, `co2`, `tvoc`) et `pm10 = 0.0` sur certaines stations | renvoyer `null` (pas 0) quand le capteur ne fournit pas la valeur |
| CO à 77,5 : unité OpenWeatherMap = µg/m³ | convertir en mg/m³ (0,0775) ou renvoyer `unit: "µg/m³"` explicitement |
| `categorie_iqa` en texte libre (« Modérée », « Très mauvaise ») | renvoyer `level` (énumération § 6) |

## 8. Priorisation proposée

| Lot | Endpoints | Débloque |
|---|---|---|
| **MVP 1 : consultation** | P1 à P7, P11, P12, P14 à P18 | accueil, carte (marqueurs), prévisions, alertes, santé, infos sur web et mobile |
| **MVP 2 : comptes** | A1 à A7, C1 à C8, P8 | espace citoyen, alertes personnalisées, push, IQA de ma position |
| **MVP 3 : pilotage** | D1 à D15, D28 | back-office autorités : tableau de bord, alertes/incidents, seuils, stations, articles |
| **MVP 4 : gouvernance** | P9, P10, D16 à D27 | heatmap, sources, modèles, rapports, utilisateurs, audit, export |

Tant qu'un endpoint n'existe pas, le front fonctionne en **mode mock** (`VITE_API_MODE=mock` / `EXPO_PUBLIC_API_MODE=mock`), avec un bandeau « Données de démonstration ». Le basculement se fait sans modifier les écrans.
