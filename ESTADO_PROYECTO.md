# Estado del Proyecto - Verity News

> Última actualización: Sprint 8.1 - Suite de Tests de Carga k6 (2026-02-02) - **PRODUCCIÓN READY ✅**

---

## Estado Actual: SPRINT 8 COMPLETADO - OPTIMIZACIÓN DE COSTES IA ✅

| Componente | Estado | Notas |
|------------|--------|-------|
| **Arquitectura** | ✅ 8/10 | Clean Architecture validada y robusta |
| **Seguridad** | ✅ 8/10 | XSS, CORS, Rate Limiting corregidos |
| **Tipos/TypeScript** | ✅ 8/10 | Sin `as any`, interfaces tipadas |
| **Manejo de errores** | ✅ 8/10 | Retry con backoff, health checks |
| **Código limpio** | ✅ 8/10 | Documentado y auditado |
| **Optimización IA** | ✅ 9/10 | Prompts compactados, límites defensivos, caché documentado |

---

## Resumen de Sprints Completados

| Sprint | Nombre | Estado | Fecha |
|--------|--------|--------|-------|
| 1 | Cimientos y Arquitectura | ✅ | 2026-01-28 |
| 2 | El Cerebro de la IA (Gemini) | ✅ | 2026-01-29 |
| 3 | La Capa de Experiencia (UI) | ✅ | 2026-01-29 |
| 4 | La Memoria Vectorial (ChromaDB) | ✅ | 2026-01-30 |
| 5 | Búsqueda Semántica (UI) | ✅ | 2026-01-30 |
| 5.2 | Categorías RSS (8 categorías) | ✅ | 2026-01-30 |
| 6 | Página de Detalle + Análisis IA | ✅ | 2026-01-30 |
| 6.3 | Sistema de Favoritos | ✅ | 2026-01-30 |
| 7.1 | Chat RAG + Seguridad + Auditoría | ✅ | 2026-01-31 |
| 7.2 | UX + Chat Híbrido + Auto-Favoritos | ✅ | 2026-01-31 |
| 8 | Optimización de Costes Gemini | ✅ | 2026-02-02 |
| **8.1** | **Suite de Tests de Carga (k6)** | ✅ | **2026-02-02** |

---

## Sprint 7.1: Implementación Completa

### 1. Chat RAG (Retrieval-Augmented Generation)

**Backend:**
- `generateChatResponse()` en GeminiClient para respuestas RAG puras
- `querySimilarWithDocuments()` en ChromaClient para recuperar documentos
- Pipeline RAG completo en ChatArticleUseCase:
  ```
  Question → Embedding → ChromaDB Query → Context Assembly → Gemini Response
  ```
- Fallback a contenido del artículo si ChromaDB no disponible

**Archivos modificados:**
- `backend/src/infrastructure/external/gemini.client.ts`
- `backend/src/infrastructure/external/chroma.client.ts`
- `backend/src/application/use-cases/chat-article.usecase.ts`
- `backend/src/domain/services/gemini-client.interface.ts`
- `backend/src/domain/services/chroma-client.interface.ts`

### 2. Detector de Bulos (Nuevo Prompt de Análisis)

**Nuevos campos en ArticleAnalysis:**
```typescript
interface ArticleAnalysis {
  summary: string;
  biasScore: number;      // 0-1 normalizado para UI
  biasRaw: number;        // -10 a +10 (izquierda a derecha)
  biasIndicators: string[];
  clickbaitScore: number; // 0-100
  reliabilityScore: number; // 0-100 (detector de bulos)
  sentiment: 'positive' | 'negative' | 'neutral';
  mainTopics: string[];
  factCheck: {
    claims: string[];
    verdict: 'Verified' | 'Mixed' | 'Unproven' | 'False';
    reasoning: string;
  };
}
```

**Frontend:**
- Nuevo componente `ReliabilityBadge` en página de detalle
- Integrado en panel de análisis IA

### 3. Correcciones de Seguridad (Auditoría Completa)

| Problema | Solución | Archivo |
|----------|----------|---------|
| **XSS** | DOMPurify sanitiza HTML | `frontend/app/news/[id]/page.tsx` |
| **Rate Limit** | 100 req/15min por IP | `backend/src/infrastructure/http/server.ts` |
| **CORS** | Métodos explícitos | `backend/src/infrastructure/http/server.ts` |
| **`as any`** | Interfaz `ChromaMetadata` | `backend/src/infrastructure/external/chroma.client.ts` |
| **Retry 429** | Exponential backoff (3 intentos) | `backend/src/infrastructure/external/gemini.client.ts` |
| **Health Check** | Estado de DB, ChromaDB, Gemini | `backend/src/infrastructure/http/server.ts` |

