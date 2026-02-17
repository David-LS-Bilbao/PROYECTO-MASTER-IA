# Pre-Merge Playbook (Render + Prisma + News API)

**Fecha:** 2026-02-17  
**Objetivo:** evitar fallos al desplegar en `main` (Render) al crear ramas nuevas de pruebas/feature.

---

## Contexto del incidente

En deploys recientes falló producción por una combinación de:

- `GET /api/news` devolviendo `500` por `analysis` legacy con JSON inválido.
- `GET /` devolviendo `404` (health check de plataforma).
- `prisma migrate deploy` fallando por config/variables en build/runtime.
- `npm ci` fallando en Docker por `postinstall -> prisma generate` sin `DATABASE_URL`.

---

## Checklist obligatorio por rama nueva

## 1) Validación local mínima

Backend:

```powershell
cd backend
npm run typecheck
npx vitest run
npm run test:coverage
```

Frontend:

```powershell
cd frontend
npx tsc --noEmit
npm run test:run
npm run test:e2e:smoke
```

---

## 2) Paridad Docker (antes de merge)

Ejecutar build local de la imagen backend:

```powershell
docker build -f backend/Dockerfile backend -t verity-news-backend:premerge
```

Si este paso falla, **no mergear** a `main`.

---

## 3) Revisión rápida de puntos críticos de deploy

Verificar en `backend/Dockerfile`:

- Copia `prisma.config.ts` en builder y runner.
- `HEALTHCHECK` usa `http://localhost:3001/health/check`.
- `CMD` incluye migraciones antes de arrancar:
  - `npx prisma migrate deploy && node dist/index.js`

Verificar en backend:

- Existe `GET /` y responde 200 (JSON simple, sin secretos).
- Existe `GET /health` y `GET /health/check`.

---

## 4) Reglas Prisma (clave)

- `prisma.config.ts` debe tolerar build sin `.env` (fallback para build-time).
- En Render, `DATABASE_URL` debe estar configurada en variables del servicio.
- `prisma migrate deploy` se ejecuta en runtime con la URL real.

---

## 5) Post-deploy smoke (Render)

Después de deploy en `main`, validar:

```powershell
curl.exe -s "https://verity-news-api.onrender.com/"
curl.exe -s "https://verity-news-api.onrender.com/health/readiness"
curl.exe -s "https://verity-news-api.onrender.com/api/news?limit=20&offset=0"
```

Esperado:

- `/` -> `status: "ok"`
- `/health/readiness` -> `status: "ready"` y `database: "connected"`
- `/api/news` -> `success: true` (sin `500`)

---

## 6) Mapa rápido de errores

`Route with identifier / not found`

- Causa: falta ruta raíz.
- Acción: añadir `GET /` antes del not-found global.

`The datasource.url property is required ... prisma migrate deploy`

- Causa: Prisma no encuentra URL en config/env.
- Acción: revisar `prisma.config.ts`, copia en Docker y env `DATABASE_URL` en Render.

`npm ci` falla en `npx prisma generate` durante build

- Causa: build-time sin `DATABASE_URL`.
- Acción: fallback seguro en `prisma.config.ts` para generar client sin secretos.

`GET /api/news ... 500`

- Causa frecuente: `analysis` legacy con JSON corrupto.
- Acción: parse seguro (`getParsedAnalysis`) y test de regresión.

---

## Criterio de merge a `main`

Merge permitido solo si:

1. Tests backend/frontend en verde.
2. `docker build` backend en verde.
3. Checklist de rutas/Prisma completado.
4. Smoke post-deploy en Render validado.

