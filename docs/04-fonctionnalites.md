# 04. Fonctionnalités, écrans et parcours

## 1. Matrice d'accès

| Fonction | Public | Citoyen | Autorité | Admin | Web | Mobile |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| IQA ville / zone, polluant dominant, météo | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| IQA de ma position (géolocalisation) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Carte : stations, couches IQA/polluants, détail station | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Historique 24 h / 7 j / 30 j | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Prévisions 1 h → J+3 (confiance, facteurs, modèle) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Alertes publiées + filtres | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Recommandations par profil de santé | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Normes OMS / NS 05-062, échelle IQA, articles | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Zones suivies, profil santé enregistré, mes alertes | | ✓ | ✓ | ✓ | ✓ | ✓ |
| Notifications push / e-mail, heures calmes | | ✓ | ✓ | ✓ | (e-mail) | ✓ |
| Tableau de bord de surveillance | | | ✓ | ✓ | ✓ | |
| Acquitter / résoudre une alerte, note d'incident | | | ✓ | ✓ | ✓ | |
| Publier des articles | | | ✓ | ✓ | ✓ | |
| Rapports hebdomadaires / mensuels | | | ✓ | ✓ | ✓ | |
| Statistiques d'usage | | | ✓ | ✓ | ✓ | |
| Stations, sources de données, modèles IA | | | | ✓ | ✓ | |
| Seuils par polluant et par zone | | | | ✓ | ✓ | |
| Utilisateurs et rôles, journal d'audit, export brut | | | | ✓ | ✓ | |

Le back-office est **web uniquement** (responsive, utilisable sur tablette/téléphone). L'application mobile est centrée sur le citoyen.

## 2. Plan des écrans

### Web : portail public (`senair.web`)

| Route | Écran | Contenu |
|---|---|---|
| `/` | Accueil | IQA de Thiès (jauge + niveau + polluant dominant), fraîcheur, météo, bannière d'alerte, comparaison vs hier / semaine dernière, classement des zones, prévisions courtes, graphe 24 h / 7 j |
| `/carte` | Carte | Leaflet/OSM, marqueurs stations colorés + libellé, couche heatmap par polluant, « ma position », filtre par type, liste accessible |
| `/zones/:zoneId` | Zone | IQA de la zone, historique, prévisions de la zone |
| `/stations/:stationId` | Station | dernière mesure détaillée (sous-indices vs seuils), météo, historique |
| `/previsions` | Prévisions | 6 horizons, intervalle, confiance, facteurs, modèle et version |
| `/alertes` | Alertes | liste filtrable (statut, niveau, polluant, zone), recommandations |
| `/sante` | Santé | choix du profil → recommandations selon le niveau actuel, avertissement médical |
| `/infos` | Informations | normes OMS 2021 vs NS 05-062, échelle IQA, fiche des polluants |
| `/articles`, `/articles/:slug` | Actualités | catégories, recherche, lecture Markdown |
| `/connexion`, `/inscription`, `/mot-de-passe-oublie` | Compte | connexion (+ étape MFA), inscription avec consentements |
| `/mon-espace` | Espace citoyen, ma zone | tableau de bord de la zone suivie |
| `/mon-espace/alertes` | Mes alertes | alertes filtrées sur mes zones et mon niveau minimum |
| `/mon-espace/notifications` | Notifications | push / e-mail, zones, niveau minimum, polluants, heures calmes |
| `/mon-espace/profil` | Profil | nom, zones, profil santé (consentement), suppression du compte |

### Web : back-office (`/admin`, permission `admin:access`)

| Route | Permission | Écran |
|---|---|---|
| `/admin` | `admin:access` | Tableau de bord : IQA ville, stations par statut, alertes actives/24 h/par niveau, top zones, santé des sources |
| `/admin/alertes` | `alerts:manage` | Gestion des alertes : acquitter, résoudre, note d'incident, historique |
| `/admin/articles`, `/admin/articles/nouveau`, `/admin/articles/:articleId` | `articles:manage` | Liste par statut, éditeur Markdown avec aperçu |
| `/admin/rapports` | `reports:read` | Rapports générés, demande de rapport |
| `/admin/analytique` | `analytics:read` | Usage : utilisateurs actifs, sessions, push, plateformes |
| `/admin/stations` | `stations:manage` | Création, modification, statut (en ligne / hors ligne / maintenance) |
| `/admin/seuils` | `thresholds:manage` | Seuils par polluant, référentiel, période, zone, niveau d'alerte |
| `/admin/sources` | `sources:manage` | État de l'ingestion, taux de rejet, activation |
| `/admin/modeles` | `models:manage` | Modèles, métriques R²/RMSE/MAE, activation d'un candidat |
| `/admin/utilisateurs` | `users:manage` | Invitation, rôle, statut |
| `/admin/audit` | `audit:read` | Journal des actions |
| `/admin/export` | `data:export_raw` | Export CSV/JSON des mesures, alertes, prévisions |

