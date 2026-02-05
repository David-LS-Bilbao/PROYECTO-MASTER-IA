# Sprint 15 - Paso 3: Performance Monitoring & Distributed Tracing

**Status**: ✅ COMPLETADO
**Date**: 2026-02-05
**Type**: Implementation Document

---

## 📋 Objetivo

Implementar **Custom Spans** en operaciones críticas para obtener trazas distribuidas completas que permitan visualizar el flujo completo de requests:

```
User Click → Next.js (Frontend) → Express (Backend) → Gemini API → Database
```

---

## 🎯 Problema Resuelto

**ANTES**:
```
❌ Sentry captura errores pero NO performance
❌ No sabemos cuánto tarda Gemini API
❌ No vemos el flujo completo de la request
❌ Debugging de latencia es ciego: "¿Dónde se ralentiza?"
```

**DESPUÉS**:
```
✅ Trazas distribuidas completas (Frontend → Backend → AI)
✅ Vemos exactamente cuánto tarda cada operación
✅ Waterfall chart con cascada de spans
✅ Debugging con contexto: "Gemini tardó 2.3s en responder"
✅ Métricas de tokens y costes por operación
```

---

## 🏗️ Arquitectura Implementada

```
┌─────────────────────────────────────────────────────────────┐
│                    USER ACTION (BROWSER)                     │
│                                                              │
│  User clicks "Analizar Artículo"                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    NEXT.JS FRONTEND                          │
│  • Sentry captures Web Vitals                               │
│  • Creates transaction: "POST /api/analyze"                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
            ┌─────────────────────────┐
            │  Sentry Trace Headers   │
            │  (sentry-trace, baggage)│
            └─────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                   EXPRESS BACKEND                            │
│  • Sentry.Handlers.requestHandler() receives trace          │
│  • Creates span: "POST /api/analyze"                        │
│  • Calls AnalyzeUseCase.execute()                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                   GEMINI CLIENT                              │
│  • Custom span: "gemini.analyze_article"                    │
│  • Attributes: model, operation, content_length             │
│  • Calls model.generateContent()                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
            ┌─────────────────────────┐
            │    GEMINI API CALL      │
            │  (Google Cloud)         │
            │  Duration: 1.2s - 3.5s  │
            └─────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              GEMINI CLIENT (RESPONSE)                        │
│  • Adds token metrics to span:                              │
│    - ai.tokens.prompt: 450                                  │
│    - ai.tokens.completion: 200                              │
│    - ai.tokens.total: 650                                   │
│    - ai.cost_eur: 0.0013                                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                   SENTRY DASHBOARD                           │
│                                                              │
│  Transaction: "POST /api/analyze"                           │
│  Duration: 3.8s                                             │
│                                                              │
│  Waterfall Chart:                                           │
│    ├─ POST /api/analyze [3.8s] ──────────────────────────┐  │
│    │  ├─ gemini.analyze_article [3.5s] ───────────────┐  │  │
│    │  │  • ai.model: gemini-2.5-flash                 │  │  │
│    │  │  • ai.tokens.total: 650                       │  │  │
│    │  │  • ai.cost_eur: 0.0013                        │  │  │
│    │  └─────────────────────────────────────────────  │  │  │
│    │  ├─ db.saveAnalysis [0.3s] ───────────────────   │  │  │
│    └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Archivos Modificados

### ✅ `backend/src/infrastructure/external/gemini.client.ts` (+70 LOC)

**Cambios Principales**:

1. **Import Sentry**:
   ```typescript
   import { Sentry } from '../monitoring/sentry';
   ```

2. **Custom Span: Analyze Article**:
   ```typescript
   const result = await Sentry.startSpan(
     {
       name: 'gemini.analyze_article',
       op: 'ai.generation',
       attributes: {
         'ai.model': 'gemini-2.5-flash',
         'ai.operation': 'article_analysis',
         'input.content_length': sanitizedContent.length,
       },
     },
     async () => await this.model.generateContent(prompt)
   );
   ```

3. **Token Metrics en Span**:
   ```typescript
   const activeSpan = Sentry.getActiveSpan();
   if (activeSpan) {
     activeSpan.setAttribute('ai.tokens.prompt', promptTokens);
     activeSpan.setAttribute('ai.tokens.completion', completionTokens);
     activeSpan.setAttribute('ai.tokens.total', totalTokens);
     activeSpan.setAttribute('ai.cost_eur', costEstimated);
   }
   ```

4. **Custom Span: Generate Embedding**:
   ```typescript
   const embedding = await Sentry.startSpan(
     {
       name: 'gemini.generate_embedding',
       op: 'ai.embedding',
       attributes: {
         'ai.model': 'text-embedding-004',
         'ai.operation': 'embedding_generation',
         'input.text_length': truncatedText.length,
       },
     },
     async () => { /* ... */ }
   );
   ```

5. **Custom Span: Grounding Chat (with Google Search)**:
   ```typescript
   const result = await Sentry.startSpan(
     {
       name: 'gemini.chat_with_grounding',
       op: 'ai.chat',
       attributes: {
         'ai.model': 'gemini-2.5-flash',
         'ai.operation': 'grounding_chat',
         'ai.grounding.enabled': true,
         'chat.message_count': recentMessages.length,
       },
     },
     async () => await this.chatModel.generateContent(prompt)
   );
   ```

6. **Custom Span: RAG Chat (without Google Search)**:
   ```typescript
   const result = await Sentry.startSpan(
     {
       name: 'gemini.rag_chat',
       op: 'ai.chat',
       attributes: {
         'ai.model': 'gemini-2.5-flash',
         'ai.operation': 'rag_chat',
         'ai.grounding.enabled': false,
         'rag.context_length': context.length,
       },
     },
     async () => await this.model.generateContent(ragPrompt)
   );
   ```

7. **Custom Span: RSS Discovery**:
   ```typescript
   return await Sentry.startSpan(
     {
       name: 'gemini.discover_rss',
       op: 'ai.generation',
       attributes: {
         'ai.model': 'gemini-2.5-flash',
         'ai.operation': 'rss_discovery',
       },
     },
     async () => { /* ... */ }
   );
   ```

---

## 🎨 Custom Spans Implementados

| Operación | Span Name | Operation Type | Atributos Clave |
|-----------|-----------|----------------|-----------------|
| **Analizar Artículo** | `gemini.analyze_article` | `ai.generation` | `ai.model`, `input.content_length`, `ai.tokens.*`, `ai.cost_eur` |
| **Generar Embedding** | `gemini.generate_embedding` | `ai.embedding` | `ai.model`, `input.text_length`, `ai.embedding.dimensions` |
| **Chat con Grounding** | `gemini.chat_with_grounding` | `ai.chat` | `ai.model`, `ai.grounding.enabled`, `chat.message_count`, `ai.tokens.*` |
| **Chat RAG** | `gemini.rag_chat` | `ai.chat` | `ai.model`, `rag.context_length`, `ai.tokens.*`, `ai.cost_eur` |
| **Descubrir RSS** | `gemini.discover_rss` | `ai.generation` | `ai.model`, `ai.operation` |

---

## 🧪 Cómo Probar

### PASO 1: Verificar Configuración de Tracing

**Backend** (`backend/src/infrastructure/monitoring/sentry.ts`):
```bash
cd backend
cat src/infrastructure/monitoring/sentry.ts | grep tracesSampleRate
# Debe mostrar: tracesSampleRate: isDevelopment ? 1.0 : 0.1
```

**Frontend** (`frontend/sentry.client.config.ts`):
```bash
cd frontend
cat sentry.client.config.ts | grep tracesSampleRate
# Debe mostrar: tracesSampleRate: isDevelopment ? 1.0 : 0.1
```

### PASO 2: Iniciar Servidor Backend

```bash
cd backend
npm run dev
```

**Output esperado**:
```
✅ Sentry initialized for backend
🚀 Verity News API running on http://localhost:3000
```

### PASO 3: Iniciar Servidor Frontend

```bash
cd frontend
npm run dev
```

**Output esperado**:
```
✅ Sentry client initialized
ready - started server on 0.0.0.0:3001
```

### PASO 4: Ejecutar Operación que Llame a Gemini

**Opción A: Analizar Artículo**

1. Abrir navegador: `http://localhost:3001`
2. Login con usuario de prueba
3. Ir a "Analizar Artículo"
4. Pegar URL de artículo (ej: `https://elpais.com/...`)
5. Click "Analizar"
6. Esperar respuesta (~3-5 segundos)

