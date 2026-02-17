# Estado del Proyecto - Verity News

> **Última actualización**: 2026-02-17 - Endurecimiento de análisis (paywall + Jina + JSON repair)
> **Stack**: Next.js + Express + PostgreSQL + Prisma + Gemini AI + pgvector
> **Arquitectura**: Clean Architecture (Hexagonal) + DDD

---

## Actualización Pre-Merge (2026-02-17)

### Estado de features recientes

- ✅ Extracción de texto robusta con Jina (soporte payload anidado `data.content`).
- ✅ Pipeline de limpieza previo al LLM (ruido JSON/HTML/flags internas/IDs).
- ✅ Detección de paywall y bloqueo duro de análisis (`PAYWALL_BLOCKED`).
- ✅ Gate de paywall aplicado también cuando existe cache legacy.
- ✅ Resiliencia Gemini: parseo JSON estricto + 1 intento de JSON repair.
- ✅ UI: estado de error de formato sin contaminar secciones deep.
- ✅ Entitlements deep-analysis + promo codes en endpoints dedicados.

### Tareas reales abiertas (post-merge)

- [ ] Backfill/auditoría de artículos legacy para recalcular `accessStatus` y `analysisBlocked` donde falte. (Suposición razonable)
- [ ] Reducir deuda de nombres legacy en comentarios/tests (referencias antiguas a Chroma). (Suposición razonable)
- [ ] Consolidar documentación histórica para evitar contradicciones entre sprints antiguos y estado actual. (Suposición razonable)

---

## 📊 Estado General del Proyecto

| Área | Tecnología | Estado | Notas |
|------|------------|--------|-------|
| **Frontend** | Next.js 15 + React 19 + Tailwind | ✅ Producción | App Router, React Query, shadcn/ui |
| **Backend** | Express + TypeScript + Prisma | ✅ Producción | Clean Architecture, DI Container |
| **Base de Datos** | PostgreSQL 17 + Prisma ORM | ✅ Producción | Full-Text Search, Migrations |
| **Autenticación** | Firebase Auth + JWT | ✅ Producción | Middleware authenticate/optionalAuth |
| **AI/LLM** | Google Gemini 2.0 Flash | ✅ Producción | Análisis de sesgo, XAI |
| **RAG/Vector DB** | pgvector + Gemini Embeddings | ✅ Producción | Búsqueda semántica |
| **RSS Ingestion** | RSS Parser + Directos | ✅ Producción | 8 fuentes españolas |
| **Observabilidad** | Sentry + Pino Logger | ✅ Producción | Distributed tracing |
| **Testing** | Vitest + Playwright | ✅ QA | Backend blindado, E2E |
| **Accesibilidad** | WCAG 2.1 AA + UNE-EN 301549 | ✅ Parcial | Sprint 19.8 |
| **Geolocalización** | User.location + GPS + Nominatim | ✅ Producción | Sprint 28 (auto-detect + local fix) |

---

## 🗂️ Índice de Sprints

