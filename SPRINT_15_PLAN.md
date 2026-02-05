# 🚀 Sprint 15: Observabilidad & Analytics ("Ojos en Producción")

**Status**: 🔄 IN PROGRESS
**Date**: 2026-02-05
**Theme**: Full-Stack Error Tracking, Structured Logging, Performance Monitoring

---

## 📋 Objetivos Sprint 15

### Objetivo 1: Trazabilidad de Errores (Sentry)
✅ Capturar errores en frontend y backend en tiempo real
✅ Incluir stack trace exacto, usuario afectado, pasos para reproducir
✅ Alertas automáticas en Slack/Email cuando surge error crítico

### Objetivo 2: Logs Estructurados en la Nube
✅ Integrar Pino logs como "Breadcrumbs" en Sentry
✅ Contexto completo del error (request, usuario, estado)
✅ Historial de eventos previos al crash

### Objetivo 3: Performance Monitoring
✅ Identificar endpoints lentos antes de quejas de usuarios
✅ Métricas de Core Web Vitals en frontend
✅ Latencia de API y CPU/Memory del servidor

### Objetivo 4: Distributed Tracing
✅ Conectar errores frontend ↔ backend
✅ Ver traza completa de request desde UI hasta DB
✅ Identificar dónde ocurre el problema exactamente

---

## 🎯 Plan de Implementación (3 Pasos)

### PASO 1: Configuración de Sentry Full Stack
**Estimado**: 1-2 horas

```
├─ Backend (Express)
│  ├─ Instalar @sentry/node
│  ├─ Inicializar antes de middleware
│  ├─ Capturar errores en errorHandler
│  ├─ Integración con Pino logs
│  └─ Performance monitoring
│
└─ Frontend (Next.js)
   ├─ Instalar @sentry/nextjs
   ├─ Configurar en next.config.js
   ├─ Capturar errores en error boundary
   ├─ Web Vitals tracking
   └─ Session replay (opcional)
```

### PASO 2: Integración con Logs Estructurados
**Estimado**: 1-2 horas

```
├─ Backend
│  ├─ Crear transport de Pino hacia Sentry
│  ├─ Mapear niveles (error → captureException)
│  ├─ Agregar contexto de usuario/request
│  └─ Breadcrumbs automáticos
│
└─ Frontend
   ├─ Logger utility para frontend
   ├─ Integración con console logs
   └─ User context en errores
```

### PASO 3: Performance Monitoring & Alertas
**Estimado**: 1-2 horas

```
├─ Backend
│  ├─ Trace de requests (response time)
│  ├─ Métricas de DB queries
│  ├─ Alertas en Slack
│  └─ Dashboard en Sentry
│
└─ Frontend
   ├─ Web Vitals (CLS, FID, LCP)
   ├─ Custom performance metrics
   ├─ Error rate tracking
   └─ User session analytics
```

---

## 📦 Dependencias a Instalar

### Backend
```bash
npm install @sentry/node @sentry/tracing
```

### Frontend
```bash
npm install @sentry/nextjs @sentry/tracing
```

---

## 🔧 Paso 1: Configuración Backend

### 1.1 Instalar Sentry SDK
```bash
cd backend
npm install @sentry/node @sentry/tracing
```

### 1.2 Crear configuración (`backend/src/infrastructure/monitoring/sentry.config.ts`)
```typescript
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

export function initSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    integrations: [
      nodeProfilingIntegration(),
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.OnUncaughtException(),
    ],
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    attachStacktrace: true,
    maxBreadcrumbs: 50,
  });
}

export { Sentry };
```

### 1.3 Inicializar en index.ts (ANTES de middleware)
```typescript
import { initSentry } from './infrastructure/monitoring/sentry.config';

initSentry();
const app = createServer();
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

### 1.4 Capturar en errorHandler
```typescript
import { Sentry } from '../monitoring/sentry.config';

export const errorHandler = (err: any, req: Request, res: Response) => {
  Sentry.captureException(err, {
    tags: {
      endpoint: req.path,
      method: req.method,
    },
    user: {
      id: req.user?.uid,
      email: req.user?.email,
    },
  });
  // ... resto del handler
};
```

---

## 🎨 Paso 1: Configuración Frontend

### 1.1 Instalar Sentry SDK
```bash
cd frontend
npm install @sentry/nextjs @sentry/tracing
```

### 1.2 Crear `frontend/sentry.client.config.ts`
```typescript
import * as Sentry from '@sentry/nextjs';

export function initSentry() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    integrations: [
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}
```

### 1.3 Crear `frontend/sentry.server.config.ts`
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});
```

### 1.4 Integrar en `next.config.js`
```javascript
const { withSentryConfig } = require('@sentry/nextjs');

module.exports = withSentryConfig(nextConfig, {
  org: 'your-org',
  project: 'your-project',
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
```

---

## 📊 Archivos a Crear

### Backend
```
backend/src/infrastructure/monitoring/
├── sentry.config.ts          (NEW - Sentry initialization)
├── sentry-transport.ts       (NEW - Pino to Sentry transport)
└── pino.config.ts            (UPDATE - Integrate Sentry transport)
```

### Frontend
```
frontend/
├── sentry.client.config.ts   (NEW - Client config)
├── sentry.server.config.ts   (NEW - Server config)
├── lib/
│   └── sentry-client.ts      (NEW - Client wrapper)
└── next.config.js            (UPDATE - Sentry config)
```

---

## 🧪 Tests a Crear

### Backend
```
backend/tests/infrastructure/monitoring/
└── sentry.config.spec.ts     (Test Sentry initialization & error capture)
```

### Frontend
```
frontend/tests/
├── sentry.client.spec.ts     (Test client error capture)
└── sentry.server.spec.ts     (Test server error capture)
```

---

## ✅ Checklist Paso 1

- [ ] Crear cuenta en Sentry (si no existe)
- [ ] Obtener DSN para Backend
- [ ] Obtener DSN para Frontend
- [ ] Instalar dependencias backend
- [ ] Instalar dependencias frontend
- [ ] Configurar Sentry Backend
- [ ] Configurar Sentry Frontend
- [ ] Integrar en index.ts
- [ ] Integrar en next.config.js
- [ ] Crear tests de inicialización
- [ ] Validar que errores se capturan en Sentry
- [ ] Documentar en SPRINT_15.md

---

## 📝 Variables de Entorno

### Backend (.env)
```
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
```

### Frontend (.env.local)
```
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
```

---

## 🎯 KPIs de Éxito

- ✅ Todos los errores 500 en backend capturados
- ✅ Todos los ErrorCard en frontend capturados
- ✅ Errores llegan a Sentry en <100ms
- ✅ Contexto completo (usuario, request, stack trace)
- ✅ Breadcrumbs previos al error visible
- ✅ Performance de endpoints >1s detectado
- ✅ Alertas en Slack/Email configuradas

---

## 🚀 Próximos Pasos (Paso 2)

1. Integración Pino ↔ Sentry
2. Structured logging con contexto
3. Custom performance metrics
4. Error boundary en frontend
5. Alertas automáticas

---

**Actualizado**: 2026-02-05
**Responsable**: Senior Full Stack Engineer (Claude)
**Tipo**: Planning Document