### 4. Endpoint `/health` Mejorado

```json
{
  "status": "ok",
  "service": "Verity News API",
  "services": {
    "api": "healthy",
    "database": "healthy",
    "chromadb": "healthy",
    "gemini": "healthy"
  },
  "timestamp": "2026-01-31T12:00:00.000Z"
}
```

---

## Sprint 7.2: UX + Chat Híbrido + Auto-Favoritos

### 1. Correcciones de UX

| Problema | Solución | Archivo |
|----------|----------|---------|
| **NewsChatDrawer desaparecido** | Restaurado el componente flotante de chat | `frontend/app/news/[id]/page.tsx` |
| **Análisis no persiste al recargar** | JSON parsing en controller (string → object) | `backend/src/infrastructure/http/controllers/news.controller.ts` |
| **Auto-favoritos** | Al analizar, el artículo se marca como favorito automáticamente | `backend/src/application/use-cases/analyze-article.usecase.ts` |

### 2. Chat Híbrido (Contexto + Conocimiento General)

**Nuevo comportamiento en `generateChatResponse()`:**
```
1. Si la respuesta está en el CONTEXTO → úsalo directamente
2. Si NO está en el contexto → usa conocimiento general con aviso:
   - "El artículo no lo menciona, pero..."
   - "En un contexto más amplio..."
   - "Según información general..."
```

**Formato Markdown obligatorio:**
- Listas con viñetas (bullets) para datos clave
- Negritas para nombres, fechas y cifras
- Párrafos máximos de 2-3 líneas
- Lectura escaneable y ligera

### 3. Resúmenes Estructurados

**Mejora en prompt de análisis:**
- Frases cortas (máximo 15 palabras por frase)
- Máximo 60 palabras total
- Directo al grano: ¿Qué? ¿Quién? ¿Cuándo?
- Sin jerga técnica innecesaria

### 4. Archivos Modificados Sprint 7.2

| Archivo | Cambio |
|---------|--------|
| `backend/src/infrastructure/http/controllers/news.controller.ts` | `toHttpResponse()` con JSON.parse para analysis |
| `backend/src/application/use-cases/analyze-article.usecase.ts` | Auto-favorite al analizar |
| `backend/src/infrastructure/external/gemini.client.ts` | Prompt mejorado + Chat híbrido |
| `frontend/app/news/[id]/page.tsx` | NewsChatDrawer restaurado |

---

## Sprint 8: Optimización de Costes Gemini API

### Objetivo
Reducir el coste de uso de Google Gemini API ~64% sin afectar la funcionalidad visible para el usuario.

### 1. Ventana Deslizante de Historial (CRÍTICO)

**Problema:** Cada mensaje de chat reenviaba TODO el historial anterior, causando crecimiento exponencial de tokens.

**Solución:** Limitar a los últimos 6 mensajes (3 turnos usuario-IA).

```typescript
// gemini.client.ts
const MAX_CHAT_HISTORY_MESSAGES = 6;
const recentMessages = messages.slice(-MAX_CHAT_HISTORY_MESSAGES);
```

**Ahorro estimado:** ~70% en conversaciones largas (20+ mensajes)

### 2. Prompts Optimizados

**ANALYSIS_PROMPT** (antes ~700 tokens → ahora ~250 tokens):
- Eliminado rol verboso ("Actúa como un analista experto...")
- Eliminado campo IDIOMA (se infiere del contenido)
- Escalas compactadas en una línea
- Límites explícitos de output (max 50 palabras, max 3 items)

**RAG_PROMPT** (antes ~370 tokens → ahora ~120 tokens):
- Eliminado markdown decorativo en instrucciones
- Reducidos ejemplos de fallback (3 → 1)
- Añadido límite de output (max 150 palabras)

**Ahorro estimado:** ~65-70% en tokens de instrucciones

### 3. Contexto RAG Compactado

| Constante | Valor | Propósito |
|-----------|-------|-----------|
| `MAX_RAG_DOCUMENTS` | 3 | Límite de documentos de ChromaDB |
| `MAX_DOCUMENT_CHARS` | 2000 | Truncado de fragmentos largos |
| `MAX_FALLBACK_CONTENT_CHARS` | 3000 | Límite de contenido fallback |

**Formato compacto:**
```
Antes: "=== INFORMACIÓN DEL ARTÍCULO ===" + múltiples líneas
Ahora: "[META] Título | Fuente | 2026-01-15"
```

### 4. Caché de Análisis Documentado

