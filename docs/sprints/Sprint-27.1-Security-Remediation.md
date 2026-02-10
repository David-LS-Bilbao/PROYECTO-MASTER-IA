# Sprint 27.1: Security Remediation e Ingest Hardening

**Fecha:** 2026-02-10  
**Estado:** ✅ Completado  
**Objetivo:** Endurecer la ingesta y validar inputs críticos siguiendo el plan de remediación.

---

## ✅ Cambios Técnicos

- **Express/Infra**
- `trust proxy` habilitado para IP real detrás de proxy.
- CORS actualizado para permitir `x-cron-secret`.

- **Ingest protegido**
- Middleware `requireCronSecret` en `/api/ingest/*`.
- Rechazo `401` si el header no coincide con `CRON_SECRET`.

- **Validación Zod (Query Params)**
- `SearchController`: `q` + `limit` con `safeParse` y errores 400.
- `NewsController`: `limit`, `offset`, `category`, `favorite` y `q` en search.

- **Promo Codes externos**
- `PROMO_CODES` en `.env` (coma-separado).
- `.env.example` actualizado con `CRON_SECRET` y `PROMO_CODES`.

---

## ✅ Sincronización Frontend

- `useNews` añade `x-cron-secret` con `NEXT_PUBLIC_CRON_SECRET` en refresh global.

---

## 🧪 Verificación Recomendada

- `POST /api/ingest/news` con header `x-cron-secret`.
- `GET /api/search?q=` inválido → 400.
- `POST /api/subscription/redeem` con `PROMO_CODES` válidos.

---

## 📁 Archivos Clave

- `backend/src/infrastructure/http/server.ts`
- `backend/src/infrastructure/http/routes/ingest.routes.ts`
- `backend/src/infrastructure/http/controllers/search.controller.ts`
- `backend/src/infrastructure/http/controllers/news.controller.ts`
- `backend/src/infrastructure/http/controllers/subscription.controller.ts`
- `backend/.env.example`
- `frontend/hooks/useNews.ts`

---

**Estado:** ✅ Remediación aplicada. Ingest seguro y validado.
