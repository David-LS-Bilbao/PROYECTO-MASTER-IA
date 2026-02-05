# Sprint 15 - Paso 2: Integración Pino → Sentry Breadcrumbs

**Status**: ✅ COMPLETADO
**Date**: 2026-02-05
**Type**: Implementation Document

---

## 📋 Objetivo

Integrar logs de Pino con Sentry para que los eventos de logging se conviertan en **breadcrumbs** (migas de pan) que proporcionen contexto cuando ocurra un error.

---

## 🎯 Problema Resuelto

**ANTES**:
```
❌ Error ocurre en producción
❌ Sentry captura el error pero SIN contexto
❌ No sabemos qué pasó ANTES del error
❌ Debugging es ciego: "¿Qué usuario? ¿Qué endpoint? ¿Qué pasos previos?"
```

**DESPUÉS**:
```
✅ Error ocurre en producción
✅ Sentry captura error + breadcrumbs
✅ Vemos timeline completo de eventos previos
✅ Debugging con contexto: "Usuario X llamó endpoint Y, warning Z, luego error"
```

---

## 🏗️ Arquitectura Implementada

```
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION CODE                          │
│                                                              │
│  logger.info('User logged in');                             │
│  logger.warn('Rate limit approaching');                     │
│  throw new Error('Payment failed');  ← ERROR                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    PINO LOGGER                               │
│  • Redact PII (authorization, cookies, passwords)           │
│  • Serialize requests/responses                             │
│  • Apply custom serializers                                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
              ┌───────────┴───────────┐
              ↓                       ↓
┌─────────────────────────┐  ┌────────────────────────┐
│   STREAM 1: CONSOLE     │  │  STREAM 2: SENTRY      │
│                         │  │                        │
│  • Development: Pretty  │  │  • SentryStream class  │
│  • Production: JSON     │  │  • Writable stream     │
└─────────────────────────┘  └────────────────────────┘
                                       ↓
                          ┌────────────────────────────┐
                          │  SENTRY.addBreadcrumb()    │
                          │                            │
                          │  • info → info breadcrumb  │
                          │  • warn → warning breadcrumb│
                          │  • error → error breadcrumb│
                          └────────────────────────────┘
                                       ↓
                          ┌────────────────────────────┐
                          │   SENTRY DASHBOARD         │
                          │                            │
                          │  Issue: "Payment failed"   │
                          │  Breadcrumbs:              │
                          │    1. User logged in       │
                          │    2. Rate limit warning   │
                          │    3. → Payment failed     │
                          └────────────────────────────┘
```

---

## 📁 Archivos Creados/Modificados

### ✅ ARCHIVOS CREADOS

#### 1. `backend/src/infrastructure/logger/sentry-stream.ts` (NEW - 144 LOC)

**Propósito**: Stream personalizado que convierte logs de Pino en breadcrumbs de Sentry.

**Clase Principal**: `SentryStream extends Writable`

**Métodos**:
- `_write()`: Procesa cada log entry y envía a Sentry
- `shouldSkipLog()`: Filtra logs ruidosos (health checks, trace en prod)
- `extractContext()`: Extrae contexto relevante del log (req, err, custom fields)

**Mapeo de Niveles**:
```typescript
Pino Level → Sentry Level
10 (trace) → debug
20 (debug) → debug
30 (info)  → info
40 (warn)  → warning
50 (error) → error
60 (fatal) → fatal
```

**Filtros Implementados**:
- ✅ Skip health checks (evitar ruido)
- ✅ Skip trace en producción (demasiado verbose)
- ✅ Extract solo campos relevantes (evitar metadata de Pino)

**Redacción de PII**:
```
✅ Respeta redacción de Pino (aplicada ANTES del stream)
✅ No envía passwords, tokens, authorization headers
✅ Sentry recibe logs YA limpios
```

---

### ✅ ARCHIVOS MODIFICADOS

#### 1. `backend/src/infrastructure/logger/logger.ts` (REFACTORED)

**Cambios Principales**:

**ANTES** (Single stream):
```typescript
export const logger = pino({
  level: 'info',
  transport: { target: 'pino-pretty' }, // Solo console
});
```

