# 01. Brief du projet

Sources : [Cahier des charges v01-3](../Cahier%20des%20charges%20SEN-AIR_v01-3.pdf), [Présentation d'avancement](../SENAIR_Presentation_Avancement-2.pdf), conversation de préparation de soutenance (ChatGPT, non accessible sans connexion : à reporter ici si elle contient des décisions absentes des PDF).

## Le problème

- 99 % de la population mondiale respire un air hors des seuils OMS (≈ 7 millions de décès prématurés par an).
- **Thiès**, 3ᵉ agglomération du Sénégal : trafic dense sur l'axe Thiès-Dakar, deux cimenteries majeures (Ciments du Sahel, Dangote à Pout), charbon de bois, feux de brousse, **harmattan** de novembre à mai.
- Forte hétérogénéité : IQA 134 à Pout contre 28 à Thiès Nones (IQAir, juin 2026), soit un écart de 5×.
- **Aucune** surveillance en temps réel accessible et exploitable par les citoyens, les collectivités ou les autorités sanitaires.

## La réponse : SEN-AIR

Une plateforme qui combine **capteurs AirGradient** déjà installés (9 stations), **météo OpenWeatherMap**, plus tard **Sentinel-5P**, et des **modèles d'IA** pour :

1. **mesurer** et diffuser un Indice de Qualité de l'Air (IQA) en temps réel ;
2. **estimer** l'IQA dans les zones sans capteur (krigeage + Random Forest) ;
3. **prévoir** à 1 h, 2 h, 3 h, J+1, J+2, J+3 (XGBoost/LightGBM, LSTM en option) ;
4. **alerter** automatiquement selon les seuils OMS 2021 et la norme sénégalaise NS 05-062 ;
5. **recommander** des gestes adaptés au profil de santé ;
6. être **reproductible** dans d'autres villes du Sénégal.

## Qui l'utilise ?

| Acteur | Accès | Ce qu'il attend | Interface principale |
|---|---|---|---|
| **Public** | sans compte | voir la carte et l'IQA de sa zone en moins de 3 clics | web/PWA, mobile |
| **Citoyen inscrit** | compte | alertes push personnalisées sur ses zones, tableau de bord de sa zone, conseils selon son profil de santé | mobile en priorité, web |
| **Autorité sanitaire** | compte + MFA | tableau de bord de surveillance, gestion des alertes et suivi des incidents, publication d'articles, rapports | web (back-office) |
| **Administrateur** | compte + MFA | gestion des stations, sources de données, seuils par polluant et zone, modèles IA, utilisateurs et rôles, journal d'audit, export des données brutes | web (back-office) |

## Périmètre de ce dépôt

**Inclus : le front**
- `senair.web` : site responsive installable (**PWA**) = portail citoyen + back-office autorités/admin ;
- `senair.mobile` : application **iOS/Android** (Expo / React Native) pour les citoyens ;
- `packages/core` : socle partagé (domaine, contrat API, client HTTP, données de démonstration).

**Hors périmètre : le backend** (équipe backend) : API Django, ingestion Kafka, ETL, stockage PostgreSQL/PostGIS + InfluxDB + MinIO, Airflow, modèles, MLflow, envoi des push Firebase. Le front exprime ses besoins dans [08-api-endpoints.md](./08-api-endpoints.md) et [api/openapi.yaml](./api/openapi.yaml).

## Exigences non fonctionnelles qui concernent le front

| Exigence (CDC §2.2) | Traduction front |
|---|---|
| Carte chargée en < 3 s en 3G/4G | carte chargée à la demande (lazy), tuiles OSM mises en cache, données en cache PWA |
| IQA de sa zone en ≤ 3 clics | accueil → zone ; carte → station ; géolocalisation sur mobile |
| Android, iOS, Chrome, Firefox, Safari | React Native (Expo) + web responsive |
| TLS, authentification forte des admins | HTTPS uniquement, MFA TOTP pour autorité/admin, jetons courts |
| Minimisation des données personnelles | profil santé facultatif, consentement explicite, suppression de compte |
| Traçabilité des actions admin | journal d'audit consultable (backend l'écrit) |
| Export CSV/JSON | export admin via URL signée |
| Maintenabilité / modularité | monorepo, architecture par fonctionnalités, ports & adaptateurs |

## Définition du MVP

Consultation publique (accueil IQA, carte des stations, détail station, historique 24 h/7 j, prévisions, alertes, santé, informations/normes, articles) + compte citoyen (préférences, alertes personnalisées, push) + back-office (tableau de bord, alertes/incidents, seuils, stations, articles). Les données simulées sont **toujours signalées** comme telles.