El sistema ya tenía caché de análisis en PostgreSQL. Se añadió documentación explícita:

```typescript
// analyze-article.usecase.ts
// =========================================================================
// COST OPTIMIZATION: CACHÉ DE ANÁLISIS EN BASE DE DATOS
// Si el artículo ya fue analizado (analyzedAt !== null), devolvemos el
// análisis cacheado en PostgreSQL SIN llamar a Gemini.
// =========================================================================
if (article.isAnalyzed) {
  console.log(`⏭️ CACHE HIT: Análisis ya existe en BD. Gemini NO llamado.`);
  return existingAnalysis;
}
```

### 5. Límites Defensivos

| Constante | Valor | Ubicación |
|-----------|-------|-----------|
| `MAX_CHAT_HISTORY_MESSAGES` | 6 | gemini.client.ts |
| `MAX_ARTICLE_CONTENT_LENGTH` | 8000 | gemini.client.ts |
| `MAX_EMBEDDING_TEXT_LENGTH` | 6000 | gemini.client.ts |
| `MAX_BATCH_LIMIT` | 100 | analyze-article.usecase.ts |
| `MIN_CONTENT_LENGTH` | 100 | analyze-article.usecase.ts |

### 6. Impacto en Costes

| Métrica | Antes | Después | Ahorro |
|---------|-------|---------|--------|
| Tokens análisis (prompt) | ~700 | ~250 | **-64%** |
| Tokens RAG (prompt) | ~370 | ~120 | **-68%** |
| Tokens chat (20 msgs) | ~6,700 | ~2,000 | **-70%** |
| Coste/usuario/mes | ~$0.025 | ~$0.009 | **-64%** |

### 7. Archivos Modificados Sprint 8

| Archivo | Cambio |
|---------|--------|
| `backend/src/infrastructure/external/gemini.client.ts` | Prompts optimizados + ventana deslizante |
| `backend/src/application/use-cases/chat-article.usecase.ts` | Contexto RAG compactado |
| `backend/src/application/use-cases/analyze-article.usecase.ts` | Documentación caché + constantes |
| `backend/src/infrastructure/http/schemas/chat.schema.ts` | Documentación límites |
| `backend/src/infrastructure/http/schemas/analyze.schema.ts` | Documentación límites |

---

## Sprint 8.1: Suite de Tests de Carga (k6)

### Objetivo
Implementar pruebas de rendimiento y validación del rate limiting usando k6.

### Estructura Creada

```
tests/
└── performance/
    └── stress-test.js
```

### Configuración del Test

| Fase | VUs | Duración | Objetivo |
|------|-----|----------|----------|
| **Calentamiento** | 10 | 10s | Establecer baseline de rendimiento |
| **Ataque Rate Limit** | 50 | 30s | Validar límite de 100 req/15min |

### Métricas Personalizadas

| Métrica | Tipo | Descripción |
|---------|------|-------------|
| `rate_limit_hits_429` | Counter | Respuestas 429 detectadas |
| `successful_requests_200` | Counter | Peticiones exitosas |
| `rate_limit_detection_rate` | Rate | Tasa de detección del rate limiter |
| `success_response_time` | Trend | Tiempo de respuesta para 200s |

### Thresholds

- **p(95) < 500ms** - 95% de peticiones normales responden rápido
- **Errores reales < 5%** - Excluyendo 429 (esperados)
- **429 detectados > 0** - Valida que el rate limiter funciona

### Ejecución

```bash
# Básico
k6 run tests/performance/stress-test.js

# Con URL personalizada
k6 run -e BASE_URL=http://localhost:3000 tests/performance/stress-test.js

# Con dashboard web
k6 run --out web-dashboard tests/performance/stress-test.js
```

### Archivos Añadidos Sprint 8.1

| Archivo | Descripción |
|---------|-------------|
| `tests/performance/stress-test.js` | Suite completa de stress test con k6 |

---

## Stack Tecnológico Final