**DESPUÉS** (Multistream):
```typescript
const streams = [
  { level: 'info', stream: consoleStream },      // Console
  { level: 'debug', stream: createSentryStream() }, // Sentry breadcrumbs
];

export const logger = pino(baseConfig, pino.multistream(streams));
```

**Configuración Condicional**:
```typescript
// Si Sentry no está configurado → logger simple (como antes)
if (!isSentryEnabled) {
  return pino(baseConfig);
}

// Si Sentry está configurado → multistream
return pino(baseConfig, pino.multistream(streams));
```

**Redacción PII Mejorada**:
```typescript
redact: {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["x-api-key"]',
    'res.headers["set-cookie"]',
    'password',    // NEW
    'token',       // NEW
    'apiKey',      // NEW
    'secret',      // NEW
  ],
  remove: true, // Eliminar completamente (no solo redactar)
}
```

---

#### 2. `backend/src/infrastructure/http/routes/health.routes.ts` (MODIFIED)

**Endpoint Agregado**: `GET /health/test-sentry-breadcrumbs`

**Propósito**: Validar que logs → breadcrumbs funcionan correctamente

**Flujo de Prueba**:
```typescript
1. logger.info('Paso 1 - Iniciando operación')
   → Sentry breadcrumb (info)

2. logger.warn('Paso 2 - Algo huele raro')
   → Sentry breadcrumb (warning)

3. logger.info({ userId: 'test-123' }, 'Paso 3 - Log con contexto')
   → Sentry breadcrumb (info) + userId en data

4. throw new Error('Boom!')
   → Sentry captures error WITH 3 breadcrumbs above
```

---

## 🧪 Cómo Probar

### PASO 1: Configurar Variables

Asegúrate de que `.env` tiene `SENTRY_DSN`:
```bash
cd backend
cat .env | grep SENTRY_DSN
# Debe mostrar: SENTRY_DSN=https://...@sentry.io/...
```

### PASO 2: Iniciar Servidor

```bash
cd backend
npm run dev
```

**Output esperado**:
```
✅ Sentry initialized for backend
🚀 Verity News API running on http://localhost:3000
```

### PASO 3: Ejecutar Test

**Terminal 1** (Logs del servidor):
```bash
# Observar los logs en tiempo real
```

**Terminal 2** (Trigger test):
```bash
curl http://localhost:3000/health/test-sentry-breadcrumbs
```

**Output esperado en Terminal 1**:
```
INFO: 🧪 Test: Paso 1 - Iniciando operación
WARN: 🧪 Test: Paso 2 - Algo huele raro
INFO: 🧪 Test: Paso 3 - Log con contexto
ERROR: Error: 🧪 Test: Boom! Error intencional
```

**Output esperado en Terminal 2**:
```json
{
  "status": 500,
  "message": "Internal Server Error"
}
```

### PASO 4: Verificar en Sentry Dashboard

1. **Ir a https://sentry.io/**
2. **Login** en tu cuenta
3. **Seleccionar proyecto backend**
4. **Ver Issues** → Debería aparecer:
   ```
   Issue: "🧪 Test: Boom! Error intencional"
   ```
5. **Click en el issue** → Ver detalles:
   - **Stack trace** del error
   - **Breadcrumbs** (3 eventos previos):
     ```
     [info]    🧪 Test: Paso 1 - Iniciando operación
     [warning] 🧪 Test: Paso 2 - Algo huele raro
     [info]    🧪 Test: Paso 3 - Log con contexto
                { userId: 'test-user-123', action: 'test' }
     ```
   - **Environment**: development
   - **Release**: local-dev
   - **Request context**: GET /health/test-sentry-breadcrumbs

---

## 🎯 Validación Exitosa

✅ **Criterios de Éxito**:

1. **Logs visibles en consola** (Stream 1 funciona)
   ```bash
   INFO: 🧪 Test: Paso 1 - Iniciando operación
   WARN: 🧪 Test: Paso 2 - Algo huele raro
   ```

2. **Error visible en Sentry** (Stream 2 funciona)
   ```
   Issue: "🧪 Test: Boom! Error intencional"
   ```

3. **Breadcrumbs presentes en Sentry** (Integración funciona)
   ```
   3 breadcrumbs attached to error
   ```

4. **Contexto preservado** (extractContext funciona)
   ```
   userId: 'test-user-123'
   action: 'test'
   ```