**Opción B: Chat con Artículo**

1. Abrir navegador: `http://localhost:3001`
2. Login con usuario de prueba
3. Ir a un artículo analizado
4. Abrir chat
5. Escribir pregunta: "¿Cuál es el tema principal?"
6. Enviar mensaje
7. Esperar respuesta

**Opción C: cURL al Backend**

```bash
# POST /api/analyze (requiere autenticación)
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "url": "https://elpais.com/example-article"
  }'
```

### PASO 5: Verificar en Sentry Dashboard

1. **Ir a https://sentry.io/**
2. **Login en tu cuenta**
3. **Seleccionar proyecto backend**
4. **Ir a "Performance" en el menú lateral**
5. **Buscar la transacción reciente**:
   ```
   POST /api/analyze
   o
   POST /api/chat
   ```
6. **Click en la transacción** → Ver detalles:
   - **Waterfall Chart**: Gráfico de cascada con todos los spans
   - **Span `gemini.analyze_article`**:
     - Duration: 1.2s - 3.5s
     - Attributes:
       ```
       ai.model: gemini-2.5-flash
       ai.operation: article_analysis
       input.content_length: 2450
       ai.tokens.prompt: 450
       ai.tokens.completion: 200
       ai.tokens.total: 650
       ai.cost_eur: 0.0013
       ```
   - **Span `db.saveAnalysis`** (si existe):
     - Duration: 0.1s - 0.5s

