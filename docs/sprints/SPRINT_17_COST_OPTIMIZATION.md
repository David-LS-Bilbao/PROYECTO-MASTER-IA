# Sprint 17: Cost Optimization - Caché Global de Análisis + UX Fake Delay

## 🎯 Objetivo de Negocio
Reducir costes de API de IA mediante un sistema de **caché global de análisis** combinado con una estrategia de **minimum loading time** en el frontend para mantener la percepción de valor del servicio.

## 📊 Problema Identificado

### Backend (Costes)
- **Antes**: Cada usuario que solicita análisis del mismo artículo genera una nueva llamada a Gemini
- **Impacto**: Si 100 usuarios analizan el mismo artículo trending:
  - 100 llamadas a Gemini × ~1500 tokens = **150,000 tokens desperdiciados**
  - Costo: ~$0.0001 por 1000 tokens × 150 = **$0.015 por artículo**
  - Con 1000 artículos trending: **$15 desperdiciados/día**

### Frontend (UX)
- **Antes**: Respuesta de caché es instantánea (<100ms)
- **Problema**: Usuario percibe que "no hizo nada" o "falló"
- **Consecuencia**: Desconfianza en la calidad del análisis IA

## ✅ Solución Implementada

### 1. Backend: Caché Global de Análisis

**Archivo**: `backend/src/application/use-cases/analyze-article.usecase.ts` (líneas 115-146)

#### Lógica Implementada

El sistema verifica si el artículo ya tiene análisis previo. Si existe, lo retorna inmediatamente sin llamar a Gemini.

**Características del Caché:**
- ✅ **Global**: No depende del usuario que lo solicitó
- ✅ **Objetivo**: Basado en el contenido del artículo
- ✅ **Persistente**: Almacenado en PostgreSQL
- ✅ **Campos cacheados**: `summary`, `biasScore`, `analysis`, `analyzedAt`

### 2. Frontend: Minimum Loading Time (Fake Delay)

**Archivo**: `frontend/hooks/useArticleAnalysis.ts` (líneas 25-70)

#### Comportamiento

**Escenario 1: Análisis desde Caché (< 100ms)**
```
[0ms]    → Usuario click en "Analizar"
[0ms]    → setLoading(true)
[50ms]   → Respuesta del backend (caché global)
[50ms]   → Detecta remainingTime = 1950ms
[2000ms] → Muestra resultado (fake delay de 1950ms)
[2000ms] → setLoading(false)
```

**Escenario 2: Análisis Nuevo con IA (> 3000ms)**
```
[0ms]    → Usuario click en "Analizar"
[0ms]    → setLoading(true)
[3500ms] → Respuesta del backend (Gemini + scraping)
[3500ms] → remainingTime = negativo → no hay delay
[3500ms] → Muestra resultado inmediatamente
[3500ms] → setLoading(false)
```

## 📈 Impacto y Beneficios

### Ahorro de Costes (Backend)

**Escenario Real: Artículo Trending**
- 500 usuarios analizan el mismo artículo en 1 día

| Métrica | Sin Caché Global | Con Caché Global | Ahorro |
|---------|------------------|------------------|--------|
| Llamadas a Gemini | 500 | 1 | **99.8%** |
| Tokens procesados | 750,000 | 1,500 | **748,500** |
| Costo (USD) | $0.075 | $0.00015 | **$0.07485** |

**Proyección Mensual** (100 artículos trending × 500 análisis c/u):
- Sin optimización: **50,000 llamadas** = $7.50/mes
- Con optimización: **100 llamadas** = $0.015/mes
- **Ahorro: $7.485/mes (99.8%)** 💰

### Mejora de UX (Frontend)

**Antes (sin fake delay):**
- Usuario: "Click analizar"
- Sistema: *responde en 50ms*
- Usuario: "¿Funcionó? Parece que no hizo nada..."

**Ahora (con fake delay):**
- Usuario: "Click analizar"
- Sistema: *muestra spinner durante 2 segundos*
- Usuario: "Ok, la IA está procesando"

## 🔍 Logging y Monitoreo

### Logs del Backend

