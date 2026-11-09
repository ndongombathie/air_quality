# Documentation SEN-AIR

SEN-AIR estime, visualise et prévoit la qualité de l'air à Thiès et diffuse des alertes sanitaires. Cette documentation couvre le **front** (`senair.web`, `senair.mobile`, socle `packages/core`) et le **backend** (`senair.api`, Django). La collecte, le pipeline Kafka et les modèles IA relèvent de l'équipe IA / data : le contrat d'échange est décrit en 14.

| # | Document | Pour qui | Contenu |
|---|---|---|---|
| 01 | [Brief du projet](./01-brief-projet.md) | tous | problème, objectifs, acteurs, périmètre, MVP |
| 02 | [Audit des templates](./02-audit-templates.md) | équipe front | état initial, problèmes trouvés, décision |
| 03 | [Architecture](./03-architecture.md) | équipe front | monorepo, couches, SOLID/DRY, flux, choix techniques |
| 04 | [Fonctionnalités et écrans](./04-fonctionnalites.md) | équipe, encadrants | matrice d'accès, écrans web/mobile/admin, critères d'acceptation |
| 05 | [Processus](./05-processus.md) | équipe front | démarrage, Git, cycle d'une feature, Definition of Done, CI |
| 06 | [Sécurité](./06-securite.md) | équipes front et backend | menaces, authentification, en-têtes, données personnelles |
| 07 | [PWA, mobile et hors-ligne](./07-pwa-mobile-offline.md) | équipe front | cache, mises à jour, mode dégradé, performance |
| 08 | [**Endpoints de l'API**](./08-api-endpoints.md) | front et backend | 66 opérations, conventions, priorisation |
| | [OpenAPI 3.1](./api/openapi.yaml) | équipe backend | spécification machine (Swagger) |
| 09 | [Données métier](./09-donnees-metier.md) | tous | IQA, polluants, seuils OMS/NS, prévisions, stations |
| 10 | [Feuille de route](./10-roadmap.md) | tous | fait, à faire, risques |
| 11 | [**Guide de lancement**](../README.md#guide-de-lancement) | tous | installation, web, mobile, backend, Swagger, PWA, dépannage |
| 12 | [Charte graphique](./12-design-system.md) | front | logo, couleurs, typographie, composants |
| 13 | [**Backend (API Django)**](./13-backend.md) | équipe | architecture, démarrage, commandes, sécurité, qualité, décisions |
| 14 | [**Intégration données et IA**](./14-integration-donnees-ia.md) | **équipe IA / data** | topics Kafka, formats des messages, modèles, dead-letter |
| | [Schémas des messages](./stream) | équipe IA / data | JSON Schema versionnés (`measurement.v1`, `forecast.v1`…) |

## Sources de vérité

- **Besoin** : [Cahier des charges](../Cahier%20des%20charges%20SEN-AIR_v01-3.pdf) et [présentation d'avancement](../SENAIR_Presentation_Avancement-2.pdf).
- **Contrat API** : [packages/core/src/api](../packages/core/src/api) ↔ [api/openapi.yaml](./api/openapi.yaml) ↔ [08](./08-api-endpoints.md).
- **Règles métier** : [packages/core/src/domain](../packages/core/src/domain).
