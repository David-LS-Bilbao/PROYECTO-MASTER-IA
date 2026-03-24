# Runbook: Reproducir Entorno en Otro Equipo

Objetivo:

- dejar `PROYECTO-MASTER-IA` operativo en otro equipo;
- trabajar sobre `feat/media-bias-atlas-bootstrap`;
- reproducir el entorno local usado en esta rama sin cambios innecesarios;
- no tocar `main`;
- no subir secretos a Git;
- no hacer refactors ni limpiezas globales.

## 1. Principios de trabajo

El agente debe seguir estas reglas:

- limitarse a configuracion local, arranque, migraciones, seeds y validacion;
- no modificar arquitectura;
- no cambiar rutas ni componentes si no hay un bloqueo real;
- no regenerar o commitear artefactos no necesarios;
- no tocar archivos ajenos a la puesta en marcha;
- si falta una credencial sensible, detenerse y pedir exactamente esa credencial;
- no inventar valores de secretos.

Cambios permitidos:

- crear o editar archivos ignorados como `.env`, `.env.local` y `backend/service-account.json`;
- levantar contenedores locales;
- aplicar migraciones;
- ejecutar seeds;
- arrancar procesos de backend y frontend;
- hacer verificaciones HTTP y pruebas locales.

Cambios no permitidos salvo bloqueo real:

- refactors;
- cambios de naming o UX;
- cambios de backend;
- cambios en `main`;
- cambios en `media-bias-atlas/backend/package-lock.json`;
- cambios en `media-bias-atlas/frontend/package-lock.json`;
- commitear `media-bias-atlas/backend/src/generated/`;
- commitear secretos o service accounts.

## 2. Rama y estado objetivo

Rama de trabajo:

```bash
git fetch
git switch feat/media-bias-atlas-bootstrap
git pull
```

Estado final esperado:

- Verity backend: `http://localhost:3000`
- Media Bias Atlas backend: `http://localhost:3001`
- Verity frontend: `http://localhost:3002`
- Media Bias Atlas frontend: `http://localhost:3004`

Y ademas:

- login Google en Verity operativo;
- `http://localhost:3002/profile` operativo;
- `http://localhost:3002/admin/ai-usage` operativo;
- launcher de `Media Bias Atlas` en el sidebar de Verity operativo;
- Media Bias Atlas con datos de demo cargados, no vacio.

## 3. Archivos que hay que leer antes de actuar

Leer primero:

- `README.md`
- `backend/.env.example`
- `frontend/.env.local.example`
- `media-bias-atlas/backend/.env.example`
- `media-bias-atlas/frontend/README.md`
- `docker-compose.yml`

## 4. Infraestructura base

Desde la raiz del repo:

```bash
docker compose up -d postgres redis chromadb
```

Notas:

- PostgreSQL usa imagen `pgvector/pgvector:pg16`
- expone `5433` para Verity
- expone `5432` por compatibilidad adicional
- Verity usa `verity_news`
- Media Bias Atlas usa `media_bias_atlas`

## 5. Verity backend

### 5.1 Archivo local requerido

Crear `backend/.env` a partir de `backend/.env.example`.

Minimos:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://admin:adminpassword@localhost:5433/verity_news
GEMINI_API_KEY=...
NEWSAPI_KEY=...
```

### 5.2 Firebase Admin es obligatorio para login real

Sin Firebase Admin, el frontend puede hacer login con Google pero el backend devolvera `401` en `/api/user/me`.

Opciones validas:

1. Variables `FIREBASE_*` en `backend/.env`
2. archivo local `backend/service-account.json`

Forma recomendada para desarrollo:

- descargar la private key desde Firebase Console
- colocar el JSON en `backend/service-account.json`

Si falta este archivo o las `FIREBASE_*`, el agente debe detenerse y pedirlo.

### 5.3 Migraciones y arranque

```bash
cd backend
npm install
npx prisma migrate deploy
npm run dev
```

### 5.4 Verificacion minima

```bash
curl http://localhost:3000/health/check
```

Debe responder `200`.

## 6. Verity frontend

### 6.1 Archivo local requerido

Crear `frontend/.env.local` a partir de `frontend/.env.local.example`.

Variables importantes:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_MEDIA_BIAS_ATLAS_URL=http://localhost:3004
```

Las `NEXT_PUBLIC_FIREBASE_*` del ejemplo deben estar presentes.

### 6.2 Puerto correcto

No arrancar en `3001`.

Arrancar en `3002`:

```bash
cd frontend
npm install
npx next dev -p 3002
```

