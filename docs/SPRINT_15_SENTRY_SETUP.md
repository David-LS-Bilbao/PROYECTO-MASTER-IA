# Sprint 15: Sentry Full-Stack Setup Guide 🔍

**Status**: ✅ CONFIGURACIÓN COMPLETADA
**Date**: 2026-02-05
**Type**: Implementation Guide

---

## 📋 Resumen de lo Implementado

### ✅ Backend (Express + Node.js)
- [x] Instalar `@sentry/node` + `@sentry/profiling-node`
- [x] Crear `backend/src/infrastructure/monitoring/sentry.ts`
- [x] Modificar `backend/src/index.ts` para inicializar Sentry ANTES de otros códigos
- [x] Modificar `backend/src/infrastructure/http/server.ts` para agregar middleware de Sentry
- [x] Agregar variables en `backend/.env.example`

### ✅ Frontend (Next.js)
- [x] Instalar `@sentry/nextjs`
- [x] Crear `frontend/sentry.client.config.ts`
- [x] Crear `frontend/sentry.server.config.ts`
- [x] Crear `frontend/components/providers/sentry-provider.tsx`
- [x] Modificar `frontend/next.config.ts` con `withSentryConfig`
- [x] Modificar `frontend/app/layout.tsx` para usar SentryProvider
- [x] Modificar `frontend/components/providers/global-error-boundary.tsx` para capturar en Sentry
- [x] Agregar variables en `frontend/.env.example`

---

## 🚀 Configuración Paso a Paso

### PASO 1: Crear Proyecto en Sentry

1. **Ir a https://sentry.io/**
2. **Crear cuenta o login**
3. **Crear nuevo proyecto**
   - Name: `verity-news-backend` (para backend)
   - Platform: Node.js → Express
   - Organization: (tu org)
   - Team: (tu team)

4. **Anotar el DSN**
   ```
   https://your-unique-key@sentry.io/your-project-id
   ```

5. **Repetir para frontend**
   - Name: `verity-news-frontend`
   - Platform: JavaScript → React
   - DSN: (anotar)

---

### PASO 2: Configurar Backend

1. **Copiar variable de entorno**
   ```bash
   cd backend
   cp .env.example .env
   ```

2. **Editar `.env` y agregar Sentry**
   ```env
   SENTRY_DSN=https://your-backend-dsn@sentry.io/your-id
   SENTRY_ENVIRONMENT=development
   SENTRY_TRACES_SAMPLE_RATE=1.0
   SENTRY_PROFILES_SAMPLE_RATE=1.0
   RELEASE_VERSION=local-dev
   ```

3. **Instalar dependencias (ya hecho)**
   ```bash
   npm install @sentry/node @sentry/profiling-node
   ```

4. **Verificar archivos creados**
   ```
   backend/src/infrastructure/monitoring/sentry.ts ✅
   ```

5. **Iniciar servidor**
   ```bash
   npm run dev
   # Deberías ver:
   # ✅ Sentry initialized for backend
   # 🚀 Verity News API running on http://localhost:3000
   ```

---

### PASO 3: Configurar Frontend

1. **Copiar variables de entorno**
   ```bash
   cd frontend
   cp .env.example .env.local
   ```

2. **Editar `.env.local` y agregar Sentry**
   ```env
   NEXT_PUBLIC_SENTRY_DSN=https://your-frontend-dsn@sentry.io/your-id
   SENTRY_DSN=https://your-frontend-dsn@sentry.io/your-id
   NEXT_PUBLIC_SENTRY_ENVIRONMENT=development
   NEXT_PUBLIC_RELEASE_VERSION=local-dev
   ```

3. **Instalar dependencias (ya hecho)**
   ```bash
   npm install @sentry/nextjs
   ```

4. **Verificar archivos creados**
   ```
   frontend/sentry.client.config.ts ✅
   frontend/sentry.server.config.ts ✅
   frontend/components/providers/sentry-provider.tsx ✅
   ```

5. **Iniciar servidor**
   ```bash
   npm run dev
   # Deberías ver:
   # ✅ Sentry client initialized
   # ready - started server on 0.0.0.0:3001
   ```

---

## 🧪 Probar que Sentry Funciona

### Opción 1: Backend - Simular Error 500

**Crear un endpoint de prueba** (temporal)

En `backend/src/infrastructure/http/routes/health.routes.ts`:

```typescript
// Agregar al router:
router.get('/test-sentry', (req, res, next) => {
  try {
    throw new Error('🧪 Test: Error capturado por Sentry');
  } catch (error) {
    next(error); // Pasará a Sentry → errorHandler
  }
});
```

**Ejecutar**:
```bash
curl http://localhost:3000/health/test-sentry
```

**Resultado esperado**:
- ❌ Response: 500 error en consola
- ✅ En Sentry Dashboard: Ver el error listado

---

### Opción 2: Frontend - Simular Error en Component

**Crear componente de prueba** (temporal)

En `frontend/app/test-sentry/page.tsx`:

```typescript
'use client';

import { captureSentryException } from '@/sentry.client.config';

export default function TestSentryPage() {
  return (
    <div className="p-8">
      <h1>Prueba de Sentry</h1>
      <button
        onClick={() => {
          try {
            throw new Error('🧪 Test: Error capturado por Sentry (Frontend)');
          } catch (error) {
            captureSentryException(error);
            alert('Error capturado y enviado a Sentry');
          }
        }}
        className="bg-red-500 text-white px-4 py-2 rounded"
      >
        Simular Error
      </button>
    </div>
  );
}
```

