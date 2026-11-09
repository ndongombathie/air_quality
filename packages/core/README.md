# @senair/core

Socle partagé par `senair.web` et `senair.mobile`. Aucune dépendance UI : uniquement TypeScript et zod. Publié comme sources TS (consommé directement par Vite et Metro).

```text
src/
├── domain/        règles métier pures : aqi, pollutants, thresholds, health, forecast, format
├── auth/          rôles → permissions, hasPermission()
├── api/
│   ├── types.ts       DTO du contrat /api/v1 (miroir de docs/api/openapi.yaml)
│   ├── endpoints.ts   chemins REST (source unique)
│   ├── contracts.ts   ports SenairApi (une interface par domaine)
│   ├── http.ts        client fetch : jeton, refresh sur 401, timeout, query string
│   ├── errors.ts      ApiError normalisée + messages utilisateurs
│   ├── rest.ts        adaptateur REST (1 opération = 1 endpoint)
│   └── create.ts      createSenairApi({ mode: 'rest' | 'mock', ... })
├── mock/          adaptateur de démonstration déterministe (permissions, MFA, audit)
└── validation/    schémas zod des formulaires
```

```ts
import { createSenairApi, getAqiLevel } from '@senair/core';

const api = createSenairApi({ mode: 'rest', baseUrl: 'https://api.senair.sn/api/v1', getAccessToken: () => token });
const summary = await api.airQuality.summary();
const level = getAqiLevel(summary.aqi); // { label: 'Modéré', color: '#F5C400', ... }
```

```bash
npm run typecheck --workspace @senair/core
npm test --workspace @senair/core
```

Règle : toute évolution de `api/` est reportée dans [docs/08-api-endpoints.md](../../docs/08-api-endpoints.md) et [docs/api/openapi.yaml](../../docs/api/openapi.yaml), et implémentée dans `rest.ts` **et** `mock/api.ts`.
