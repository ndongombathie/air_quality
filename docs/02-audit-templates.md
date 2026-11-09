# 02. Audit des templates et décision

État constaté le 2026-11-02, avant réorganisation. Une sauvegarde complète (hors `node_modules`) est conservée dans [_archives/templates-front-2026-11-02.tar.gz](../_archives/).

## Les quatre candidats

| Dossier | Contenu | Verdict |
|---|---|---|
| `senair.web/project` | App Expo Router SDK 54 (« bolt-expo-starter ») : 6 onglets citoyens + 6 écrans `admin/*` ; **plus** un sous-projet `web/` Vite + React 18 JSX (admin). Supabase, migrations SQL. | **Retenu comme source** : le plus complet. Sur-ensemble des deux suivants. |
| `project` | Même app Expo, version antérieure (pas d'articles ni d'admin). | Doublon → supprimé |
| `senair-mobile` | Même app Expo, version encore antérieure. | Doublon → supprimé |
| `senair.mobile` | Starter Expo **SDK 57** vierge (« Open up App.tsx »), React 19.2 / RN 0.86. | **Retenu comme socle mobile** (versions les plus récentes) |

Vérification : comparaison fichier à fichier (`cmp`), tous les fichiers de `project` et `senair-mobile` existent dans `senair.web/project`, avec des écarts uniquement sur les écrans enrichis ensuite.

## Ce qui était bon (conservé)

- Identité visuelle cohérente : vert #0A6B3B, police Inter, cartes arrondies, jauge IQA SVG, graphiques SVG.
- Couverture fonctionnelle citoyenne : accueil, carte, alertes, santé (8 profils), infos/normes OMS, articles.
- Écrans admin : tableau de bord, stations, articles (création/édition), prévisions, alertes, analytique.
- Les 9 stations réelles AirGradient de Thiès et leurs coordonnées.
- Recommandations sanitaires par profil et par niveau.

## Ce qui posait problème (corrigé)

| # | Problème | Gravité | Correction |
|---|---|---|---|
| 1 | **Politiques Supabase « CRUD anonyme »** sur stations, mesures et articles : n'importe qui pouvait modifier ou supprimer les données | Critique | Plus d'accès direct à la base depuis le client ; écritures uniquement via `/admin/*` authentifié |
| 2 | **Prévisions générées par `Math.random()` côté client** (`lib/forecast.ts`) présentées comme des prévisions IA | Critique (désinformation sanitaire) | Prévisions lues depuis `GET /forecasts` (modèle, version, confiance) ; mock clairement signalé |
| 3 | **Repli silencieux à IQA = 75** si la base est injoignable (`useStations`) | Élevée | États explicites `loading / error / stale / unavailable` ; valeur absente = « N/D » |
| 4 | Historique 24 h / 7 j aléatoire figé au chargement (`HISTORY_24H`) | Élevée | `GET /stations/{id}/history` |
| 5 | Pas d'authentification ni de contrôle de rôle sur `/admin` | Critique | Session, MFA, gardes de permission (UI) + autorisation serveur |
| 6 | Carte Google Maps injectée dans une WebView **par concaténation de chaînes** (risque d'injection, clé API requise) | Élevée | Leaflet + OpenStreetMap, HTML statique, données via `postMessage` + `JSON.stringify` |
| 7 | Trois copies du même code + un admin JSX séparé : logique IQA, seuils, couleurs dupliqués 4 fois | Moyenne (DRY) | Une seule source : `@senair/core` |
| 8 | Confusion `iqr` / IQA, catégories en texte libre (« Modérée », « Très mauvaise ») | Moyenne | Énumération `AqiLevel` unique, `aqi` numérique |
| 9 | Seuils codés en dur dans plusieurs écrans et divergents (O₃ 100 vs 60, SO₂ 8 h…) | Moyenne | Seuils servis par `GET /thresholds` ; référentiel pédagogique unique dans core |
| 10 | Interpolation IDW recalculée dans le client | Moyenne | Interpolation = backend (`/air-quality/at`, `/air-quality/heatmap`) |
| 11 | Admin « optimisé desktop » qui bloquait le mobile | Faible | Back-office responsive (menu en tiroir) |
| 12 | `.env` avec clé Supabase dans les dossiers du template | Faible (clé anon) | Supprimé du code actif ; `.env.example` sans secret ; `.env` ignoré par git |
| 13 | Pas de PWA (ni manifest ni service worker) | Moyenne | `vite-plugin-pwa` + stratégie de cache |

## Décision d'architecture

Le cahier des charges (§4.2) impose **React.js + TypeScript + Leaflet** pour le web et **React Native** pour le mobile. Plutôt qu'une seule app Expo servant aussi le web (rendu `react-native-web` peu adapté à un back-office riche en tableaux, formulaires et cartes, et PWA plus difficile), on retient :

| Application | Base | Pourquoi |
|---|---|---|
| `senair.web` | Vite + React 19 + TS, porté depuis `senair.web/project/web` (admin) et enrichi des écrans citoyens | écosystème web natif (react-leaflet, recharts, PWA Workbox), SEO/partage de liens, back-office ergonomique |
| `senair.mobile` | Starter Expo SDK 57 + écrans Expo Router portés depuis `senair.web/project/app/(tabs)` | versions récentes, une seule base iOS/Android, notifications push, géolocalisation, stockage sécurisé |
| `packages/core` | nouveau | tout ce qui doit être identique sur les deux apps : domaine, contrat API, client, validation, mock |

Après portage, la source temporaire `_archives/template-source/` est supprimée ; seule l'archive compressée reste.