---

## 🎯 Validación Exitosa

✅ **Criterios de Éxito**:

1. **Transaction visible en Sentry Performance**
   ```
   POST /api/analyze - 3.8s
   ```

2. **Waterfall Chart con Custom Spans**
   ```
   ├─ POST /api/analyze [3.8s]
   │  ├─ gemini.analyze_article [3.5s]
   │  └─ db.saveAnalysis [0.3s]
   ```

3. **Atributos de AI presentes en el span**
   ```
   ai.model: gemini-2.5-flash
   ai.tokens.total: 650
   ai.cost_eur: 0.0013
   ```

4. **Frontend → Backend trace conectados**
   ```
   Frontend: GET /dashboard
   → Backend: POST /api/analyze
     → Gemini: gemini.analyze_article
   ```

5. **Métricas de costes visibles**
   ```
   ai.cost_eur visible en cada span de Gemini
   ```

---

## 📊 Comparativa: Antes vs Después

| Aspecto | ANTES | DESPUÉS |
|---------|-------|---------|
| **Error Tracking** | ✅ | ✅ |
| **Stack Trace** | ✅ | ✅ |
| **Breadcrumbs** | ✅ | ✅ |
| **Performance Monitoring** | ❌ | ✅ |
| **Custom Spans** | ❌ | ✅ |
| **Distributed Tracing** | ❌ | ✅ |
| **Waterfall Chart** | ❌ | ✅ |
| **AI Token Metrics** | ❌ | ✅ |
| **Cost per Operation** | ❌ | ✅ |
| **Latency Breakdown** | ❌ | ✅ |

---

## 🔧 Configuración de Producción

### Sample Rates Recomendados