(Les libellés exacts des routes sont ceux de `senair.web/src/app/router.tsx`.)

### Mobile (`senair.mobile`, CDC §7.2)

| Onglet / route | Contenu | Fonction clé |
|---|---|---|
| Accueil `(tabs)/index` | IQA de ma position ou de la ville, météo, alerte du jour, prévisions 1 h → J+3, historique, zones | géolocalisation sur action |
| Carte `(tabs)/map` | carte mobile, marqueurs, couches, détail station | zoom, couches, marqueurs |
| Alertes `(tabs)/alerts` | historique + filtres polluant / niveau, accès aux préférences | notifications push |
| Santé `(tabs)/health` | recommandations par profil | profil médical |
| Actualités `(tabs)/actualites` | article à la une, catégories, fil d'articles avec photos et vidéos ; entrée « Comprendre » (échelle IQA, normes OMS / NS 05-062, polluants) | lecture d'articles, médias |
| Premier lancement `onboarding` | 3 écrans : l'IQA, la position, les alertes | découverte guidée |
| `station/[id]`, `articles/[slug]`, `comprendre` | détails | |
| `account/*` | connexion, inscription, profil, notifications | compte optionnel |

## 3. Parcours clés et critères d'acceptation

### P-1 · « Quel air je respire ? » (public, ≤ 3 clics)
- **Étant donné** un visiteur sans compte, **quand** il ouvre l'accueil, **alors** il voit l'IQA de Thiès, son niveau en toutes lettres, le polluant dominant et l'heure de la mesure en moins de 3 s.
- **Quand** il touche « Ma position » et accepte la géolocalisation, **alors** l'IQA estimé à sa position s'affiche avec la station la plus proche et un indice de confiance.
- **Si** les données ont plus de 15 min, **alors** un badge « Données en retard » s'affiche ; plus de 2 h : « Données anciennes ».
- **Si** l'API est injoignable, **alors** un message d'erreur et un bouton « Réessayer » s'affichent, jamais une valeur inventée.

### P-2 · Recevoir une alerte personnalisée (citoyen)
- **Étant donné** un citoyen qui suit « Centre-ville » avec niveau minimum « Mauvais pour les groupes sensibles », **quand** une alerte de ce niveau est créée sur cette zone hors heures calmes, **alors** il reçoit un push qui ouvre le détail de l'alerte.
- La permission de notification n'est demandée **qu'au moment** où il active les notifications.

### P-3 · Conseils de santé
- **Quand** l'utilisateur choisit « Personne asthmatique », **alors** les actions recommandées pour le niveau actuel s'affichent, avec l'avertissement « ne remplace pas un avis médical ».
- Le profil santé n'est enregistré sur le serveur qu'avec un consentement explicite.

### P-4 · Gérer un incident (autorité)
- **Étant donné** une autorité connectée avec MFA, **quand** elle acquitte une alerte active et ajoute une note, **alors** le statut passe à « acquittée », la note est visible dans le back-office uniquement et l'action apparaît au journal d'audit.

### P-5 · Paramétrer un seuil (admin)
- **Quand** l'admin modifie le seuil PM2.5 OMS 24 h pour la zone « Médina Fall », **alors** la valeur est validée (positive, unité cohérente), enregistrée, et l'audit indique l'ancienne et la nouvelle valeur.
- Une autorité ne voit pas l'entrée de menu « Seuils » et reçoit 403 si elle force l'URL.

### P-6 · Publier un article
- **Quand** l'éditeur publie un article Markdown avec une photo et une vidéo, **alors** il apparaît dans `/articles` (web) et l'onglet Actualités (mobile) avec ses médias ; le HTML brut éventuel n'est pas interprété.

### P-7 · Hors-ligne (PWA)
- **Étant donné** un utilisateur qui a déjà consulté l'accueil, **quand** il perd la connexion, **alors** l'accueil s'affiche avec les dernières données en cache et la mention « Hors ligne, dernières données connues ».