**Cuando se sirve desde caché:**
```
💰 [CACHÉ GLOBAL] Análisis ya existe en BD (analizado: 06/02/2026 18:30:15)
💰 Serving cached analysis → Gemini NO llamado → Ahorro de ~1500 tokens
📊 Score: 0.45 | Summary: El presidente del Gobierno español...
```

**Cuando se genera nuevo análisis:**
```
🤖 [NUEVA ANÁLISIS] Generando análisis con IA (este resultado se cacheará globalmente)...
✅ Gemini OK. Score: 0.52 | Summary: El Congreso aprobó hoy...
```

### Logs del Frontend

**Caché rápido (< 100ms):**
```
⏱️ [UX] Respuesta rápida (73ms) - Añadiendo 1927ms de delay para UX
```

**Análisis real (> 2s):**
```
⏱️ [UX] Análisis real completado en 3847ms (sin delay artificial)
```

## 🧪 Testing

### Test Backend: Verificar Caché Global

1. **Primera análisis (usuario A):**
   - Log esperado: `🤖 [NUEVA ANÁLISIS] Generando análisis con IA...`

2. **Segunda análisis (usuario B, mismo artículo):**
   - Log esperado: `💰 [CACHÉ GLOBAL] Análisis ya existe en BD`

3. **Verificar en BD:**
   ```sql
   SELECT id, title, "isAnalyzed", "analyzedAt", "biasScore"
   FROM articles
   WHERE id = 'article-123';
   ```

### Test Frontend: Verificar Fake Delay

1. **Análisis desde caché:**
   - Click en "Analizar IA" en un artículo ya analizado
   - Abrir DevTools → Console
   - Log esperado: `⏱️ [UX] Respuesta rápida (XXms) - Añadiendo YYYms de delay para UX`
   - Spinner debe mostrarse durante ~2 segundos

2. **Análisis nuevo:**
   - Log esperado: `⏱️ [UX] Análisis real completado en XXXXms (sin delay artificial)`
   - Spinner debe mostrarse durante el tiempo real (3-5s)

## ⚙️ Configuración

### Ajustar Minimum Loading Time

**Ubicación**: `frontend/hooks/useArticleAnalysis.ts`

**Actual: 2 segundos**
```typescript
const MIN_LOADING_TIME = 2000; // 2 segundos
```

**Para cambiar a 1.5 segundos:**
```typescript
const MIN_LOADING_TIME = 1500; // 1.5 segundos
```

**Para deshabilitar (solo desarrollo):**
```typescript
const MIN_LOADING_TIME = 0; // Sin delay artificial
```

## 📝 Notas Técnicas

### ¿Por qué Caché Global y no por Usuario?

1. **Objetividad**: El análisis es objetivo sobre el contenido, no subjetivo al usuario
2. **Consistencia**: Todos ven el mismo análisis para el mismo artículo
3. **Ahorro Máximo**: Análisis por usuario = 0% ahorro
4. **Arquitectura Simplificada**: No necesitamos tabla `user_analysis`

### ¿Por qué 2 Segundos de Delay?

**Psicología del Usuario:**
- Menos de 1s: Parece instantáneo, usuario desconfía
- 1-2s: Percepción de "procesamiento rápido pero real"
- 2-3s: Óptimo para operaciones IA ✅
- Más de 5s: Usuario se impacienta

**Benchmark de la Industria:**
- ChatGPT: 1-3s de "thinking time"
- Google Bard: 2-4s de animación
- Midjourney: 3-5s de "generating"

Nuestro **2 segundos** está en el sweet spot.

## 🚀 Próximas Mejoras

1. **Caché con TTL**: Para artículos <1h, re-analizar si contenido cambió
2. **Métricas de Ahorro**: Dashboard mostrando tokens/costos ahorrados
3. **A/B Testing**: Experimentar con diferentes tiempos (1.5s vs 2s vs 2.5s)
4. **Animación Rica**: Reemplazar spinner con cerebro animado + texto dinámico

## 📚 Archivos Modificados

- ✅ `backend/src/application/use-cases/analyze-article.usecase.ts` (líneas 115-146, 233)
- ✅ `frontend/hooks/useArticleAnalysis.ts` (líneas 25-70)
