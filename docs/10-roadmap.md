# 10. Feuille de route front

## Fait (itération du 2026-11-02)

- Audit des 4 templates, sauvegarde, suppression des doublons ([02](./02-audit-templates.md)).
- Monorepo npm workspaces : `packages/core`, `senair.web`, `senair.mobile`.
- `@senair/core` : domaine (IQA, polluants, seuils, santé, horizons, fraîcheur), contrat API typé (66 opérations), client HTTP (jeton, refresh, timeout, erreurs normalisées), adaptateur REST, adaptateur mock déterministe avec permissions et audit, schémas zod, tests unitaires.
- `senair.web` : portail citoyen + back-office, PWA.
- `senair.mobile` : application citoyenne Expo Router.
- Documentation : brief, architecture, fonctionnalités, processus, sécurité, PWA/mobile, données métier, endpoints + OpenAPI.

### Backend (2026-11-02)

- `senair.api` (Django 6.1) : les 66 opérations du contrat, plus de 270 tests (chaque réponse validée contre l'OpenAPI), lecture en streaming du pipeline Kafka (format brut actuel et formats v1), import de l'historique réel, intégration du modèle KNN, alertes et push, MFA, rapports, audit. Voir [13-backend.md](./13-backend.md).
- Contrat d'échange avec l'équipe IA / data : [14-integration-donnees-ia.md](./14-integration-donnees-ia.md) et [stream/](./stream).

## Prochaines étapes

| Priorité | Tâche | Dépend de |
|---|---|---|
| P0 | Initialiser un vrai dépôt git (le dossier `.git` actuel est vide) et pousser sur GitHub pour activer la CI | |
| P0 | Atelier avec l'équipe IA / data : formule de l'IQA (limites PM2.5 15 ou 75), publication de `senair.measurements.v1` et `senair.forecasts.v1`, version de scikit-learn ([13 § 7](./13-backend.md)) | équipe IA / data |
| P0 | Déployer `senair.api` (Docker) et passer web et mobile en mode `rest` | hébergement |
| P1 | Tests de composants (Testing Library) sur les écrans critiques : accueil, carte, connexion, gardes admin | |
| P1 | Tests de bout en bout (Playwright) des parcours P-1 à P-6 en mode mock | |
| P1 | Configurer le projet EAS (projectId) pour les notifications push et les builds Android/iOS | compte Expo |
| P1 | Icônes et écran de démarrage définitifs (charte graphique) | design |
| P2 | Notifications Web Push sur la PWA | backend (VAPID) |
| P2 | Couche satellite Sentinel-5P sur la carte | backend |
| P2 | Internationalisation (wolof), extraire les textes | contenu |
| P2 | Mesure de performance (Lighthouse ≥ 90, carte < 3 s en 3G simulée) | |
| P3 | Partage `packages/ui` web/mobile si des composants deviennent identiques | |

## Risques

| Risque | Mitigation |
|---|---|
| Le backend adopte un format différent (snake_case, autres noms) | contrat écrit d'abord ; sinon adaptateur de mapping dans `core/api/rest.ts` uniquement |
| Données capteurs lacunaires | états « en retard / anciennes / indisponible », jamais de valeur inventée |
| Montée de version Expo (SDK annuel) | dépendances alignées via `npx expo install`, `expo-doctor` en CI |
| `npm audit` (2026-11-02) : 0 critique ; 6 « hautes » dans la chaîne Expo (`@expo/cli` → zod 3, `expo-router` → `query-string` → `decode-uri-component`, DoS sur URI malformée) | surveiller les correctifs Expo SDK 58 ; `npx expo install --fix` à chaque patch ; la CI bloque sur « critique » |
| Quota des tuiles OSM en production | cache limité ; prévoir un fournisseur de tuiles (MapTiler, Mapbox) si la fréquentation augmente |