5. **Sin PII en Sentry** (Redacción funciona)
   ```
   authorization: [REDACTED]
   password: [REMOVED]
   ```

---

## 📊 Comparativa: Antes vs Después

| Aspecto | ANTES | DESPUÉS |
|---------|-------|---------|
| **Error Tracking** | ✅ | ✅ |
| **Stack Trace** | ✅ | ✅ |
| **Request Context** | ✅ | ✅ |
| **User Context** | ✅ | ✅ |
| **Breadcrumbs (Logs)** | ❌ | ✅ |
| **Timeline de Eventos** | ❌ | ✅ |
| **Contexto Previo** | ❌ | ✅ |
| **Debugging Ciego** | ❌ | ✅ |

---

## 🔧 Configuración de Producción

### Sample Rates Recomendados

```env
# Production .env
SENTRY_TRACES_SAMPLE_RATE=0.1    # 10% de traces
SENTRY_PROFILES_SAMPLE_RATE=0.1  # 10% de profiles
LOG_LEVEL=info                    # No enviar debug/trace logs
```

### Filtros de Logs

En `sentry-stream.ts`, ya implementados:

```typescript
✅ Skip /health endpoint (demasiado ruido)
✅ Skip trace logs en producción
✅ Extract solo campos relevantes
```

Para agregar más filtros:
```typescript
// En shouldSkipLog()
if (log.req?.url?.includes('/metrics')) {
  return true; // Skip metrics endpoint
}
```

---

## 🚨 Troubleshooting

### Error: "Stream 2 not working"
**Síntoma**: Logs visibles en consola pero no breadcrumbs en Sentry

**Solución**:
1. Verificar `SENTRY_DSN` en `.env`
2. Verificar que Sentry se inicializó: `✅ Sentry initialized for backend`
3. Esperar 5-10 segundos (procesamiento de Sentry)

### Error: "Too many breadcrumbs"
**Síntoma**: Sentry muestra 50+ breadcrumbs (límite)

**Solución**:
Agregar filtros en `shouldSkipLog()`:
```typescript
if (log.level === 20) { // debug
  return true;
}
```

### Error: "PII visible en Sentry"
**Síntoma**: Passwords o tokens visibles en breadcrumbs

**Solución**:
Agregar campos a `redact.paths` en `logger.ts`:
```typescript
redact: {
  paths: [
    'password',
    'token',
    'apiKey',
    'yourCustomField', // ADD HERE
  ],
}
```

---

## 📈 Próximos Pasos (Paso 3)

1. **Custom Metrics**
   - API latency tracking
   - Database query performance
   - Business metrics

2. **Alertas Automáticas**
   - Slack notifications
   - Email alerts
   - PagerDuty integration

3. **Dashboards**
   - Error trends
   - Performance baselines
   - User impact analysis

---

## 🎓 Conceptos Clave

### ¿Qué son Breadcrumbs?

**Breadcrumbs** (migas de pan) son eventos que ocurren ANTES de un error. Sentry los almacena para proporcionar contexto.

**Ejemplo Real**:
```
Timeline:
10:00:00 - User logs in             [breadcrumb]
10:00:05 - User adds item to cart   [breadcrumb]
10:00:10 - User clicks checkout     [breadcrumb]
10:00:15 - Payment API called       [breadcrumb]
10:00:20 - → Error: Payment failed  [ERROR CAPTURED]

Sentry muestra:
  Error: Payment failed
  Breadcrumbs: 5 events leading to error
```

### ¿Por qué Multistream?

**Multistream** permite enviar logs a múltiples destinos simultáneamente:
- **Console**: Para debugging local y logs de producción
- **Sentry**: Para observabilidad y error tracking
- **Future**: File, Database, Elasticsearch, etc.

---

## 📚 Recursos

- [Pino Multistream](https://getpino.io/#/docs/api?id=pino-multistream)
- [Sentry Breadcrumbs](https://docs.sentry.io/platforms/node/enriching-events/breadcrumbs/)
- [Node.js Writable Stream](https://nodejs.org/api/stream.html#stream_class_stream_writable)

---

**Completado por**: Backend Developer (Observabilidad Specialist)
**Fecha**: 2026-02-05
**Próximo**: Paso 3 - Custom Metrics & Alertas