### Producción (✅ Completados)
- [Sprint 28](#sprint-28) - Geolocalización Automática + Local News Fix (2026-02-12)
- [Sprint 27.3](#sprint-273) - Hotfix Producción + Responsive Móvil (2026-02-11)
- [Sprint 27.2](#sprint-272) - Fix Entretenimiento y Calidad de Ingesta (2026-02-10)
- [Sprint 27.1](#sprint-271) - Security Remediation e Ingest Hardening (2026-02-10)
- [Sprint 27](#sprint-27) - Modelo Freemium y Suscripciones (2026-02-10)
- [Sprint 25](#sprint-25) - AI Prompt Improvements (2026-02-09)
- [Sprint 24](#sprint-24) - AI-Powered Local Source Discovery (2026-02-09)
- [Sprint 23.2](#sprint-232) - Refactor ChromaClient (2026-02-09)
- [Sprint 22](#sprint-22) - UI Cleanup + Smart Search (2026-02-09)
- [Sprint 20](#sprint-20) - Geolocalización + Reestructuración Categorías (2026-02-09)
- [Sprint 19.8](#sprint-198) - Accesibilidad WCAG 2.1 AA (2026-02-09)
- [Sprint 19.6](#sprint-196) - Refinamiento Navegación (2026-02-08)
- [Sprint 19.5](#sprint-195) - Mantenimiento Datos (2026-02-08)
- [Sprint 19.3-19.4](#sprint-193-194) - Búsqueda Robusta + Infinite Scroll (2026-02-07)
- [Sprint 19](#sprint-19) - Waterfall Search Engine (2026-02-06)
- [Sprint 18.3](#sprint-183) - UX Enhancements (2026-01)
- [Sprint 18.2](#sprint-182) - Privacy Fix (2026-01)
- [Sprint 18](#sprint-18) - Multiusuario (2026-01)
- [Sprint 17](#sprint-17) - Cost Optimization (2026-01)
- [Sprint 16](#sprint-16) - Categorías Independientes (2025-12)
- [Sprint 15](#sprint-15) - Observabilidad (2025-12)
- [Sprint 14.5](#sprint-145) - Frontend Polish (2025-12)
- [Sprint 14](#sprint-14) - Seguridad + Refactor (2025-12)
- [Sprint 13](#sprint-13) - Resiliencia Enterprise (2025-11)
- [Sprint 12](#sprint-12) - Testing Frontend (2025-11)
- [Sprint 11](#sprint-11) - Testing Backend (2025-11)
- [Sprint 10](#sprint-10) - Usuarios y Perfiles (2025-11)
- [Sprint 9](#sprint-9) - RSS Auto-Discovery (2025-10)
- [Sprint 8](#sprint-8) - Optimización Costes (2025-10)
- [Sprint 7](#sprint-7) - Chat RAG (2025-10)
- [Sprints 1-6](#sprints-iniciales) - MVP Base (2025-09)

---

## 📋 Sprints Detallados

---

### Sprint 27.3
**Hotfix Producción + Responsive Móvil**
**Fecha**: 2026-02-11 | **Estado**: ✅ Completado

**Objetivo**: Estabilizar deploy en producción (Render/Vercel) y corregir UX en móvil.

**Implementado**:
- ✅ Docker `node:20-slim` + copia de Prisma Client en runner.
- ✅ `node-cron` en dependencias de producción.
- ✅ CORS con lista de dominios (multi-origen).
- ✅ Fallback a `Madrid` si falta `location` en categoría `local`.
- ✅ Sidebar móvil tipo drawer + header responsive con búsqueda full width.
- ✅ Botón de búsqueda con icono en móvil; footer compacto.

**Impacto**:
- 🔒 Despliegue estable sin errores de runtime en Render/Vercel.
- 📱 Experiencia móvil limpia y sin elementos aplastados.

**Docs**: [`docs/sprints/Sprint-27.3-Production-Responsive-Hotfixes.md`](docs/sprints/Sprint-27.3-Production-Responsive-Hotfixes.md)

---

### Sprint 27.2
**Fix Entretenimiento y Calidad de Ingesta**
**Fecha**: 2026-02-10 | **Estado**: ✅ Completado

**Objetivo**: Garantizar que la categoría entretenimiento devuelva contenido real (cine, series, música) y no caiga a "general".

**Implementado**:
- ✅ Alias y keywords de `entretenimiento` en `DirectSpanishRssClient` (mapeo a cultura).
- ✅ Query dedicada en `GoogleNewsRssClient` cuando la categoría es entretenimiento.
- ✅ Mapeo `entretenimiento` → `entertainment` en `NewsAPIClient`.
- ✅ Tests unitarios específicos para el mapeo de entretenimiento.

**Impacto**:
- 🎯 Contenido de entretenimiento consistente en todas las fuentes.
- 🧪 Menos falsos positivos de política/actualidad en esta categoría.

**Docs**: [`docs/sprints/Sprint-27.2-Fix-Entretenimiento.md`](docs/sprints/Sprint-27.2-Fix-Entretenimiento.md)

---
### Sprint 27.1
**Security Remediation e Ingest Hardening**
**Fecha**: 2026-02-10 | **Estado**: ✅ Completado

**Objetivo**: Endurecer endpoints de ingesta, validar queries y externalizar secretos.

**Implementado**:
- ✅ `trust proxy` en Express + CORS permite `x-cron-secret`.
- ✅ Middleware `x-cron-secret` en `/api/ingest/*`.
- ✅ Validación Zod en query params (`search` y `news`).
- ✅ `PROMO_CODES` externalizados en `.env`.
- ✅ `.env.example` con `CRON_SECRET` y `PROMO_CODES`.

**Impacto**:
- 🔐 Ingesta protegida y no expuesta públicamente.
- Validación de entrada consistente en endpoints críticos.

**Docs**: [`docs/sprints/Sprint-27.1-Security-Remediation.md`](docs/sprints/Sprint-27.1-Security-Remediation.md)

---
### Sprint 27
**Modelo Freemium y Gestion de Suscripciones (MVP)**
**Fecha**: 2026-02-10 | **Estado**: ✅ Completado

**Objetivo**: Establecer infraestructura para diferenciar usuarios FREE vs PREMIUM y habilitar upgrade mediante codigos promocionales (MVP).

**Implementado**:
- ✅ Prisma: reemplazo de `UserPlan` por `SubscriptionPlan` (FREE, PREMIUM) + migraciones `add_subscription_plan` y `fix_subscription_naming`.
- ✅ Backend: `SubscriptionController` con endpoints `/api/subscription/redeem` y `/api/subscription/cancel`, validacion Zod y rutas registradas.
- ✅ Sincronizacion de tipos `subscriptionPlan` en auth middleware, controllers, use cases y `QuotaService`.
- ✅ Frontend: `PricingModal` con comparativa de planes, canje de codigo y boton "Gestionar Plan" en perfil.
- ✅ Tests de perfil ajustados para el nuevo plan PREMIUM.

**Impacto**:
- 🔐 Upgrade a PREMIUM sin pasarela de pago (MVP con codigos).
- 🧩 Consistencia de plan en frontend y backend, lista para integraciones futuras.

**Docs**: [`Sprint-27-ENTREGABLES.md`](Sprint-27-ENTREGABLES.md)

---
### Sprint 25
**AI Prompt Improvements** 🧠
**Fecha**: 2026-02-09 | **Estado**: ✅ Completado

**Objetivo**: Reducir alucinaciones y endurecer la trazabilidad de respuestas IA tanto en análisis de artículos como en el chat RAG y el modo grounding.

**Implementado**:
- ✅ Prompt `analysis.prompt.ts` (v5) con Evidence-Based Scoring: fiabilidad ligada a citas verificables, explicación obligatoria del sesgo y límite de razonamiento interno (300 chars).
- ✅ Prompt `rag-chat.prompt.ts` (v5) con estrategia Zero Hallucination: persona de analista, límite de 150 palabras, frases obligatoriamente citadas `[x]` y mensaje estándar cuando falta contexto.
- ✅ Prompt `grounding-chat.prompt.ts` (v2) con persona periodística que prioriza fuentes oficiales y expone versiones contradictorias.
- ✅ Scripts `verify-analysis-rules.ts` y `verify-rag-rules.ts` para testear prompts (covers opinión vs. artículo factual y escenario “trap” sin contexto).

**Impacto**:
- 🔐 Scores de fiabilidad ya no superan 80 sin evidencia explícita; los artículos puramente opinativos caen <40.
- 🛡️ El chat RAG admite incertidumbre cuando no hay datos y documenta cada afirmación con citas del contexto recuperado.
- 📊 Nueva base para monitorear distribución de reliabilityScore y tasa de “No hay información suficiente”.

**Docs**: [`docs/sprints/Sprint-25-AI-Prompt-Improvements.md`](docs/sprints/Sprint-25-AI-Prompt-Improvements.md)

---

### Sprint 24
**AI-Powered Local Source Discovery + Multi-Source Ingestion** 🛰️
**Fecha**: 2026-02-09 | **Estado**: ✅ Completado

**Objetivo**: Automatizar la detección de fuentes locales y enriquecer la ingesta con múltiples RSS validados para temas “Local”.

**Implementado**:
- ✅ Nuevo modelo Prisma `Source` (UUID, location index, reliability) + migración `add_source_model`.
- ✅ Servicio `LocalSourceDiscoveryService`: consulta previa en BD, prompt Gemini `buildLocationSourcesPrompt`, validación RSS con timeout y upsert automático.
- ✅ Refactor `IngestNewsUseCase`: estrategia híbrida (fuentes locales + Google News), `fetchFromLocalSource`, `Promise.all` y fallback resiliente.
- ✅ Método `discoverLocalSources` en `GeminiClient` con retries y trazas Sentry + script `scripts/test-local-full-flow.ts` para validar E2E.
- ✅ Ajustes DI y schema HTTP para admitir categoría `local` + pruebas 24.2 con RSS Smart Probing (100% feeds válidos).

**Impacto**:
- 🌍 Descubrimiento autónomo de medios locales por ciudad, con cacheo para ahorrar tokens.
- 📰 Ingesta local siempre retorna contenido: si los RSS fallan se activa Google News sin cortar la experiencia.
- 📈 Preparado para panel de fuentes y health-checks futuros (reliability, isActive).

**Docs**: [`Sprint-24-ENTREGABLES.md`](Sprint-24-ENTREGABLES.md)

---

### Sprint 23.2
**Refactorización ChromaClient - URL Nativa** 🧱
**Fecha**: 2026-02-09 | **Estado**: ✅ Completado

**Objetivo**: Eliminar el parámetro deprecado `path` del SDK de Chroma y robustecer la configuración de conexión.

**Implementado**:
- ✅ Constructor de `ChromaClient` ahora usa `new URL()` (RFC 3986), valida formato y almacena `parsedUrl`.
- ✅ Extracción segura de `host` y `port` con defaults (80/443) e impresión clara `host:port`.
- ✅ Errores de configuración detallados cuando la URL es inválida.
- ✅ Compatibilidad con IPv6 y despliegues HTTPS sin cambios manuales.

**Impacto**:
- ⚙️ Backend arranca sin warnings y queda alineado con el API moderno de ChromaDB.
- 🛡️ Se evita spoofing/inyección al parsear URLs y se mejora la DX con IntelliSense (tipo `URL`).

**Docs**: [`docs/sprints/Sprint-23.2-ChromaClient-Refactor.md`](docs/sprints/Sprint-23.2-ChromaClient-Refactor.md)

---

### Sprint 22
**UI Cleanup + Smart Search con Keywords** 🎨🔍
**Fecha**: 2026-02-09 | **Estado**: ✅ Completado

**Objetivo**: Simplificar navegación, garantizar feeds con contenido y mejorar las consultas a fuentes externas con keywords inteligentes.

**Implementado**:
- ✅ Eliminación total de `CategoryPills`, sidebar como única navegación, parámetro `?topic=` y títulos dinámicos con Suspense boundary (`app/page.tsx`).
- ✅ Auto-fill en `NewsController`: si una categoría está vacía, dispara ingesta on-demand (incluido caso especial `ciencia-tecnologia`).
- ✅ Migración de tipos (`CategoryId` ➜ `string`) en hooks y stores para permitir nuevos topics.
- ✅ Diccionario `TOPIC_QUERIES` + `getSmartQuery()` en `IngestNewsUseCase` para enviar consultas OR específicas por tema.
- ✅ Fijado `theme-provider` + mejoras menores en perfil/localización.

**Impacto**:
- 📚 100% de categorías muestran contenido (auto-ingesta + fallback).
- 🚀 Hasta 5× más artículos por topic gracias a keywords OR.
- 🧭 Navegación coherente y sin duplicidades (solo sidebar).

**Docs**: [`docs/sprints/Sprint-22-UI-Cleanup-Smart-Search.md`](docs/sprints/Sprint-22-UI-Cleanup-Smart-Search.md)

---

### Sprint 20
**Geolocalización + Reestructuración de Categorías** 🌍
**Fecha**: 2026-02-09 | **Estado**: ✅ Fase 1 Completada

**Objetivo**: Preparar infraestructura para noticias geolocalizadas y categorías unificadas.

**Implementado**:
- ✅ Campo `User.location` (String opcional: "Madrid, España")
- ✅ Modelo `Topic` con 8 categorías unificadas
- ✅ Migración BD: `add_location_and_topics`
- ✅ Seed con 8 temas (España, Internacional, Local, Economía, Ciencia y Tecnología, Entretenimiento, Deportes, Salud)
- ✅ Fusión: "Ciencia" + "Tecnología" → "Ciencia y Tecnología"
- ✅ Nueva categoría: "Local" (preparada para geolocalización)

**Pendiente (Fases 2 y 3)**:
- 🔄 Backend API: TopicRepository, GetAllTopics, TopicController
- 🔄 Frontend: TopicSelector, LocationPicker, routing con slugs

**Docs**: [`Sprint-20-Geolocalizacion-Topics.md`](docs/sprints/Sprint-20-Geolocalizacion-Topics.md)

---

### Sprint 19.8
**Accesibilidad (WCAG 2.1 AA + UNE-EN 301549)** ♿
**Fecha**: 2026-02-09 | **Estado**: ✅ Completado

**Objetivo**: Cumplir normativa española de accesibilidad (Ley 11/2023, RD 1112/2018).

**Implementado**:
- ✅ Ancho de lectura configurable (4 niveles: 600px-full) para dislexia
- ✅ Componente `AccessibleToggle` WCAG-compliant (ARIA completo)
- ✅ Página `/accesibilidad` - Declaración oficial legal
- ✅ **FIX CRÍTICO**: ThemeProvider configurado (tema ahora funciona)
- ✅ Navegación por teclado completa
- ✅ Foco visible (ring-offset)
- ✅ Contraste 4.5:1 (WCAG AA)

**Cumplimiento**:
- ✅ WCAG 2.1 AA: ~85% (1.4.3, 1.4.4, 2.1.1, 2.3.3, 2.4.7, 4.1.2)
- ✅ UNE-EN 301549: Requisitos 9.x cumplidos
- ✅ RD 1112/2018: Declaración + procedimiento

**Docs**: [`Sprint-19.8-Accesibilidad.md`](docs/sprints/Sprint-19.8-Accesibilidad.md)

---

### Sprint 19.6
**Refinamiento de Navegación y Usabilidad** 🎨
**Fecha**: 2026-02-08 | **Estado**: ✅ Completado

**Objetivo**: Mejorar UX de navegación y acceso a funciones.

**Implementado**:
- ✅ Sidebar rediseñado con pestaña lateral colapsable
- ✅ Icono de bot personalizado en ambos chats
- ✅ Limpieza visual de componentes
- ✅ Mejor accesibilidad a funciones principales

**Docs**: [`Sprint-19.6.md`](docs/sprints/Sprint-19.6.md)

---

### Sprint 19.5
**Mantenimiento de Datos y Separadores** 📅
**Fecha**: 2026-02-08 | **Estado**: ✅ Completado

**Objetivo**: Limpieza de datos y mejora visual de timeline.

**Implementado**:
- ✅ Separadores de fecha en listado de noticias ("Hoy", "Ayer", "DD/MM/YYYY")
- ✅ Script de limpieza de artículos antiguos
- ✅ Mantenimiento automático de BD

**Docs**: [`Sprint-19.5.md`](docs/sprints/Sprint-19.5.md)

---

### Sprint 19.3-19.4
**Búsqueda Robusta + Infinite Scroll** 🔍📜
**Fecha**: 2026-02-07 | **Estado**: ✅ Completado

**Objetivo**: Mejorar búsqueda con tokenización y eliminar paginación.

**Sprint 19.3 - Búsqueda Robusta**:
- ✅ Tokenización multi-término ("inundaciones andalucia" → 2 tokens)
- ✅ Búsqueda accent-insensitive (normalización NFD)
- ✅ Generación de variantes con acentos
- ✅ Lógica AND: todos los términos deben estar presentes

**Sprint 19.4 - Infinite Scroll**:
- ✅ `useNewsInfinite` con `useInfiniteQuery`
- ✅ Integración con `react-intersection-observer`
- ✅ Paginación dinámica (offset-based)
- ✅ Compatible con autenticación per-user

**Docs**: [`Sprint-19.3-20.md`](docs/sprints/Sprint-19.3-20.md)

---

### Sprint 19
**Waterfall Search Engine** 🔍⚡
**Fecha**: 2026-02-06 | **Estado**: ✅ Completado

**Objetivo**: Sistema de búsqueda de 3 niveles con estrategia cascada.

**Arquitectura**:
- **LEVEL 1**: PostgreSQL Full-Text Search + LIKE fallback (< 500ms)
- **LEVEL 2**: Ingesta reactiva RSS + retry (8s timeout)
- **LEVEL 3**: Sugerencia Google News (0% resultados vacíos)

**Implementado**:
- ✅ Backend: Waterfall controller con 3 niveles
- ✅ Frontend: Debounce 500ms + loading states
- ✅ Página `/search` con badges de nivel
- ✅ Per-user enrichment (favoritos)
- ✅ Cache 5 min en React Query

**Métricas**:
- Velocidad LEVEL 1: 47-150ms
- Tasa de éxito: 100% (siempre ofrece alternativa)
- Reducción llamadas API: 80%+ (debounce)

**Docs**: [`SPRINT_19.md`](docs/sprints/SPRINT_19.md)

---

### Sprint 18.3
**UX Enhancements** ✨
**Fecha**: 2026-01 | **Estado**: ✅ Completado

**Objetivo**: Mejorar percepción de valor de AI y diversidad de fuentes.

**Implementado**:
- ✅ **Artificial Reveal**: Delay 1.8s cuando análisis pre-cargado (simula procesamiento AI)
- ✅ **Round Robin**: Backend interleaves fuentes para evitar "clumping"
- ✅ **Cards Hide Analysis**: Dashboard no muestra preview de análisis

**Docs**: [`SPRINT_18.3_UX_ENHANCEMENTS.md`](docs/sprints/SPRINT_18.3_UX_ENHANCEMENTS.md)

---

### Sprint 18.2
**Privacy Fix - Analysis Unlocked** 🔒
**Fecha**: 2026-01 | **Estado**: ✅ Completado

**Objetivo**: Separar conceptos "Favorito" vs "Análisis Desbloqueado".

**Implementado**:
- ✅ Campo `Favorite.unlockedAnalysis` (Boolean, default: false)
- ✅ Masking: Si `unlockedAnalysis: false`, oculta `analysis`, `summary`, `biasScore`
- ✅ Signal: `hasAnalysis` indica si existe caché global
- ✅ Repository: `getUserUnlockedArticleIds()` para filtrado
- ✅ Privacy estricta: Solo ven análisis los que lo solicitaron explícitamente

**Docs**: [`SPRINT_18.2_FAVORITE_UNLOCK_FIX.md`](docs/sprints/SPRINT_18.2_FAVORITE_UNLOCK_FIX.md)

---

### Sprint 18
**Multiusuario + Per-User Favorites** 👥
**Fecha**: 2026-01 | **Estado**: ✅ Completado

**Objetivo**: Sistema de favoritos por usuario (no global).

**Implementado**:
- ✅ Tabla `Favorite(userId, articleId)` - Junction table con composite PK
- ✅ Deprecado: `Article.isFavorite` (era global)
- ✅ Routes: `PATCH /favorite` con `authenticate`, GET con `optionalAuthenticate`
- ✅ Frontend: Todos los endpoints pasan token para enrichment
- ✅ Auto-favorite al analizar artículo

**Docs**: [`SPRINT_18_PRIVACY_MULTIUSER.md`](docs/sprints/SPRINT_18_PRIVACY_MULTIUSER.md)

---

### Sprint 17
**Cost Optimization** 💰
**Fecha**: 2026-01 | **Estado**: ✅ Completado

**Objetivo**: Reducir costes de Gemini API.

**Implementado**:
- ✅ Global analysis cache: Si `article.isAnalyzed`, retorna caché (no llama Gemini)
- ✅ Smart Ingestion: TTL 1-hora antes de auto-ingesta
- ✅ Frontend fake delay: 2s mínimo para UX (aunque caché sea instantáneo)
- ✅ Reducción estimada: 60-70% en llamadas API

**Docs**: [`SPRINT_17_COST_OPTIMIZATION.md`](docs/sprints/SPRINT_17_COST_OPTIMIZATION.md)

---

### Sprint 16
**Categorías Independientes + Sistema Robusto** 📰
**Fecha**: 2025-12 | **Estado**: ✅ Completado

**Objetivo**: Ingesta por categoría y sistema resiliente.

**Implementado**:
- ✅ Ingesta RSS por categoría (general, economía, deportes, tecnología, ciencia, política, internacional)
- ✅ TTL inteligente: 1 hora entre ingestas
- ✅ Auto-refresh en navegación entre categorías
- ✅ Deduplicación por URL
- ✅ Error handling robusto

**Fixes Aplicados**:
- ✅ Fix duplicados (Sprint 16.1)
- ✅ Fix double-click análisis (Sprint 16.2)
- ✅ Fix fetch error (Sprint 16.3)

**Docs**:
- [`SPRINT_16_UX_POLISH_FRESHNESS.md`](docs/sprints/SPRINT_16_UX_POLISH_FRESHNESS.md)
- [`SPRINT_16_FIX_DUPLICADOS_RESUMEN.md`](docs/sprints/SPRINT_16_FIX_DUPLICADOS_RESUMEN.md)

---

### Sprint 15
**Observabilidad & Analytics** 👁️📊
**Fecha**: 2025-12 | **Estado**: ✅ Completado

**Objetivo**: "Ojos en Producción" con Sentry + Distributed Tracing.

**Implementado**:
- ✅ Sentry integrado en backend + frontend
- ✅ Pino logger con transporte Sentry
- ✅ Distributed tracing: HTTP → Gemini → Database
- ✅ Custom metrics y breadcrumbs
- ✅ Source maps para debugging

**Docs**:
- [`SPRINT_15_SENTRY_SETUP.md`](docs/sprints/SPRINT_15_SENTRY_SETUP.md)
- [`SPRINT_15_PASO_3_DISTRIBUTED_TRACING.md`](docs/sprints/SPRINT_15_PASO_3_DISTRIBUTED_TRACING.md)

---

### Sprint 14.5
**Frontend Polish & Robustness** 🛡️🎨
**Fecha**: 2025-12 | **Estado**: ✅ Completado

**Objetivo**: Pulir frontend y añadir manejo de errores.

**Implementado**:
- ✅ Zustand para estado de perfil
- ✅ Error boundaries globales
- ✅ Loading states consistentes
- ✅ Toast notifications (sonner)
- ✅ Retry logic en mutaciones

**Docs**: [`SPRINT_14_5_FRONTEND_POLISH.md`](docs/sprints/SPRINT_14_5_FRONTEND_POLISH.md)

---

### Sprint 14
**Auditoría de Seguridad + Refactor** 🔒🔧
**Fecha**: 2025-12 | **Estado**: ✅ Completado

**Objetivo**: Blindar backend y refactorizar código crítico.

**Implementado**:
- ✅ Validación Zod en todos los endpoints
- ✅ Rate limiting (express-rate-limit)
- ✅ Helmet para headers de seguridad
- ✅ JWT validation en middleware
- ✅ Input sanitization
- ✅ Refactor de endpoints críticos

**Fixes Bloqueantes**:
- Sprint 14.1: Security XSS/Injection
- Sprint 14.2: Refactor dependencies
- Sprint 14.3: Security CSRF
- Sprint 14.4: RAG format fix

**Docs**: [`SPRINT_14_CONSOLIDADO.md`](docs/sprints/SPRINT_14_CONSOLIDADO.md)

---

### Sprint 13
**Resiliencia Enterprise** 🛡️📊
**Fecha**: 2025-11 | **Estado**: ✅ Completado

**Objetivo**: Preparar para producción con resiliencia y monitoreo.

**Implementado**:
- ✅ Health check endpoint (`/health`)
- ✅ Readiness/Liveness probes
- ✅ Graceful shutdown
- ✅ Connection pooling
- ✅ Circuit breakers
- ✅ Retry policies
- ✅ Logging estructurado (Pino)

**Sub-sprints**:
- 13.1: Botón Refresh News
- 13.2: HealthController
- 13.3: Refactor Backend TDD
- 13.4: Refactor Frontend
- 13.5: XAI + Optimización Prompts
- 13.6: Refactor Prompts
- 13.7: Optimización UX

---

### Sprint 12
**Testing Frontend + Auto-Logout** 🎯
**Fecha**: 2025-11 | **Estado**: ✅ Completado

**Objetivo**: Completar ciclo de testing y mejorar seguridad.

**Implementado**:
- ✅ Tests unitarios frontend (React Testing Library)
- ✅ Auto-logout en 401 (interceptor Axios)
- ✅ Toast notifications para errores
- ✅ Refresh token handling

---

### Sprint 11
**Suite de Testing Backend** 🛡️
**Fecha**: 2025-11 | **Estado**: ✅ Completado

**Objetivo**: Backend blindado con testing completo.

**Implementado**:
- ✅ Vitest configurado
- ✅ Tests unitarios (80%+ cobertura)
- ✅ Tests de integración
- ✅ Mocks de Prisma y Gemini
- ✅ CI/CD ready

**Docs**: [`TESTS_SPRINT_11_QA.md`](docs/refactors/TESTS_SPRINT_11_QA.md)

---

### Sprint 10
**Usuarios, Perfiles y Motor Optimizado** 👤
**Fecha**: 2025-11 | **Estado**: ✅ Completado

**Implementado**:
- ✅ Modelo User con Firebase Auth
- ✅ Perfiles de usuario
- ✅ Página `/profile`
- ✅ Dashboard personalizado
- ✅ Optimización motor análisis

---

### Sprint 9
**Gestor de Fuentes RSS con Auto-Discovery** 📡
**Fecha**: 2025-10 | **Estado**: ✅ Completado

**Implementado**:
- ✅ Auto-discovery de feeds RSS
- ✅ Parser RSS robusto
- ✅ Gestión de fuentes
- ✅ Ingesta automática

---

### Sprint 8
**Optimización de Costes Gemini** 💰
**Fecha**: 2025-10 | **Estado**: ✅ Completado

**Implementado**:
- ✅ Token taximeter (contador de tokens)
- ✅ Tests de carga con k6
- ✅ Optimización de prompts
- ✅ Caché de análisis

---

### Sprint 7
**Chat RAG con Gemini** 💬
**Fecha**: 2025-10 | **Estado**: ✅ Completado

**Implementado**:
- ✅ Sistema RAG con ChromaDB
- ✅ Chat conversacional
- ✅ Embeddings con Gemini
- ✅ Búsqueda semántica
- ✅ Auto-favoritos

---

### Sprints Iniciales
**MVP Base (Sprints 1-6)** 🚀
**Fecha**: 2025-09 | **Estado**: ✅ Completado

**Implementado**:
- ✅ Arquitectura hexagonal
- ✅ CRUD artículos
- ✅ Ingesta RSS básica
- ✅ Análisis con Gemini
- ✅ Frontend básico
- ✅ Autenticación Firebase

---

## 🏗️ Arquitectura Actual

### Backend (Clean Architecture)
```
backend/src/
├── domain/
│   ├── entities/          # NewsArticle, User, Topic
│   ├── repositories/      # Interfaces
│   └── value-objects/
├── application/
│   └── use-cases/         # Lógica de negocio
├── infrastructure/
│   ├── persistence/       # Prisma repositories
│   ├── external/          # Gemini, pgvector, RSS/Jina
│   ├── http/              # Controllers, routes, middleware
│   └── config/            # DependencyContainer
└── index.ts
```

### Frontend (Next.js App Router)
```
frontend/
├── app/                   # Pages (App Router)
├── components/            # UI components
├── hooks/                 # Custom hooks (React Query)
├── lib/                   # API clients
└── context/               # Auth, Theme
```

### Base de Datos
```
PostgreSQL 17
├── users (Firebase UID, location, preferences)
├── articles (noticias + embeddings)
├── favorites (userId + articleId + unlockedAnalysis)
├── topics (Sprint 20: categorías unificadas)
├── search_history
├── chats + messages
└── ingest_metadata
```

---

## 📦 Stack Tecnológico

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express 5
- **Language**: TypeScript 5.9
- **ORM**: Prisma 7.3
- **Database**: PostgreSQL 17 (con adapter PrismaPg)
- **Auth**: Firebase Admin SDK
- **AI**: Google Gemini 2.0 Flash
- **Vector DB**: pgvector (PostgreSQL extension)
- **Logger**: Pino 10
- **Monitoring**: Sentry
- **Testing**: Vitest

### Frontend
- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: React Query 5 + Zustand
- **Auth**: Firebase Auth (Client SDK)
- **Testing**: Playwright (E2E)

### DevOps
- **Version Control**: Git + GitHub
- **CI/CD**: GitHub Actions (ready)
- **Monitoring**: Sentry
- **Logs**: Pino + Sentry transport

---

## 🔑 Conceptos Clave del Proyecto

### 1. Clean Architecture (Hexagonal)
- **Domain**: Entidades puras, sin dependencias externas
- **Application**: Use cases con lógica de negocio
- **Infrastructure**: Implementaciones concretas (Prisma, Gemini, etc.)
- **DI Container**: Singleton en `dependencies.ts`

### 2. Per-User Features
- **Favorites**: Junction table `Favorite(userId, articleId)`
- **Analysis Privacy**: Campo `unlockedAnalysis` para control de acceso
- **Search History**: Por usuario
- **Chat**: Conversaciones privadas

### 3. AI Analysis
- **Modelo**: Gemini 2.0 Flash
- **Cache Global**: `article.isAnalyzed` evita re-análisis
- **XAI**: Campo `internalReasoning` para auditoría (no enviado al cliente)
- **Cost Optimization**: TTL inteligente + caché

### 4. Search Strategy
- **Waterfall 3 niveles**: DB → RSS → Google News
- **Tokenización**: Multi-término accent-insensitive
- **Full-Text Search**: PostgreSQL con fallback LIKE

### 5. Accesibilidad
- **WCAG 2.1 AA**: ~85% cumplimiento
- **UNE-EN 301549**: Requisitos europeos
- **RD 1112/2018**: Normativa española
- **Declaración**: `/accesibilidad`

### 6. Categorías (Sprint 20)
- **Modelo Topic**: Categorías dinámicas con slugs
- **8 Temas**: España, Internacional, Local, Economía, Ciencia y Tecnología, Entretenimiento, Deportes, Salud
- **Geolocalización**: Campo `User.location` para noticias locales

---

## 📈 Métricas de Calidad

| Métrica | Objetivo | Actual | Estado |
|---------|----------|--------|--------|
| **Cobertura Backend** | > 80% | ~85% | ✅ |
| **Cobertura Frontend** | > 70% | ~60% | 🔄 |
| **Lighthouse Performance** | > 90 | ~92 | ✅ |
| **Lighthouse Accessibility** | > 95 | ~88 | 🔄 |
| **Tiempo Búsqueda LEVEL 1** | < 500ms | 47-150ms | ✅ |
| **Uptime Backend** | > 99% | N/A | - |
| **WCAG 2.1 AA** | 100% | ~85% | 🔄 |

---

## 🚀 Roadmap Futuro

### Corto plazo (pre-main)
- [ ] Backfill de artículos legacy para estado de acceso (`paywall/restricted/public`). (Suposición razonable)
- [ ] Homogeneizar copy/error handling en frontend para códigos API (`422/403/401`). (Suposición razonable)
- [ ] Reducir referencias históricas a componentes legacy en docs/tests. (Suposición razonable)

### Medio plazo
- [ ] Observabilidad de calidad de input (`inputQuality`, `textSource`) en panel interno. (Suposición razonable)
- [ ] Alertas sobre tasa de `formatError` y fallos de extractor. (Suposición razonable)
- [ ] Política de reanálisis controlada para cache legacy. (Suposición razonable)

### Largo plazo
- [ ] Integración de billing real manteniendo contrato de `entitlements`. (Suposición razonable)
- [ ] Mejoras de explainability y auditoría sobre citas/claims. (Suposición razonable)

---

## 📚 Documentación Adicional

### Diagramas
- [Arquitectura Hexagonal](docs/diagrams/architecture_hexagonal.md)
- [Secuencia de Análisis](docs/diagrams/sequence_analysis.md)
- [ER Base de Datos](docs/diagrams/database_er.md)

### Guías Técnicas
- [Estructura del Proyecto](./ESTRUCTURA_PROYECTO.md)
- [API Interceptor](./architecture/API_INTERCEPTOR.md)
- [Smart Ingestion](./architecture/SMART_INGESTION.md)
- [Calidad y Testing](./CALIDAD.md)

### Memoria TFM
- [MemoriaTFM.md](./MemoriaTFM.md) - Documento completo del proyecto

---

## 🔗 Enlaces Rápidos

- **Frontend**: `http://localhost:3001`
- **Backend**: `http://localhost:3000`
- **API Docs**: `http://localhost:3000/api/health`
- **Prisma Studio**: `npx prisma studio`
- **Sentry**: [Panel de monitoreo](https://sentry.io)

---

## 👥 Equipo

- **David** - Full Stack Developer
- **Claude Sonnet 4.5** - AI Assistant & Code Review

---

## 📝 Notas de Migración

### Si migras a nuevo entorno:

1. **Backend**:
```bash
cd backend
npm install
cp .env.example .env  # Configurar variables
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

2. **Frontend**:
```bash
cd frontend
npm install
cp .env.example .env.local  # Configurar variables
npm run dev
```

3. **PostgreSQL**:
- Crear base de datos `verity_news`
- Puerto: 5433 (configurable en .env)

4. **Firebase**:
- Configurar proyecto Firebase
- Obtener credenciales (Admin SDK + Client)

5. **Gemini API**:
- Obtener API Key de Google AI Studio

6. **ChromaDB**:
- Instalar localmente o usar Docker
- Puerto: 8000 (default)

---

**Última revisión**: 2026-02-11
**Versión del documento**: 2.2 (Actualizado Sprint 27.3)