```env
# Production .env
SENTRY_TRACES_SAMPLE_RATE=0.1    # Solo 10% de traces
SENTRY_PROFILES_SAMPLE_RATE=0.1  # Solo 10% de profiles

# Reducir costes de Sentry sin perder visibilidad:
# - 10% de requests es suficiente para identificar problemas
# - Errores SIEMPRE se capturan (100%)
```

### Filtrar Transacciones Ruidosas

En `backend/src/infrastructure/monitoring/sentry.ts`:

```typescript
beforeSend: (event, hint) => {
  // Skip health checks (too noisy)
  if (event.request?.url?.includes('/health')) {
    return null;
  }

  return event;
},
```

---

## 🚨 Troubleshooting

### Error: "No spans visible in Sentry"

**Síntoma**: Transaction aparece pero sin custom spans

**Solución**:
1. Verificar que `tracesSampleRate` es 1.0 en desarrollo
2. Verificar import de Sentry: `import { Sentry } from '../monitoring/sentry'`
3. Verificar que `Sentry.startSpan()` está envolviendo la operación

### Error: "Frontend and Backend traces not connected"

**Síntoma**: Frontend y Backend aparecen como transacciones separadas

**Solución**:
1. Verificar CORS permite headers `sentry-trace` y `baggage`:
   ```typescript
   app.use(cors({
     origin: ['http://localhost:3001'],
     allowedHeaders: ['sentry-trace', 'baggage', 'authorization'],
   }));
   ```

2. Verificar que `Sentry.Handlers.requestHandler()` está ANTES de las rutas

### Error: "Token metrics not visible"

**Síntoma**: Span visible pero sin atributos de tokens

**Solución**:
1. Verificar que `usageMetadata` existe en la respuesta de Gemini
2. Verificar que `activeSpan.setAttribute()` se llama DENTRO del span
3. Revisar logs del backend para confirmar que tokens existen

---

## 📈 Próximos Pasos (Paso 4)

1. **Database Tracing**:
   - Custom spans para queries de Prisma
   - Identificar queries lentas

2. **Custom Metrics**:
   - Métricas de negocio (análisis/día, chat/usuario)
   - Alertas basadas en umbrales

3. **Alertas Automáticas**:
   - Slack notification si latencia > 10s
   - Email alert si error rate > 5%

4. **Dashboards Personalizados**:
   - AI Cost Dashboard (coste por operación)
   - Performance Baseline Dashboard
   - User Impact Analysis

---

## 🎓 Conceptos Clave

### ¿Qué es un Span?

Un **span** representa una unidad de trabajo dentro de una transacción. Es como un paso dentro de un proceso más grande.

**Ejemplo**:
```
Transaction: POST /api/analyze [5s total]
  ├─ Span 1: gemini.analyze_article [3.5s]
  ├─ Span 2: db.saveAnalysis [0.5s]
  └─ Span 3: cache.store [0.3s]
```

### ¿Qué es Distributed Tracing?

**Distributed Tracing** permite seguir una request a través de múltiples servicios:
- Frontend → Backend → AI API → Database

Sentry conecta los spans usando headers:
- `sentry-trace`: ID de la transacción
- `baggage`: Contexto adicional

### ¿Por qué Custom Spans?

Los custom spans nos permiten:
1. **Identificar bottlenecks**: "Gemini tarda 3.5s de los 4s totales"
2. **Medir costes**: "Esta operación costó €0.0013 en AI"
3. **Optimizar**: "El 80% del tiempo se va en Gemini, no en DB"

---

## 📚 Recursos

- [Sentry Performance Monitoring](https://docs.sentry.io/platforms/node/performance/)
- [Sentry Custom Instrumentation](https://docs.sentry.io/platforms/node/performance/instrumentation/custom-instrumentation/)
- [Distributed Tracing](https://docs.sentry.io/product/performance/distributed-tracing/)
- [Sentry Span Attributes](https://docs.sentry.io/platforms/node/enriching-events/context/)

---

**Completado por**: Site Reliability Engineer (SRE)
**Fecha**: 2026-02-05
**Próximo**: Paso 4 - Database Tracing & Custom Metrics

