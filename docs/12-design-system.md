# 12. Charte graphique

Intention : **l'air**. Une interface claire, aérée et calme, en bleu ciel et blanc. Les données, et en particulier la couleur du niveau d'IQA, sont la seule chose qui ressort. Pas d'effets décoratifs.

Source des valeurs : [packages/core/src/design/tokens.ts](../packages/core/src/design/tokens.ts) (`DesignTokens`). Les couleurs IQA restent celles de [domain/aqi.ts](../packages/core/src/domain/aqi.ts).

## 0. Logo

- Fichiers fournis : `senair.mobile/assets/logo/` (`logo.png`, `logoPNG.png`). Symbole vectorisé : **`senair-mark.svg`**, source unique.
- `npm run brand` régénère toutes les déclinaisons : données du symbole pour le code (`packages/core/src/design/logoMark.ts`, exporté en `LOGO_MARK`), favicon et icônes PWA (`senair.web/public/`), icône, icône adaptative Android, icône monochrome, écran de démarrage et favicon (`senair.mobile/assets/`), logo complet `senair-logo.png`.
- Composants : web `Logo`, `LogoMark`, `LogoWordmark` (`senair.web/src/shared/layout/Logo.tsx`) ; mobile `BrandLogo` (`inline`, `stacked`, `mark`) et `LogoMark` (`senair.mobile/src/shared/ui/BrandLogo.tsx`).
- Mot : **SEN** en Manrope ExtraBold, *AIR* en Manrope léger incliné de 12°, couleur `#212121`, comme le logo d'origine.
- Couleurs du logo : bleu **#5AC8FA**, vert **#6DBE45**, texte **#212121**.

## 1. Couleurs

| Rôle | Valeur | Usage |
|---|---|---|
| Fond de page | `#F3FBFF` (sky50) | arrière-plan général, à peine bleuté |
| Surface | `#FFFFFF` | cartes, panneaux, barre latérale |
| Surface douce | `#E1F5FE` (sky100) | élément actif, survol, zones mises en avant |
| Bordure | `#DDEDF6` / forte `#C3DDEC` | séparations fines (1 px) |
| Marque | `#5AC8FA` (sky400, bleu du logo) et `#6DBE45` (vert du logo) | symbole, indicateurs actifs, illustrations, accents ; jamais pour du texte sur blanc (contraste 1,9:1) |
| Primaire | `#137BAA` (sky600), survol `#116D97` | boutons principaux, texte blanc à 4,7:1 |
| Texte accentué | `#116D97` (sky700) | liens, icône active, chiffres clés (5,7:1) |
| Vert lisible | `#407128` | texte sur la couleur verte de la marque (5,8:1) |
| Texte | `#0E2233` / secondaire `#33495C` / discret `#5E7487` | |
| Dégradé ciel | `#E1F5FE` vers `#FFFFFF` | uniquement en haut des en-têtes de page |

## 2. Typographie

- Police **Manrope**, avec les variantes 400, 500, 600, 700 et 800.
- Chiffres en `tabular-nums` pour l'IQA, les valeurs et les tableaux.
- Échelle : 12 / 14 / 16 / 20 / 28 / 44 px. L'IQA principal est affiché en 44 px, graisse 800.
- Titres en casse de phrase (« Prévisions des 3 prochains jours », pas de Majuscule À Chaque Mot).

## 3. Formes et profondeur

- Rayons : 8 (champs), 12 (boutons, petites cartes), 16 (cartes), 24 (panneaux héros).
- Ombres légères et teintées de bleu (`SHADOW.card`) ; on préfère une bordure de 1 px à une ombre forte.
- Espacements sur une grille de 4 px ; marges généreuses (24 à 32 px entre les sections).

## 4. Afficher un niveau d'IQA

- **Jamais de gros bloc saturé** (pas de pastille orange pleine largeur).
- Le chiffre de l'IQA est en encre foncée, accompagné d'un **indicateur de couleur** : point, anneau ou barre fine de la couleur du niveau, plus le **libellé en toutes lettres**.
- La puce de niveau utilise le fond doux du niveau (`AQI_LEVELS[x].surface`), une bordure de la couleur du niveau et un texte foncé.
- La jauge est un arc fin sur une piste bleu très clair.

## 5. Écriture

- **Aucun tiret long ni tiret moyen** dans les textes de l'interface. On utilise « : », une virgule, « à » pour les intervalles (« 114 à 124 ») et **N/D** pour une valeur absente (`MISSING_VALUE` dans core).
- Phrases courtes, vocabulaire concret, vouvoiement.
- Pas d'emoji, pas de formules marketing (« révolutionnaire », « intelligent »…).

## 6. À éviter (look « template IA »)

Dégradés violets ou arc-en-ciel, verre dépoli (glassmorphism), emoji en guise d'icônes, cartes toutes identiques en grille infinie, badges partout, textes centrés en gros paragraphes, ombres lourdes, animations gratuites.

## 7. Composants clés

| Composant | Règle |
|---|---|
| Barre latérale (site public **et** admin, pas de barre de navigation en haut) | composant unique `AppShell` ; blanche, 248 px, repliable à 72 px (icônes seules), entrées regroupées par section, entrée active sur fond sky100 avec texte sky700 et un liseré de 3 px à gauche ; bloc utilisateur (nom, rôle, déconnexion) ou bouton Connexion en bas ; tiroir sur mobile, plus une barre d'onglets en bas de l'écran côté public |
| En-tête de page | dégradé ciel discret, titre en 28 px, sous-titre secondaire, actions à droite |
| Carte | blanche, bordure 1 px, rayon 16, padding 20 à 24 |
| Prévisions | une courbe unique sur les 6 horizons avec la bande de confiance (intervalle), puis deux listes compactes « Prochaines heures » et « Prochains jours » (heure, IQA, niveau, tendance, barre de confiance) ; les facteurs explicatifs dans un détail repliable |
| Tableaux admin | lignes de 52 px, en-têtes discrets en majuscules de 12 px, survol sky50, actions groupées à droite |
| États | chargement en squelette (blocs gris-bleu), vide avec une phrase et une action, erreur avec « Réessayer » |
