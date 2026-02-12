# Informe de Auditoría Técnica - Verity News

## Sistema de Análisis de Noticias con IA

**Fecha:** 12 de febrero de 2026
**Versión auditada:** Sprint 30 (commit `21c012d`)
**Stack:** Express + TypeScript + Prisma + PostgreSQL (pgvector) | Next.js + React Query | Gemini 2.5 Flash

---

## Tabla de Contenidos

1. [Arquitectura General](#1-arquitectura-general)
2. [Pipeline de Ingestión](#2-pipeline-de-ingestión)
3. [Pipeline de Análisis IA](#3-pipeline-de-análisis-ia)
4. [Búsqueda Semántica (pgvector)](#4-búsqueda-semántica-pgvector)
5. [Sistema de Chat](#5-sistema-de-chat)
6. [Privacidad y Control de Acceso](#6-privacidad-y-control-de-acceso)
7. [Monetización (Modelo Freemium)](#7-monetización-modelo-freemium)
8. [Frontend - Presentación](#8-frontend---presentación)
9. [Observabilidad y Costes](#9-observabilidad-y-costes)
10. [Hallazgos y Mejoras Recomendadas](#10-hallazgos-y-mejoras-recomendadas)

---

## 1. Arquitectura General

### 1.1. Patrón Arquitectónico

El sistema sigue **Clean Architecture** con separación estricta en capas:

```
Domain Layer (Entidades, Interfaces, Errores)
    ↑
Application Layer (Use Cases, Servicios)
    ↑
Infrastructure Layer (Controllers, Prisma, Gemini, pgvector)
```

**Inyección de dependencias** centralizada en un **Singleton Container**:
- **Archivo:** `backend/src/infrastructure/config/dependencies.ts`
- Patrón: `DependencyContainer.getInstance()` inicializa TODOS los componentes
- Todas las dependencias se resuelven en el constructor del contenedor

### 1.2. Modelo de Datos (Prisma Schema)

**Archivo:** `backend/prisma/schema.prisma`

| Modelo | Descripción | Campos clave |
|--------|-------------|--------------|
| `User` | Usuarios (Firebase UID como PK) | `subscriptionPlan`, `location`, `preferences` (JSON), `usageStats` (JSON) |
| `Article` | Noticias ingestadas | `embedding` (vector 768-dim), `analysis` (JSON text), `biasScore`, `reliabilityScore`, `internalReasoning` |
| `Favorite` | Junction table usuario-artículo | `unlockedAnalysis` (boolean), PK compuesta `(userId, articleId)` |
| `Topic` | Categorías unificadas (8 topics) | `slug` (unique), `name`, `order` |
| `Source` | Fuentes RSS descubiertas por IA | `url`, `location`, `reliability`, `isActive` |
| `SearchHistory` | Historial de búsquedas | `query`, `filters` (JSON), `resultsCount` |
| `Chat` / `Message` | Conversaciones de chat | `role`, `content`, `sources` (JSON) |
| `IngestMetadata` | Registro de ingestiones | `source`, `lastFetch`, `status` |

**Extensiones PostgreSQL habilitadas:** `vector` (pgvector)

### 1.3. Autenticación

- **Proveedor:** Firebase JWT (verificación server-side con Firebase Admin SDK)
- **Middleware obligatorio (`authenticate`):** Verifica token, sincroniza usuario en BD (upsert), inyecta `req.user`
- **Middleware opcional (`optionalAuthenticate`):** Igual pero no falla si no hay token
- **Archivo:** `backend/src/infrastructure/http/middleware/auth.middleware.ts`
- **Persistencia de sesión:** `browserLocalPersistence` (IndexedDB) con secuenciación `authReady` → `onAuthStateChanged`

---

## 2. Pipeline de Ingestión

### 2.1. Flujo General

```
Trigger (Auto-fill / Manual / Cron)
    ↓
IngestNewsUseCase.execute()
    ↓
RSS Client (DirectSpanishRSS / GoogleNewsRSS / NewsAPI)
    ↓
Normalización de categoría (EN→ES mapping)
    ↓
Deduplicación batch (getExistingUrls → UPSERT)
    ↓
Persistencia en PostgreSQL
    ↓
Registro en IngestMetadata
```

**Archivo principal:** `backend/src/application/use-cases/ingest-news.usecase.ts`

### 2.2. Clientes RSS

| Cliente | Archivo | Uso |
|---------|---------|-----|
| `DirectSpanishRssClient` | `infrastructure/external/direct-spanish-rss.client.ts` | **Primario** - Feeds RSS directos de medios españoles |
| `GoogleNewsRssClient` | `infrastructure/external/google-news-rss.client.ts` | Fallback + Noticias locales (prefijo "noticias locales {ciudad}") |
| `NewsAPIClient` | `infrastructure/external/newsapi.client.ts` | Fallback opcional (requiere API key) |

**Selección de cliente:** Variable de entorno `NEWS_CLIENT` (`'newsapi'` | `'google-news'` | default: Direct Spanish RSS)

### 2.3. Categorías y Smart Queries

El diccionario `TOPIC_QUERIES` mapea topics a búsquedas optimizadas con operador OR:

```typescript
'deportes' → 'fútbol OR baloncesto OR deporte OR liga OR competición'
'economia' → 'economía OR finanzas OR mercado OR bolsa OR empresas'
'ciencia-tecnologia' → 'ciencia OR tecnología OR inteligencia artificial OR innovación'
```

### 2.4. Auto-fill de Categorías Vacías

Cuando `NewsController.getNews()` detecta una categoría vacía en la BD:
1. Dispara `ingestNewsUseCase.execute()` con `pageSize: 30`
2. Re-consulta la BD tras la ingestión
3. **Caso especial `ciencia-tecnologia`:** Ingesta paralela de `ciencia` Y `tecnologia`
4. **Caso especial `local`:** Ingesta con timeout configurable (`LOCAL_INGEST_TIMEOUT_MS = 6000ms`)

### 2.5. Ingestión Local (Sprint 24-28)

Flujo específico para noticias locales:

1. **Descubrimiento de fuentes IA** (`LocalSourceDiscoveryService.discoverAndSave(city)`)
2. **Fetch de fuentes descubiertas** (RSS directo de medios locales almacenados en tabla `Source`)
3. **Fetch híbrido** con Google News RSS (`"noticias locales {ciudad}"`)
4. **TTL cache** para evitar re-ingestión frecuente (`LOCAL_INGEST_TTL = 15 min`)
5. **Timeout con fallback:** Si la ingestión tarda más del timeout, devuelve datos cacheados en BD

### 2.6. Limites y Optimizaciones

| Parámetro | Valor | Propósito |
|-----------|-------|-----------|
| `MAX_ITEMS_PER_SOURCE` | 30 | Límite por ingestión para evitar floods |
| `BATCH_SIZE` (ingestAll) | 3 | Categorías en paralelo por lote |
| Delay entre lotes | 2000ms | Cortesía con fuentes RSS |
| `pageSize` default | 20 | Artículos por consulta a API externa |

---

## 3. Pipeline de Análisis IA

### 3.1. Flujo Completo

```
Usuario solicita análisis de artículo
    ↓
AnalyzeArticleUseCase.execute()
    ↓
¿Artículo ya analizado? (article.isAnalyzed)
    ├── SÍ → Devolver caché global ← AHORRO ~1500 tokens
    └── NO ↓
¿Contenido suficiente? (>100 chars)
    ├── SÍ → Usar contenido existente
    └── NO → Jina Reader scraping (con fallback a título+descripción)
        ↓
MetadataExtractor → Extraer og:image si no tiene
        ↓
Gemini 2.5 Flash → analyzeArticle()
        ↓
Guardar análisis en BD (caché global)
        ↓
Auto-favorite con unlockedAnalysis=true
        ↓
Generar embedding (text-embedding-004, 768 dims)
        ↓
Almacenar embedding en pgvector
```

**Archivo:** `backend/src/application/use-cases/analyze-article.usecase.ts`

### 3.2. Caché Global de Análisis

- **Concepto:** El análisis de una noticia es OBJETIVO (no depende del usuario)
- **Beneficio:** Si 100 usuarios piden análisis del mismo artículo → 1 llamada a Gemini, 99 servidas desde caché
- **Check:** `article.isAnalyzed` (campo `analyzedAt` no null)
- **Ahorro estimado:** ~99% en artículos populares

### 3.3. Prompt de Análisis (v4)

**Archivo:** `backend/src/infrastructure/external/prompts/analysis.prompt.ts`

**Constrainta global:** `"ANALIZA SOLO EL TEXTO PROPORCIONADO. NO AÑADAS INFORMACIÓN EXTERNA."`

**Output JSON esperado:**

```json
{
  "internal_reasoning": "<Chain-of-Thought: 3 preguntas obligatorias, max 300 chars>",
  "summary": "<Resumen periodístico 60-100 palabras: QUÉ/QUIÉN/CUÁNDO/DÓNDE/POR QUÉ>",
  "category": "<política|economía|tecnología|deportes|cultura|ciencia|mundo|sociedad>",
  "biasScore": "<Entero -10 a +10, 0=neutral>",
  "reliabilityScore": "<Entero 0-100>",
  "suggestedTopics": ["<máximo 3 temas>"],
  "analysis": {
    "biasType": "<encuadre|omisión|lenguaje|selección|ninguno>",
    "explanation": "<Transparencia AI Act, max 280 chars>"
  }
}
```

**Reglas de Reliability Score:**

| Rango | Criterio |
|-------|----------|
| < 40 | Clickbait, opinión sin datos, lenguaje incendiario |
| 40-60 | Noticia estándar sin citas externas claras |
| 60-80 | Cita fuentes genéricas ("según expertos") |
| > 80 | SOLO con citas directas a organismos oficiales, estudios científicos o enlaces verificables |

### 3.4. Normalización de Scores

- `biasScore` raw: -10 a +10 → Normalizado a 0-1 para UI: `Math.abs(biasRaw) / 10`
- `reliabilityScore`: 0-100 (sin normalización)
- `biasRaw` se preserva para auditoría

### 3.5. Campos de Salida Completos

El `parseAnalysisResponse()` extrae y valida:

| Campo | Tipo | Fuente |
|-------|------|--------|
| `internal_reasoning` | string | Chain-of-Thought (NO enviado al cliente) |
| `summary` | string | Resumen periodístico |
| `biasScore` | number (0-1) | Sesgo normalizado |
| `biasRaw` | number (-10 a +10) | Sesgo sin normalizar |
| `biasType` | string | Tipo de sesgo (encuadre, omisión, etc.) |
| `reliabilityScore` | number (0-100) | Fiabilidad |
| `clickbaitScore` | number (0-100) | Backward compat (no en prompt v4) |
| `sentiment` | 'positive' \| 'negative' \| 'neutral' | Backward compat |
| `mainTopics` | string[] | Temas principales (max 3) |
| `factCheck` | object | Claims, verdict, reasoning (backward compat) |
| `explanation` | string | Transparencia AI Act UE |
| `usage` | TokenUsage | Tokens consumidos y coste |

### 3.6. Scraping con Jina Reader

- **Archivo:** `backend/src/infrastructure/external/jina-reader.client.ts`
- **Uso:** Cuando `article.content` es vacío o muy corto (<100 chars)
- **Fallback:** Si Jina falla → usa `título + descripción` con advertencia en el prompt
- **Enriquecimiento:** También extrae `imageUrl` si el artículo no tiene

### 3.7. Extracción de Metadata

- **Archivo:** `backend/src/infrastructure/external/metadata-extractor.ts`
- **Propósito:** Extraer `og:image` de las URLs para artículos sin imagen
- **Timeout:** 2 segundos (no bloquea el análisis)

### 3.8. Análisis Batch

```typescript
executeBatch(input: { limit: number }): Promise<AnalyzeBatchOutput>
```

- Máximo: `MAX_BATCH_LIMIT = 100` artículos por lote
- Consulta `findUnanalyzed()` para obtener artículos pendientes
- Cada artículo pasa por el flujo completo de `execute()`
- Manejo de Rate Limit (429) con warning específico

---

## 4. Búsqueda Semántica (pgvector)

### 4.1. Arquitectura

| Componente | Detalle |
|------------|---------|
| **Extensión** | pgvector en PostgreSQL |
| **Modelo de embedding** | Gemini `text-embedding-004` |
| **Dimensiones** | 768 |
| **Índice** | HNSW con `vector_cosine_ops` |
| **Operador de distancia** | `<=>` (cosine distance) |
| **Almacenamiento** | Campo `embedding` en tabla `articles` (tipo `vector(768)`) |

**Archivo:** `backend/src/infrastructure/external/pgvector.client.ts`

### 4.2. Generación de Embeddings

Se genera al analizar un artículo (en `AnalyzeArticleUseCase`):

```typescript
const textToEmbed = `${title}. ${description || ''}. ${summary || ''}`;
const embedding = await geminiClient.generateEmbedding(textToEmbed);
await vectorClient.upsertItem(articleId, embedding, metadata, textToEmbed);
```

**Límites:** `MAX_EMBEDDING_TEXT_LENGTH = 6000` caracteres

### 4.3. Consultas de Similitud

**`querySimilar(queryVector, limit)`** - Retorna IDs ordenados por distancia coseno:
```sql
SELECT id, embedding <=> $vector::vector AS distance
FROM articles
WHERE embedding IS NOT NULL
ORDER BY distance ASC
LIMIT $limit
```

**`querySimilarWithDocuments(queryVector, limit)`** - Para RAG, retorna contenido completo:
```sql
SELECT id, title, content, source, "publishedAt", "biasScore",
       embedding <=> $vector::vector AS distance
FROM articles
WHERE embedding IS NOT NULL AND content IS NOT NULL
ORDER BY distance ASC
LIMIT $limit
```

### 4.4. Búsqueda Semántica (SearchNewsUseCase)

**Archivo:** `backend/src/application/use-cases/search-news.usecase.ts`

Flujo:
1. Genera embedding del query del usuario
2. Busca artículos similares con `querySimilar()`
3. Recupera artículos completos de la BD
4. Retorna resultados ordenados por relevancia semántica

---

## 5. Sistema de Chat

### 5.1. Chat de Artículo (RAG estricto)

**Archivo:** `backend/src/application/use-cases/chat-article.usecase.ts`

```
Usuario hace pregunta sobre un artículo específico
    ↓
Generar embedding de la pregunta
    ↓
pgvector → querySimilarWithDocuments() → contexto relevante
    ↓
Construir prompt RAG con contexto + pregunta
    ↓
Gemini 2.5 Flash (SIN Google Search) → respuesta
```

**Prompt RAG (Zero Hallucination Strategy v5):**
- **Archivo:** `backend/src/infrastructure/external/prompts/rag-chat.prompt.ts`
- Persona: "Analista de Inteligencia riguroso"
- **Regla 1:** Cada afirmación DEBE ir con citación `[1][2]`
- **Regla 3 (Incertidumbre Radical):** Si la respuesta no se puede derivar del contexto → respuesta por defecto: `"El contexto disponible no contiene datos suficientes..."`
- **Regla 4 (Trazabilidad):** Frase sin cita → se elimina
- **Máximo:** 150 palabras

### 5.2. Chat General (Knowledge-First)

**Archivo:** `backend/src/application/use-cases/chat-general.usecase.ts`

```
Usuario hace pregunta general
    ↓
Construir prompt con historial de conversación
    ↓
Gemini 2.5 Flash CON Google Search Grounding → respuesta
```

**Prompt General (Knowledge-First v2):**
- **Archivo:** `backend/src/infrastructure/external/prompts/general-chat.prompt.ts`
- Acceso completo al conocimiento de Gemini + Google Search en tiempo real
- **Máximo:** 200 palabras
- Sin restricciones de RAG - puede usar conocimiento general libremente

### 5.3. Optimizaciones de Chat

| Optimización | Detalle |
|--------------|---------|
| **Ventana deslizante** | `MAX_CHAT_HISTORY_MESSAGES` últimos mensajes (evita crecimiento exponencial) |
| **Sin RAG en Chat General** | No genera embeddings ni consulta pgvector → más eficiente |
| **Retry con backoff** | 3 reintentos, delay exponencial (1s, 2s, 4s) |
| **Sanitización de inputs** | Prevención de prompt injection (elimina backticks, llaves) |

### 5.4. ChatController - Endpoints

**Archivo:** `backend/src/infrastructure/http/controllers/chat.controller.ts`

| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `POST /api/chat/article` | `authenticate` | Chat sobre artículo específico (RAG) |
| `POST /api/chat/general` | `authenticate` | Chat general con conocimiento completo |

**Premium Gate:** Ambos endpoints verifican `quotaService.canAccessChat(user)` antes de procesar.

---

## 6. Privacidad y Control de Acceso

### 6.1. Separación Favorito vs Análisis Desbloqueado

**Concepto crítico (Sprint 18.2):**

| Concepto | Símbolo | Campo BD | Significado |
|----------|---------|----------|-------------|
| Favorito | ❤️ | `Favorite(userId, articleId)` | El usuario marcó "me gusta" |
| Análisis desbloqueado | ✨ | `Favorite.unlockedAnalysis = true` | El usuario solicitó el análisis IA |

### 6.2. Masking de Análisis

Cuando un usuario NO ha desbloqueado el análisis de un artículo:

```typescript
// En toHttpResponse() - news.controller.ts
if (maskAnalysis) {
  return {
    ...json,
    analysis: null,    // Oculto
    summary: null,     // Oculto
    biasScore: null,   // Oculto
    hasAnalysis: true,  // Señal: "existe análisis, puedes solicitarlo"
  };
}
```

### 6.3. XAI Compliance (EU AI Act)

- **`internal_reasoning`:** Chain-of-Thought almacenado para auditoría pero NUNCA enviado al cliente
- **`toJSON()`** en la entidad `NewsArticle` excluye `internalReasoning`
- **`explanation`:** Campo público que explica por qué se asignaron los scores (transparencia)

### 6.4. Seguridad

| Medida | Implementación |
|--------|---------------|
| **Sanitización de inputs** | `sanitizeInput()` en GeminiClient elimina backticks, llaves |
| **Validación con Zod** | Controllers usan schemas Zod para validar query params |
| **Redacción de PII en logs** | Pino logger con redaction, títulos como `[REDACTED]` |
| **CORS** | Configurado antes del Rate Limiter (Sprint 28.4) |
| **Rate Limiting** | 300 req/15min por IP |
| **Firebase JWT** | Verificación server-side con Admin SDK |

---

## 7. Monetización (Modelo Freemium)

### 7.1. Planes

| Plan | Análisis | Chat | Precio |
|------|----------|------|--------|
| **FREE** | Ilimitado | 7 días de prueba | Gratis |
| **PREMIUM** | Ilimitado | Ilimitado | De pago |

### 7.2. Premium Gate (Sprint 30)

**Backend:** `QuotaService.canAccessChat(user)`

```
¿Plan PREMIUM? → Acceso completo
¿Plan FREE + createdAt dentro de 7 días? → Trial activo
¿Plan FREE + más de 7 días? → Bloqueado (HTTP 403 CHAT_FEATURE_LOCKED)
```

**Frontend:** Hook `useCanAccessChat()` retorna `{ canAccess, reason, daysRemaining? }`

**Razones posibles:** `PREMIUM` | `TRIAL_ACTIVE` | `TRIAL_EXPIRED` | `NOT_AUTHENTICATED` | `LOADING`

---

## 8. Frontend - Presentación

### 8.1. Página de Detalle de Artículo

**Archivo:** `frontend/app/news/[id]/page.tsx`

**Flujo de análisis:**
1. Usuario hace clic en "Analizar"
2. Se llama a `analyzeArticle(articleId, token)`
3. Si análisis está cacheado + desbloqueado → **Artificial Reveal** (delay falso de 1.8s con skeleton)
4. Si análisis es nuevo → Se muestra progreso real de Gemini
5. Resultado: summary, biasScore, reliabilityScore, explanation

### 8.2. Tarjetas de Noticias

**Archivo:** `frontend/components/news/news-card.tsx`

- Las tarjetas NO muestran preview del análisis (Sprint 18.3)
- Solo muestran: título, fuente, imagen, fecha, indicador de "tiene análisis"
- El usuario debe entrar al detalle para ver/solicitar análisis

### 8.3. Chat Drawers

| Componente | Archivo | Funcionalidad |
|------------|---------|---------------|
| `NewsChatDrawer` | `frontend/components/news-chat-drawer.tsx` | Chat RAG sobre artículo específico |
| `GeneralChatDrawer` | `frontend/components/general-chat-drawer.tsx` | Chat general con conocimiento completo |

Ambos incluyen:
- Verificación de acceso Premium (`useCanAccessChat()`)
- CTA de upgrade si trial expirado (icono Crown)
- Envío de token de auth en cada petición
- Manejo de error `CHAT_FEATURE_LOCKED`

### 8.4. API Frontend

**Archivo:** `frontend/lib/api.ts`

```typescript
class APIError extends Error {
  constructor(message: string, public errorCode?: string, public details?: any)
}

// Funciones principales
analyzeArticle(articleId: string, token: string): Promise<AnalysisResponse>
chatWithArticle(articleId: string, messages: Message[], token: string): Promise<ChatResponse>
chatGeneral(messages: Message[], token: string): Promise<ChatResponse>
fetchNews(limit?, offset?, token?): Promise<NewsResponse>
fetchNewsByCategory(category, limit?, offset?, token?): Promise<NewsResponse>
fetchFavorites(limit?, offset?, token?): Promise<NewsResponse>
```

### 8.5. Round Robin de Fuentes

El repositorio Prisma (`findAll()`) implementa interleaving de fuentes para evitar "clumping":
1. Fetch 3x buffer de artículos
2. Agrupa por fuente
3. Aplica round robin: El País → Xataka → El Mundo → ...
4. Resultado: diversidad visual en la portada

---

## 9. Observabilidad y Costes

### 9.1. Token Taximeter

**Archivo:** `backend/src/infrastructure/monitoring/token-taximeter.ts`

Registra consumo de tokens por operación:
- `logAnalysis()` - Tokens de análisis de artículo
- `logRagChat()` - Tokens de chat RAG
- `logGroundingChat()` - Tokens de chat con Google Search
- `getReport()` - Reporte acumulado de la sesión

### 9.2. Sentry (Sprint 15)

**Custom Spans** con atributos de IA:
- `gemini.analyze_article` → `ai.tokens.prompt`, `ai.tokens.completion`, `ai.cost_eur`
- `gemini.generate_embedding` → `ai.embedding.dimensions`
- `gemini.rag_chat` → `rag.context_length`
- `gemini.general_chat` → `ai.grounding.enabled`

### 9.3. Optimizaciones de Coste

| Estrategia | Ahorro Estimado | Detalle |
|------------|-----------------|---------|
| Caché global de análisis | ~99% en artículos populares | Si `isAnalyzed`, no llama Gemini |
| Ventana deslizante de chat | ~70% en conversaciones largas | Solo últimos N mensajes |
| Prompt compactado (v4) | ~67% vs v1 | Prompts optimizados para menos tokens |
| Truncado de contenido | Variable | `MAX_ARTICLE_CONTENT_LENGTH = 8000` chars |
| Truncado de embeddings | Variable | `MAX_EMBEDDING_TEXT_LENGTH = 6000` chars |
| TTL de ingestión local | N/A | `15 min` entre re-ingestiones |
| Batch limits | Evita costes inesperados | `MAX_BATCH_LIMIT = 100` |

### 9.4. Resiliencia

| Mecanismo | Detalle |
|-----------|---------|
| Retry con backoff exponencial | 3 reintentos, delay × 2^attempt |
| Solo errores retriables | 429 (Rate Limit) y 5xx, NO 401/404/400 |
| Timeout en ingestión local | `6s` normal, `15s` con force-refresh |
| Fallback de scraping | Título + descripción si Jina falla |
| Non-blocking auto-favorite | Fallo de favorite no rompe el análisis |
| Non-blocking embedding | Fallo de embedding no rompe el análisis |

---

## 10. Hallazgos y Mejoras Recomendadas

### 10.1. Hallazgos Críticos

| ID | Severidad | Componente | Hallazgo |
|----|-----------|------------|----------|
| H-01 | **ALTA** | Prompt v4 | El prompt de análisis pide `biasScore` como entero -10 a +10, pero el `reliabilityScore` en los comentarios del prompt menciona reglas estrictas para >80 que requieren "citas directas a organismos oficiales". Gemini puede ser inconsistente con estas reglas sin few-shot examples. |
| H-02 | **ALTA** | Sanitización | `sanitizeInput()` reemplaza `{` → `(` y `}` → `)`, lo cual modifica el contenido del artículo antes del análisis. Esto podría alterar el significado de datos JSON, código, o citas textuales dentro de noticias de tecnología. |
| H-03 | **MEDIA** | Schema | El campo `Article.isFavorite` (boolean global) está marcado como deprecated pero sigue en el schema y se usa en `reconstitute()`. Debería eliminarse para evitar confusión con el sistema per-user. |
| H-04 | **MEDIA** | Embedding | Los embeddings solo se generan al analizar. Un artículo ingestado pero no analizado NO tiene embedding → no aparece en búsqueda semántica ni en contexto RAG. |
| H-05 | **MEDIA** | Chat | El Chat de Artículo usa `querySimilarWithDocuments()` que busca artículos SIMILARES, no necesariamente el artículo en cuestión. Si el artículo original no tiene embedding, el RAG puede devolver contexto de artículos diferentes. |
| H-06 | **BAJA** | Auth | `api-interceptor.ts` tiene `fetchWithAuth()` con `signOut()` en 401, pero no se usa en código de producción. Es código muerto que puede causar confusión. |
| H-07 | **BAJA** | Logs | Exceso de `console.log` en producción (emoji-heavy). Debería usar el logger Pino configurado para filtrar por nivel. |

### 10.2. Mejoras Recomendadas

#### P0 - Críticas

1. **Few-shot examples en prompt de análisis**: Añadir 2-3 ejemplos de artículos con sus scores esperados para calibrar el modelo. Actualmente el `reliabilityScore` depende de la interpretación libre de Gemini sobre las reglas textuales.

2. **Revisión de sanitización**: Reemplazar la sanitización agresiva de `{` y `}` por una estrategia que proteja contra prompt injection sin modificar el contenido periodístico. Opciones: delimitadores XML, encoding, o sandbox de contenido.

3. **Embedding en ingestión**: Generar embedding básico (solo título + descripción) durante la ingestión, no solo durante el análisis. Esto permitiría búsqueda semántica sobre artículos no analizados.

#### P1 - Importantes

4. **Contexto RAG específico**: En el Chat de Artículo, asegurar que el artículo consultado SIEMPRE esté en el contexto RAG, independientemente de la búsqueda por similitud. Actualmente, si el artículo no tiene embedding, el RAG falla silenciosamente con contexto de otros artículos.

5. **Eliminar campo deprecated `isFavorite`**: Migración Prisma para eliminar `Article.isFavorite` y limpiar código que lo usa. El sistema real de favoritos es la tabla junction `Favorite`.

6. **Persistencia de conversaciones de chat**: Los modelos `Chat` y `Message` existen en el schema pero no se usan en los use cases. Las conversaciones se manejan solo en el frontend (estado local). Implementar persistencia permitiría historial entre sesiones.

7. **Validación de output de Gemini**: El `parseAnalysisResponse()` tiene fallbacks amplios (campos opcionales con defaults). Añadir validación estricta con Zod schema para detectar degradación de calidad en las respuestas de Gemini.

#### P2 - Mejoras

8. **Cleanup automático de artículos**: El `CleanupNewsJob` existe pero su política de retención debería documentarse y configurarse con variables de entorno.

9. **Métricas de calidad de análisis**: Dashboard interno que muestre distribución de `reliabilityScore`, `biasScore`, y ratio de fallbacks por scraping fallido.

10. **Rate limiting por usuario**: El rate limit actual es por IP (300 req/15min). Añadir rate limiting por usuario para las operaciones costosas (análisis, chat).

11. **Tests de integración para prompts**: Script de verificación automática (tipo `verify-analysis-rules.ts`) que ejecute análisis sobre corpus de prueba y valide que los scores se ajusten a las reglas definidas.

12. **Caching de embeddings de queries**: Para búsquedas frecuentes, cachear el embedding generado para evitar llamadas repetidas a `text-embedding-004`.

---

## Anexo A: Mapa de Archivos Clave

```
backend/
├── prisma/schema.prisma                              # Modelo de datos
├── src/
│   ├── domain/
│   │   ├── entities/news-article.entity.ts            # Entidad inmutable
│   │   ├── errors/domain.error.ts                     # FeatureLockedError, ValidationError
│   │   ├── repositories/news-article.repository.ts    # Interface INewsArticleRepository
│   │   └── services/
│   │       ├── gemini-client.interface.ts              # Interface IGeminiClient
│   │       ├── vector-client.interface.ts              # Interface IVectorClient
│   │       └── quota.service.ts                        # QuotaService (Premium gate)
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── ingest-news.usecase.ts                 # Pipeline de ingestión
│   │   │   ├── analyze-article.usecase.ts             # Pipeline de análisis IA
│   │   │   ├── chat-article.usecase.ts                # Chat RAG (artículo)
│   │   │   ├── chat-general.usecase.ts                # Chat general (knowledge-first)
│   │   │   └── search-news.usecase.ts                 # Búsqueda semántica
│   │   └── services/
│   │       └── local-source-discovery.service.ts       # Descubrimiento IA de fuentes
│   └── infrastructure/
│       ├── config/dependencies.ts                      # DI Container (Singleton)
│       ├── external/
│       │   ├── gemini.client.ts                        # Cliente Gemini (análisis, chat, embeddings)
│       │   ├── pgvector.client.ts                      # Cliente pgvector (búsqueda semántica)
│       │   ├── jina-reader.client.ts                   # Scraping de artículos
│       │   ├── metadata-extractor.ts                   # Extracción de og:image
│       │   ├── direct-spanish-rss.client.ts            # RSS directo (primario)
│       │   ├── google-news-rss.client.ts               # Google News RSS (fallback)
│       │   └── prompts/
│       │       ├── analysis.prompt.ts                  # Prompt de análisis v4
│       │       ├── rag-chat.prompt.ts                  # Prompt RAG v5 (zero hallucination)
│       │       └── general-chat.prompt.ts              # Prompt general v2 (knowledge-first)
│       ├── http/
│       │   ├── controllers/
│       │   │   ├── news.controller.ts                  # CRUD noticias + auto-fill + search
│       │   │   ├── analyze.controller.ts               # Análisis IA
│       │   │   ├── chat.controller.ts                  # Chat (Premium gate)
│       │   │   └── search.controller.ts                # Búsqueda semántica
│       │   └── middleware/
│       │       └── auth.middleware.ts                   # Firebase JWT + Plan check
│       ├── monitoring/
│       │   ├── token-taximeter.ts                      # Tracking de consumo de tokens
│       │   └── sentry.ts                               # Sentry SDK
│       └── persistence/
│           └── prisma-news-article.repository.ts       # Implementación del repositorio

frontend/
├── app/
│   ├── page.tsx                                        # Home (Infinite Scroll + topics)
│   ├── news/[id]/page.tsx                              # Detalle de artículo + análisis
│   ├── login/page.tsx                                  # Auth (Firebase)
│   └── profile/page.tsx                                # Perfil + ubicación
├── components/
│   ├── news-chat-drawer.tsx                            # Chat artículo (Premium gate)
│   ├── general-chat-drawer.tsx                         # Chat general (Premium gate)
│   └── news/
│       ├── news-grid.tsx                               # Grid de tarjetas
│       └── news-card.tsx                               # Tarjeta individual
├── context/AuthContext.tsx                              # Auth state (Firebase + persistence)
├── hooks/
│   ├── useCanAccessChat.ts                             # Premium gate hook
│   ├── useNewsInfinite.ts                              # Infinite scroll
│   └── useProfile.ts                                   # Perfil con React Query
└── lib/
    ├── api.ts                                          # Capa API (fetch + tipos)
    ├── firebase.ts                                     # Firebase init + authReady
    └── profile.api.ts                                  # API de perfil
```

---

## Anexo B: Modelos de IA Utilizados

| Modelo | Proveedor | Uso | Coste aprox. |
|--------|-----------|-----|--------------|
| `gemini-2.5-flash` | Google AI | Análisis de artículos, Chat RAG, Chat General, RSS Discovery | ~$0.075/1M input, ~$0.30/1M output |
| `text-embedding-004` | Google AI | Embeddings 768-dim para búsqueda semántica | ~$0.004/1M tokens |
| Google Search Grounding | Google AI | Datos en tiempo real para Chat General | Incluido con Gemini |

---

*Informe generado como parte de la auditoría de Verity News - Sprint 30*