### 6.3 Verificaciones

Comprobar:

- `http://localhost:3002`
- `http://localhost:3002/profile`
- `http://localhost:3002/admin/ai-usage`

Y validar:

- el sidebar muestra `Media Bias Atlas`
- el launcher apunta a `http://localhost:3004`
- el perfil abre correctamente
- el CTA `Abrir AI Observer` navega a `/admin/ai-usage`

## 7. Media Bias Atlas backend

### 7.1 Archivo local requerido

Crear `media-bias-atlas/backend/.env` a partir de `media-bias-atlas/backend/.env.example`.

Base recomendada:

```env
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://admin:adminpassword@localhost:5433/media_bias_atlas?schema=public
```

Para analisis ideologico real con Gemini:

```env
BIAS_AI_PROVIDER=gemini
BIAS_AI_API_KEY=...
BIAS_AI_MODEL=gemini-2.5-flash
BIAS_AI_TIMEOUT_MS=20000
```

### 7.2 Creacion de bases y migraciones

```bash
cd media-bias-atlas/backend
npm install
npm run db:setup
npx prisma migrate deploy
```

### 7.3 Seed base y datos de demo

Sin seeds, MBA puede arrancar pero quedar vacio.

Ejecutar:

```bash
npm run db:seed
npm run db:seed:spain
npm run db:seed:uk
npm run db:seed:france
npm run db:seed:germany
npm run db:seed:usa
```

### 7.4 Arranque

```bash
npm run dev
```

### 7.5 Verificaciones

```bash
curl http://localhost:3001/health
```

Y comprobar que existan medios y feeds en la base.

## 8. Media Bias Atlas frontend

Crear `media-bias-atlas/frontend/.env.local` si no existe:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
```

Arrancar en `3004`:

```bash
cd media-bias-atlas/frontend
npm install
npx next dev -p 3004
```

Verificar:

- `http://localhost:3004`
- catalogo de paises visible
- outlets visibles en paises seeded

## 9. Pruebas funcionales minimas

Comprobaciones obligatorias:

1. `GET http://localhost:3000/health/check`
2. `GET http://localhost:3001/health`
3. abrir `http://localhost:3002`
4. abrir `http://localhost:3002/profile`
5. abrir `http://localhost:3002/admin/ai-usage`
6. abrir `http://localhost:3004`

Comprobaciones de producto:

- login Google en Verity funciona;
- `/api/user/me` no devuelve `401`;
- `Profile` carga;
- `AI Observer` carga;
- el sidebar de Verity abre MBA;
- MBA muestra datos de outlets y feeds.

## 10. Diagnostico rapido de fallos

### Caso A: login Google funciona pero `/profile` falla con `401`

Causa mas probable:

- falta `backend/service-account.json`
- o faltan `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

Accion:

- no tocar frontend;
- configurar Firebase Admin en backend.

### Caso B: MBA abre pero no muestra resultados

Causa mas probable:

- faltan migraciones;
- faltan seeds;
- la base `media_bias_atlas` esta vacia.

Accion:

- ejecutar `npm run db:setup`
- `npx prisma migrate deploy`
- `npm run db:seed`
- seeds manuales por pais

### Caso C: el launcher de MBA abre mal o no abre

Revisar:

- `frontend/.env.local`
- `NEXT_PUBLIC_MEDIA_BIAS_ATLAS_URL=http://localhost:3004`

### Caso D: `/admin/ai-usage` no carga

Revisar:

- Verity backend en `3000`
- MBA backend en `3001`
- variables de AI usage del frontend
- que el frontend de Verity corra en `3002`

## 11. Politica de cambios minimos

El agente debe preferir:

- crear `.env` locales antes que editar archivos tracked;
- usar los ejemplos ya existentes;
- no tocar backend ni componentes si el problema es de entorno;
- no regenerar archivos si no son necesarios;
- no commitear package-lock ajenos ni artefactos generados.

Solo si encuentra un bug real reproducible que impida la puesta en marcha y no sea de configuracion:

- identificar archivo exacto;
- hacer el cambio minimo;
- explicar por que era bloqueante.

## 12. Informe final esperado del agente

Cuando termine, debe devolver:

1. que configuro
2. que comandos ejecuto
3. que URLs quedaron operativas
4. que validaciones paso
5. que bloqueos reales quedan, si existen

Si falta una credencial sensible, debe detenerse con una peticion concreta, por ejemplo:

- "Falta backend/service-account.json de Firebase Admin"
- "Falta BIAS_AI_API_KEY para analisis real en MBA"