| Capa | Tecnología | Versión |
|------|------------|---------|
| **Frontend** | Next.js + React + Tailwind CSS | 16.1.6 / 19 / v4 |
| **Backend** | Node.js + Express + Clean Architecture | 22 / 4.x |
| **Base de Datos** | PostgreSQL + Prisma | 16 / 7 |
| **Vector Store** | ChromaDB | 0.5.x |
| **IA - Análisis** | Gemini 2.5 Flash | Pay-As-You-Go |
| **IA - Embeddings** | Gemini text-embedding-004 | 768 dimensiones |
| **IA - Chat RAG** | Gemini 2.5 Flash | Sin Google Search |
| **IA - Chat Grounding** | Gemini 2.5 Flash + Google Search | Con fuentes web |
| **Scraping** | Jina Reader API | v1 |
| **Ingesta** | Direct Spanish RSS | 9 medios, 8 categorías |
| **Sanitización** | DOMPurify | 3.x |
| **Rate Limiting** | express-rate-limit | 7.x |
| **Load Testing** | k6 | latest |

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────┐
│                      VERITY NEWS - ARQUITECTURA                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                     FRONTEND (Next.js 16)                        │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │ │
│  │  │ Dashboard│  │ Search   │  │ Detail   │  │ Chat (RAG)       │ │ │
│  │  │ + Stats  │  │ Semantic │  │ + Análisis│  │ + Grounding     │ │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │ │
│  │         │            │            │               │              │ │
│  │         └────────────┴────────────┴───────────────┘              │ │
│  │                              ▼                                    │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │   DOMPurify (XSS Protection) + Rate Limit (Client Side)     │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                  │                                    │
│                                  ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                  BACKEND (Express + Clean Architecture)          │ │
│  │                                                                   │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │  PRESENTATION: Controllers + Routes + Zod Validation        │ │ │
│  │  │  Security: CORS restrictivo + Rate Limit (100/15min)        │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  │                              ▼                                    │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │  APPLICATION: Use Cases                                      │ │ │
│  │  │  • IngestNewsUseCase    • AnalyzeArticleUseCase             │ │ │
│  │  │  • ChatArticleUseCase   • SearchNewsUseCase                 │ │ │
│  │  │  • ToggleFavoriteUseCase                                    │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  │                              ▼                                    │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │  DOMAIN: Entities + Interfaces + Errors                      │ │ │
│  │  │  • NewsArticle (ArticleAnalysis, FactCheck)                 │ │ │
│  │  │  • IGeminiClient, IChromaClient, INewsRepository            │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  │                              ▼                                    │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │  INFRASTRUCTURE: External Services                           │ │ │
│  │  │  • GeminiClient (retry 3x backoff)  • ChromaClient          │ │ │
│  │  │  • JinaReaderClient                 • MetadataExtractor     │ │ │
│  │  │  • DirectSpanishRssClient           • PrismaRepository      │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                  │                                    │
│            ┌─────────────────────┼─────────────────────┐             │
│            ▼                     ▼                     ▼             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │   PostgreSQL     │  │    ChromaDB      │  │   Gemini API     │   │
│  │   (Prisma 7)     │  │  (Vector Store)  │  │  (2.5 Flash)     │   │
│  │   Source of      │  │   Embeddings     │  │  Analysis +      │   │
│  │   Truth          │  │   768 dims       │  │  Chat + RAG      │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Ingesta
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/ingest/news` | Ingestar noticias por categoría |
| GET | `/api/ingest/status` | Estado de última ingesta |

### Noticias
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/news` | Listar noticias (paginado) |
| GET | `/api/news/:id` | Obtener noticia por ID |
| PATCH | `/api/news/:id/favorite` | Toggle favorito |

### Análisis IA
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/analyze/article` | Analizar artículo individual |
| POST | `/api/analyze/batch` | Analizar batch (1-100) |
| GET | `/api/analyze/stats` | Estadísticas de análisis |

### Chat
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/chat/article` | Chat RAG sobre artículo |

### Búsqueda
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/search?q=...` | Búsqueda semántica |

### Sistema
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/health` | Estado de todos los servicios |

---

## Categorías RSS Configuradas

| Categoría | Medios | Keywords de resolución |
|-----------|--------|------------------------|
| `general` | El País, El Mundo, 20 Minutos | default |
| `internacional` | El País, El Mundo | mundial, europa, eeuu |
| `deportes` | AS, Marca, Mundo Deportivo | fútbol, liga, champions |
| `economia` | 20 Minutos, El País, El Economista | inflación, ibex, banco |
| `politica` | Europa Press, El País | gobierno, congreso, elecciones |
| `ciencia` | El País, 20 Minutos | cambio climático, nasa, investigación |
| `tecnologia` | 20 Minutos, El Mundo, Xataka | ia, apple, google, startup |
| `cultura` | El País, 20 Minutos | cine, música, arte, netflix |

---

## Documentación Generada

