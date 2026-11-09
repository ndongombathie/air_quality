# 09. Données et règles métier

Référence de code : [packages/core/src/domain](../packages/core/src/domain).

## 1. Échelle IQA (présentation §7)

| IQA | Niveau (`AqiLevel`) | Libellé | Couleur | Impact sanitaire |
|---|---|---|---|---|
| 0 à 50 | `good` | Bon | vert #00A651 | risque négligeable |
| 51 à 100 | `moderate` | Modéré | jaune #F5C400 | symptômes légers pour les personnes sensibles |
| 101 à 150 | `unhealthy_sensitive` | Mauvais pour les groupes sensibles | orange #FF7E00 | réduire les activités prolongées en extérieur |
| 151 à 200 | `unhealthy` | Mauvais | rouge #E53935 | toute la population peut ressentir des effets |
| 201 à 300 | `very_unhealthy` | Très mauvais | violet #8F3F97 | alerte sanitaire, limiter les sorties |
| > 300 | `hazardous` | Dangereux | bordeaux #7E0023 | rester à l'intérieur |

La couleur est toujours accompagnée du libellé (accessibilité, daltonisme).

## 2. Calcul (backend : présentation §8)

```
sous-indice(polluant) = concentration mesurée / valeur limite × 100
IQA(station)          = max des sous-indices des polluants mesurés
IQA(zone ou ville)    = max des IQA des stations de la zone
polluant dominant     = celui qui donne le max
```

Le front **affiche** l'IQA, le niveau, le polluant dominant et les sous-indices fournis ; il ne les recalcule pas. (Le mock de démonstration applique la même formule pour rester cohérent.)

## 3. Polluants

| Code | Polluant | Unité | Dans l'IQA | Sources à Thiès |
|---|---|---|:-:|---|
| `pm25` | PM2.5, particules fines | µg/m³ | ✓ | trafic, charbon de bois, cimenteries, harmattan |
| `pm10` | PM10, particules grossières | µg/m³ | ✓ | poussières sahariennes, routes, chantiers |
| `no2` | NO₂, dioxyde d'azote | µg/m³ | ✓ | trafic, centrales |
| `so2` | SO₂, dioxyde de soufre | µg/m³ | ✓ | industries |
| `co` | CO, monoxyde de carbone | mg/m³ | ✓ | combustion incomplète |
| `o3` | O₃, ozone | µg/m³ | ✓ | réaction photochimique |
| `co2`, `tvoc`, `nh3`, `no` | grandeurs secondaires AirGradient | ppm / indice / µg/m³ | | confinement, COV… |

## 4. Seuils de référence

| Polluant | OMS 2021 | Norme sénégalaise NS 05-062 |
|---|---|---|
| PM2.5 | 15 µg/m³ (24 h) · 5 µg/m³ (an) | 25 µg/m³ (24 h) |
| PM10 | 45 µg/m³ (24 h) · 15 µg/m³ (an) | 50 µg/m³ (24 h) |
| NO₂ | 25 µg/m³ (24 h) · 10 µg/m³ (an) | 200 µg/m³ (1 h) |
| SO₂ | 40 µg/m³ (24 h) | 50 µg/m³ (24 h) |
| O₃ | 100 µg/m³ (8 h) · 60 µg/m³ (saison de pointe) | 100 µg/m³ (8 h) |
| CO | 4 mg/m³ (24 h) | 10 mg/m³ (8 h) |

> Le tableau de l’annexe du cahier des charges et la présentation contiennent trois imprécisions à corriger dans le document source : la colonne « Ancienne valeur (2025) » correspond aux valeurs **OMS 2005**, « CO 10 µg/m³ » doit se lire **10 mg/m³** (10 000 µg/m³), et pour l’O₃ la valeur OMS 2021 sur 8 h est **100 µg/m³**, 60 µg/m³ est la valeur « saison de pointe ».

Les seuils **effectifs** (ceux qui déclenchent les alertes, éventuellement par zone) sont paramétrés par l'administrateur et servis par `GET /thresholds`. Les valeurs ci-dessus ne servent qu'aux pages pédagogiques et au repli hors ligne.

## 5. Prévisions

| Horizon | Code API | Affichage | Usage | Modèle (CDC §6.3) |
|---|---|---|---|---|
| 1 h, 2 h, 3 h | `1h`, `2h`, `3h` | +1 h, +2 h, +3 h | alertes rapides | XGBoost / LightGBM |
| J+1, J+2, J+3 | `1d`, `2d`, `3d` | J+1, J+2, J+3 | planification, bulletins | XGBoost ; LSTM/GRU en option pour J+3 |
| zones sans capteur | | couche heatmap | couverture du territoire | krigeage ordinaire + Random Forest |

Chaque prévision affiche : niveau, intervalle (bas à haut), **confiance fournie par le modèle**, tendance, facteurs explicatifs (SHAP), nom et version du modèle, date de génération.

## 6. Profils de santé

`general` (adulte en bonne santé), `children` (enfant), `elderly` (personne âgée), `asthma` (asthmatique), `cardiac` (cardiaque), `pregnant` (femme enceinte), `outdoor_worker` (travailleur en extérieur), `athlete` (sportif). Les quatre profils du cahier des charges (adulte, enfant, asthmatique, sportif) sont inclus. Toute recommandation est accompagnée de l'avertissement médical.

## 7. Stations du réseau pilote (AirGradient)

| ID fournisseur | Station | Zone | Type |
|---|---|---|---|
| 89441 | Université Iba Der Thiam | Université | résidentiel |
| 166062 | École élémentaire Sud Stade | Sud Stade | résidentiel |
| 168373 | Hôtel de Ville | Centre-ville | axe routier |
| 168377 | Lycée Malick Sy | Malick Sy | résidentiel |
| 168388 | Lycée Jules Sagna | Jules Sagna | axe routier |
| 168393 | Lycée Médina Fall | Médina Fall | industriel |
| 168394 | École élémentaire Kaba Sall | Kaba Sall | résidentiel |
| 168397 | Collège Cité Lamy | Cité Lamy | résidentiel |
| 168401 | Lycée de Fahu | Fahu | résidentiel |

Les types sont indicatifs (repris du template) et doivent être confirmés par l'équipe terrain.

## 8. Qualité des données

- Valeurs vides dans les CSV historiques : afficher l'absence de mesure, jamais 0.
- Valeurs aberrantes : filtrées par le backend (IQR, z-score) ; le taux de rejet est visible dans l'admin (sources de données).
- Mesures asynchrones (capteurs vs météo) : alignement temporel par le backend ; le front affiche l'horodatage de chaque bloc.
