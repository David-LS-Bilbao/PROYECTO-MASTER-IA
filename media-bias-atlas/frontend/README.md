# Media Bias Atlas Frontend

Frontend de `media-bias-atlas`, construido con Next.js, para visualizar el atlas de países, medios, feeds RSS, artículos clasificados y perfiles ideológicos agregados.

Importante:

- este frontend trabaja exclusivamente contra `media-bias-atlas/backend`;
- no comparte runtime ni rutas con `Verity News`;
- para que funcione correctamente necesita que el backend esté levantado y que PostgreSQL esté disponible a través del backend.

## Estado actual del MVP

El frontend queda alineado con el estado funcional alcanzado hasta Sprint 10:

- catálogo de países;
- listado de medios por país;
- alta manual de medios;
- detalle de medio con feeds RSS;
- visor de artículos de un feed;
- clasificación política y análisis ideológico visibles en UI;
- resumen ideológico por feed;
- perfil ideológico por medio;
- enriquecimiento del listado principal de outlets con `biasSummary`;
- filtros y ordenación MVP del listado de outlets;
- comparativa rápida entre dos medios;
- manejo controlado de errores si backend o base de datos no están disponibles.

## Rutas principales

- `/`
  - catálogo de países;
  - muestra un aviso claro si la API o la base de datos no están disponibles.
- `/countries/[code]`
  - listado de medios de un país;
  - resumen ideológico básico por medio;
  - filtros por disponibilidad, estado e ideología;
  - ordenación por nombre, análisis completados o perfil disponible primero;
  - comparativa rápida entre dos medios.
- `/outlets/new`
  - alta manual de un nuevo medio.
- `/outlets/[id]`
  - detalle del medio;
  - perfil ideológico agregado del outlet;
  - feeds RSS configurados.
- `/feeds/[id]`
  - visor de artículos ingeridos del feed;
  - clasificación política por artículo;
  - estado del análisis ideológico;
  - resumen agregado por feed;
  - acciones para clasificar y analizar.

## Requisitos

Necesitas estos servicios activos:

1. `media-bias-atlas/backend` en `http://localhost:3001`
2. PostgreSQL accesible desde el backend
3. para análisis ideológico real:
   - variables `BIAS_AI_*` configuradas en `media-bias-atlas/backend/.env`

Variables relevantes del frontend:

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api`

## Desarrollo local

### 1. Backend

En otra terminal:

```bash
cd "../backend"
npm install
npm run dev
```

### 2. Frontend

```bash
npm install
npm run dev
```

Abre:

- `http://localhost:3000`

## Build y validación

Typecheck:

```bash
npx tsc --noEmit
```

Tests:

```bash
TMPDIR=/tmp TEMP=/tmp TMP=/tmp npx vitest run
```

Build:

```bash
npm run build
```

## Relación con backend

El frontend consume principalmente estos endpoints:

- `GET /api/countries`
- `GET /api/countries/:code/outlets`
- `GET /api/outlets/:id`
- `POST /api/outlets`
- `GET /api/outlets/:id/feeds`
- `GET /api/outlets/:outletId/bias-profile`
- `POST /api/feeds/:feedId/sync`
- `GET /api/feeds/:feedId/articles`
- `POST /api/feeds/:feedId/classify-political`
- `POST /api/feeds/:feedId/analyze-bias`
- `GET /api/feeds/:feedId/bias-summary`
- `POST /api/articles/:articleId/analyze-bias`
- `GET /api/articles/:articleId/bias-analysis`

## Notas operativas

- Si PostgreSQL no está disponible, la home no rompe con un error crudo: ahora muestra un aviso legible.
- Si `BIAS_AI_PROVIDER=disabled`, la UI sigue siendo usable, pero los análisis ideológicos persistirán como `FAILED` o quedarán pendientes de activación real.
- El análisis ideológico del MVP trabaja con los datos persistidos del artículo, principalmente `title`, `url` y `publishedAt`.

## Resumen técnico

Stack principal:

- Next.js 16
- React 19
- TypeScript
- Testing Library + Vitest
- consumo de API propia vía `apiFetch`

Patrones usados:

- server components para páginas de consulta;
- componentes cliente ligeros para filtros, comparativas y acciones;
- query params para filtros y comparativas compartibles;
- componentes reutilizables para alertas, estados vacíos y tarjetas de perfil ideológico.