| Archivo | Descripción |
|---------|-------------|
| `docs/AUDIT.md` | Auditoría completa de seguridad y calidad |
| `docs/MemoriaTFM.md` | Memoria del TFM |
| `docs/MEMORIA_TECNICA_SPRINT_2.md` | Documentación Sprint 2 |
| `docs/SPRINT_3_CHANGES.md` | Cambios Sprint 3 |
| `docs/VALIDACION_DASHBOARD_CHAT.md` | Validación Dashboard + Chat |
| `docs/REFACTORIZACION_GOOGLE_NEWS_RSS.md` | Migración a Google News RSS |
| `docs/TEST_END_TO_END_GOOGLE_NEWS_RSS.md` | Tests E2E del motor RSS |
| `docs/MEJORA_UI_IMAGENES.md` | Mejoras UI imágenes |
| `docs/METADATA_EXTRACTOR_IMPLEMENTATION.md` | Implementación MetadataExtractor |
| `docs/INSTRUCCIONES_REANALISIS_MANUAL.md` | Instrucciones de reanálisis |
| `docs/SPRINT_3_RSS_DIRECTOS.md` | RSS directos Sprint 3 |
| `docs/VALIDACION_RSS_DIRECTOS_FINAL.md` | Validación final RSS |

---

## Commits de Sprint 7.1 y 7.2

```
58ba39a feat: Sprint 7.2 - UX + Chat Híbrido + Auto-Favoritos
864d8c7 fix(quality): Completar correcciones de auditoría Sprint 7.1
e67b0b9 fix(security): Corregir vulnerabilidades críticas
ef50b05 feat: Sprint 7.1 - Chat RAG + Detector de Bulos + Auditoría
```

---

## Capacidades del Sistema

1. ✅ **Ingesta Multi-fuente**: 8 categorías, 9 medios españoles via RSS
2. ✅ **Análisis de Sesgo IA**: Puntuación -10/+10 con normalización 0-1
3. ✅ **Detector de Bulos**: reliabilityScore 0-100 + factCheck con verdict
4. ✅ **Clickbait Score**: Detección de titulares sensacionalistas 0-100
5. ✅ **Búsqueda Semántica**: Por significado con embeddings 768d
6. ✅ **Chat RAG Híbrido**: Contexto prioritario + conocimiento general con aviso
7. ✅ **Chat Grounding**: Respuestas con Google Search para info externa
8. ✅ **Dashboard Analítico**: KPIs y distribución de sesgo
9. ✅ **Sistema de Favoritos**: Toggle + filtro + auto-favorito al analizar
10. ✅ **Seguridad**: XSS, CORS, Rate Limiting, Retry, Health Checks
11. ✅ **UX Optimizada**: Resúmenes estructurados, chat con formato Markdown
12. ✅ **Optimización de Costes IA**: Prompts compactados (-64%), ventana deslizante, límites defensivos
13. ✅ **Testing de Carga**: Suite k6 con validación de rate limiting y thresholds de rendimiento

---

## Métricas de Desarrollo

| Métrica | Valor |
|---------|-------|
| **Sprints completados** | 11 |
| **Archivos TypeScript** | ~80 |
| **Líneas de código** | ~12,500 |
| **Tests unitarios** | 41 |
| **Endpoints API** | 11 |
| **Componentes React** | ~25 |
| **TypeScript Errors** | 0 |
| **Vulnerabilidades** | 0 críticas |
| **Reducción coste IA** | -64% |

---

## Próximos Pasos (Post-MVP)

### Auditoría Final
- [x] Testing de carga (k6) - Suite implementada en `tests/performance/`
- [ ] Performance audit (Lighthouse, Web Vitals)
- [ ] Penetration testing

### Memoria TFM
- [ ] Redacción de capítulo de IA Assisted Engineering
- [ ] Conclusiones y limitaciones
- [ ] Recomendaciones futuras

### Mejoras Futuras
- [ ] Autenticación de usuarios (Firebase Auth)
- [ ] Historial de búsquedas semánticas
- [ ] Alertas personalizadas por tema
- [ ] Exportación de reportes de sesgo
- [ ] Compartir análisis en redes sociales

---

## Conclusión

**Verity News Sprint 8** representa un sistema RAG Full Stack completo y optimizado:

- **Cerebro IA** (Gemini 2.5 Flash) - Análisis + Chat Híbrido + RAG
- **Memoria Vectorial** (ChromaDB) - Búsqueda semántica
- **Detector de Bulos** - reliabilityScore + factCheck
- **Seguridad Producción** - XSS, CORS, Rate Limit, Health Checks
- **UX Optimizada** - Resúmenes estructurados, formato Markdown, auto-favoritos
- **Costes Optimizados** - 64% reducción en tokens de Gemini API

**Status:** MVP completo, auditado, optimizado y listo para producción.

**Repositorio:** https://github.com/David-LS-Bilbao/PROYECTO-MASTER-IA
