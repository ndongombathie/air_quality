# 05. Processus de développement

## 1. Démarrage

```bash
nvm use            # Node ≥ 20.19 (voir .nvmrc)
npm install        # à la racine : installe core, web et mobile (workspaces)

npm run web        # http://localhost:5173 (mode mock par défaut)
npm run mobile     # Expo : scanner le QR code avec Expo Go, ou a / i pour un émulateur

npm run check      # typecheck + tests + build web, à lancer avant chaque PR
```

Comptes de démonstration (**mode mock uniquement**), mot de passe `Demo2026!`, code MFA `123456` :
`citoyen@senair.sn` · `autorite@senair.sn` · `admin@senair.sn`.

Pour brancher le vrai backend : copier `.env.example` en `.env` dans l'app, passer le mode à `rest` et renseigner l'URL.

## 2. Flux Git

| Élément | Règle |
|---|---|
| Branches | `main` (toujours livrable) ← `feat/<sujet>`, `fix/<sujet>`, `docs/<sujet>`, `chore/<sujet>` |
| Commits | [Conventional Commits](https://www.conventionalcommits.org/fr/) avec portée : `feat(web): carte heatmap`, `fix(core): fraîcheur des mesures`, `docs(api): endpoint /forecasts` |
| PR | petite (≤ 400 lignes hors lockfile), description : objectif, captures mobile + desktop, checklist DoD, lien vers l'issue |
| Revue | 1 approbation minimum ; toute modification de `packages/core/src/api` est revue par un membre backend |
| Fusion | squash merge, CI verte obligatoire |
| Versions | SemVer ; tag `web-vX.Y.Z` / `mobile-vX.Y.Z` |

## 3. Cycle d'une fonctionnalité

1. **Besoin** : user story + critères d'acceptation ([04-fonctionnalites.md](./04-fonctionnalites.md)), rôle concerné.
2. **Contrat d'abord** : endpoint et schéma dans [08-api-endpoints.md](./08-api-endpoints.md) + `openapi.yaml` + `core/api` ; validé avec le backend.
3. **Mock** : implémentation dans `core/mock` + test → le front avance sans attendre le backend.
4. **UI** : composants accessibles, puis écran responsive ; états chargement / vide / erreur / hors-ligne / données anciennes.
5. **Vérification** : téléphone étroit (360 px), tablette, desktop ; clavier ; lecteur d'écran sur les éléments clés.
6. **Qualité** : `npm run check` vert.
7. **Sécurité** : relire la [checklist](./06-securite.md#6-checklist-de-revue).
8. **Documentation** : mettre à jour la doc concernée dans la même PR.
9. **Intégration** : passage en mode `rest` sur l'environnement de recette quand l'endpoint existe.

## 4. Definition of Done

- [ ] Critères d'acceptation vérifiés sur web **et** mobile (si concerné).
- [ ] Contrat API documenté ; mock et REST alignés.
- [ ] Aucun calcul métier dupliqué (IQA, seuils, couleurs…) hors de `@senair/core`.
- [ ] Fraîcheur et provenance affichées pour toute donnée environnementale.
- [ ] États chargement / vide / erreur / hors-ligne couverts.
- [ ] Accessible : libellés, contraste, focus, couleur jamais seule porteuse d'information.
- [ ] `npm run check` passe ; tests ajoutés pour la logique nouvelle.
- [ ] Pas de secret, pas de `console.log` de données personnelles.
- [ ] Documentation à jour.

## 5. Conventions de code

- TypeScript strict, pas de `any` ; types importés depuis `@senair/core`.
- Fichiers : composants `PascalCase.tsx`, hooks `useCamelCase.ts`, utilitaires `camelCase.ts`.
- Un composant = une responsabilité ; au-delà de ~200 lignes, découper.
- Pas de couleur en dur hors tokens du thème et couleurs IQA de core.
- Textes d'interface en français ; commentaires rares, en français, qui expliquent le *pourquoi*.
- Imports : bibliothèques → `@senair/core` → alias locaux (`@/…`) → relatifs.

## 6. Intégration continue

Le workflow [.github/workflows/ci.yml](../.github/workflows/ci.yml) exécute à chaque PR : installation (`npm ci`), typecheck des trois paquets, tests Vitest (core + web), build de production du web. Le build mobile natif (EAS Build) est déclenché manuellement pour les versions de test.

## 7. Environnements

| Environnement | Web | Mobile | API |
|---|---|---|---|
| Local | `npm run web` | Expo Go / émulateur | mock ou Django local |
| Recette | hébergement statique (Netlify, Vercel, Nginx) | EAS preview (APK interne, TestFlight) | API de recette |
| Production | HTTPS + en-têtes de sécurité ([06](./06-securite.md)) | stores | API de production |