**Ejecutar**:
1. Navegar a `http://localhost:3001/test-sentry`
2. Click en botón "Simular Error"
3. Alert aparece
4. Ir a Sentry Dashboard → deber ver el error

---

### Opción 3: Error Boundary - Componente que Falla

**Crear componente que genera error** (temporal):

```typescript
export function BrokenComponent() {
  // Simular error de renderizado
  throw new Error('🧪 Test: Error en renderizado (Error Boundary)');
}
```

**Usar en página**:
```typescript
import { BrokenComponent } from '@/components/broken';

export default function TestErrorBoundaryPage() {
  return <BrokenComponent />; // Esto fallará
}
```

**Resultado**:
- ErrorCard aparece
- ✅ Error capturado en Error Boundary
- ✅ Sentry Dashboard muestra error

---

## 📊 Ver Errores en Sentry Dashboard

1. **Ir a https://sentry.io/**
2. **Login en tu cuenta**
3. **Seleccionar proyecto (backend o frontend)**
4. **Ver la lista de "Issues"**
5. **Click en un issue para ver detalles**:
   - Stack trace
   - Usuario afectado (si está logueado)
   - Breadcrumbs (qué pasó antes)
   - Release version
   - Tiempo del error

---

## 📁 Archivos Modificados/Creados

### Backend
```
✅ backend/src/infrastructure/monitoring/sentry.ts (NEW - 129 LOC)
✅ backend/src/index.ts (MODIFIED - +9 lines)
✅ backend/src/infrastructure/http/server.ts (MODIFIED - +11 lines)
✅ backend/.env.example (MODIFIED - +10 lines)
```

### Frontend
```
✅ frontend/sentry.client.config.ts (NEW - 121 LOC)
✅ frontend/sentry.server.config.ts (NEW - 47 LOC)
✅ frontend/components/providers/sentry-provider.tsx (NEW - 23 LOC)
✅ frontend/next.config.ts (MODIFIED - Wrapped with withSentryConfig)
✅ frontend/app/layout.tsx (MODIFIED - +1 line)
✅ frontend/components/providers/global-error-boundary.tsx (MODIFIED - +7 lines)
✅ frontend/.env.example (NEW - 34 LOC)
```

---

## 🔐 Variables de Entorno

### Backend `.env` (SECRETO - NO SUBIR A GIT)
```env
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
RELEASE_VERSION=1.0.0
```

### Frontend `.env.local` (SECRETO - NO SUBIR A GIT)
```env
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_RELEASE_VERSION=1.0.0
```

---

## 🎯 Características Habilitadas

### ✅ Error Tracking
- [x] Backend: Todos los errores 500 capturados
- [x] Frontend: Todos los errores no manejados
- [x] Error Boundary: Errores de renderizado

### ✅ Performance Monitoring
- [x] Backend: Latencia de requests (tracing)
- [x] Frontend: Web Vitals (LCP, FID, CLS)
- [x] Sample rates configurables

### ✅ User Context
- [x] Usuario autenticado asociado a errores
- [x] Email del usuario en error report

### ✅ Breadcrumbs
- [x] Historial de eventos previos al error
- [x] HTTP requests
- [x] Console logs

### ✅ Profiling (Backend)
- [x] CPU profiling
- [x] Memory tracking
- [x] Throughput monitoring

### ✅ Session Replay (Frontend)
- [x] Video de acciones usuario antes del error
- [x] Redacted para privacidad (sin datos sensibles)

---

## 📈 Próximos Pasos (Paso 2)

1. **Integración Pino ↔ Sentry**
   - Transport de Pino a Sentry
   - Breadcrumbs automáticos de logs

2. **Custom Metrics**
   - API latency tracking
   - Database query performance
   - Business metrics (análisis/usuario)

3. **Alertas**
   - Slack notification en error crítico
   - Email alerts para regresiones

4. **Dashboards**
   - Error trends
   - User impact analysis
   - Performance baselines

---

## 🆘 Troubleshooting

### Error: "SENTRY_DSN is empty"
**Solución**: Verificar que .env tiene el DSN correcto
```bash
cat .env | grep SENTRY_DSN
```

### Error: "Cannot POST to Sentry"
**Solución**: Verificar conexión a internet y DSN correcto

### Error no aparece en Sentry
**Solución**:
1. Esperar 5-10 segundos (procesamiento de Sentry)
2. Refresh dashboard
3. Verificar que el DSN es correcto

### Performance lento
**Solución**: Reducir sample rate en producción
```env
SENTRY_TRACES_SAMPLE_RATE=0.1  # Solo 10% de requests
```

---

## 📚 Recursos

- [Sentry Docs](https://docs.sentry.io/)
- [Sentry Node.js](https://docs.sentry.io/platforms/node/)
- [Sentry Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Performance Monitoring](https://docs.sentry.io/platforms/node/performance/)

---

**Próximo**: Paso 2 - Integración Pino + Custom Metrics
**Responsable**: DevOps Engineer / SRE
**Fecha**: 2026-02-05
