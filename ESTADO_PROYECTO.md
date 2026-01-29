# Estado del Proyecto - Verity News

> Última actualización: Sprint 3 - Experiencia y Visualización (2026-01-29) - **FINALIZADO** ✅

---

## Estado Actual: SPRINT 3 - LA CAPA DE EXPERIENCIA **COMPLETADO**

| Componente | Estado | Notas |
|------------|--------|-------|
| **Estructura Proyecto** | ✅ Listo | Carpetas creadas, Monorepo setup. |
| **Frontend** | ✅ Listo | Next.js 16.1.6 + React 19 + TypeScript + Turbopack. |
| **Backend - Core** | ✅ Listo | Clean Architecture validada y robusta. |
| **Backend - Domain** | ✅ Listo | Entidades, Repositories, Errores personalizados, interfaces IA. |
| **Backend - Application** | ✅ Listo | IngestNewsUseCase + AnalyzeArticleUseCase con tests + Fallback Strategy. |
| **Backend - Infrastructure** | ✅ Listo | NewsAPI, Gemini 2.5 Flash (corregido), JinaReader con fallback, Prisma 7 + Adapter. |
| **Base de Datos** | ✅ Listo | PostgreSQL + Prisma 7 con `@prisma/adapter-pg`. |
| **Infraestructura Docker** | ✅ Listo | PostgreSQL, ChromaDB y Redis corriendo. |
| **Pipeline de Ingesta** | ✅ Listo | NewsAPI integrado con filtrado de duplicados. |
| **Pipeline de Análisis IA** | ✅ Listo | **Gemini 2.5 Flash** + Jina Reader + Fallback Strategy + Soporte contenido parcial. |
| **Dashboard Analytics** | ✅ Listo | Recharts (Donut Chart) + StatsOverview + BiasDistributionChart. |
| **Layout Sidebar** | ✅ Listo | Navegación escalable, responsive hamburger menu, 4 items principales. |
| **Dashboard Drawer** | ✅ Listo | Sheet lateral con análisis de medios bajo demanda. |
| **Página Principal** | ✅ Listo | Client component con Sidebar + Main Content + Dashboard integrado. |
| **Chat IA (RAG Agéntico)** | ✅ Listo | Chat con Gemini + Google Search Grounding, contexto de noticia, auto-scroll. |
| **Auto-scroll Chat** | ✅ Listo | Implementado con viewport ref directo. |
| **Testing** | ✅ Listo | Vitest configurado, 41 tests pasando. |
| **ChromaDB Integration** | ⏳ Pendiente | Sprint 4 - Embeddings y búsqueda vectorial global. |

---

## Logros Sprint 3: La Capa de Experiencia

### 1. Arquitectura de Interfaz (Layout & Navigation)
- ✅ **Sidebar Escalable:** Navegación lateral de 264px con 4 items principales (Últimas noticias, Tendencias, Favoritos, Inteligencia de Medios)
- ✅ **Responsive Design:** Hamburger menu en móvil, sidebar fijo en desktop
- ✅ **Layout Profesional:** Two-column layout (Sidebar + Main) que despeja el feed de noticias
- ✅ **Barrel Exports:** Componentes organizados en `components/layout/` y `components/dashboard/`

### 2. Chat Inteligente (RAG Agéntico)
- ✅ **Gemini 2.5 Flash con Google Search Grounding:** Chat con acceso a búsquedas web en tiempo real
- ✅ **Consultas Externas:** Capacidad de realizar búsquedas y recuperar noticias relacionadas
- ✅ **Contexto de Noticia:** Chat mantiene contexto del artículo seleccionado
- ✅ **Auto-scroll:** Scroll automático al nuevo mensaje con viewport ref
- ✅ **Historia de Conversación:** Mantiene sesión de chat en memoria del componente

### 3. Dashboard de Analítica (Visualización)
- ✅ **Gráfico Donut con Recharts:** Distribución visual de sesgo (Left/Neutral/Right)
- ✅ **4 KPIs Operativos:**
  - Noticias Totales
  - Analizadas con IA
  - Cobertura IA (%)
  - Índice de Veracidad
- ✅ **Panel Deslizable (Sheet):** Abre desde Sidebar, responsive full-width en móvil
- ✅ **Skeletons de Carga:** Estados indeterminados manejados elegantemente

### 4. Resiliencia en Análisis (Fallback Strategy)
- ✅ **Análisis Parcial:** Si el scraping falla, se utiliza título + descripción
- ✅ **Detección de Errores:** Identifica contenido inválido (null, < 100 chars, errores)
- ✅ **Flag usedFallback:** Aviso en prompt de Gemini sobre análisis preliminar
- ✅ **URLs Bloqueadas:** Manejo graceful de sitios con restricciones

### 5. UX Avanzada
- ✅ **Auto-scroll en Chat:** Implementado con viewport ref directo
- ✅ **Skeletons de Carga:** Para KPIs y gráficos durante fetching
- ✅ **Estados de Error:** Mensaje de error + instrucciones de curl para backend
- ✅ **Empty State:** Interfaz clara cuando no hay noticias
- ✅ **Tailwind v4 Optimizado:** Clases canónicas (shrink-0 en lugar de flex-shrink-0)

---

## Sprint 1: Cimientos y Arquitectura (Completado)

- [x] Definición del Stack y Modelo de Datos.
- [x] Creación de Repositorio y README.
- [x] Configuración de **Claude Code** (Backend Setup).
- [x] Levantar **Docker Compose** (Postgres + ChromaDB + Redis).
- [x] Configurar **Prisma ORM** (Schema inicial con Prisma 7).
- [x] Endpoint de **Health Check** (Backend conectado y verificado).
- [x] **Pipeline de Ingesta** (NewsAPI integrado con Clean Architecture).

---

## Sprint 2: El Cerebro de la IA (Completado)

- [x] Instalar dependencia `@google/generative-ai`.
- [x] Actualizar schema Prisma con campos de análisis IA.
- [x] Actualizar entidad `NewsArticle` con `summary`, `biasScore`, `analysis`, `analyzedAt`.
- [x] Crear interfaz `IGeminiClient` en Domain Layer.
- [x] Crear interfaz `IJinaReaderClient` en Domain Layer.
- [x] Implementar `GeminiClient` (Gemini Flash API).
- [x] Implementar `JinaReaderClient` (Jina Reader API para scraping).
- [x] Actualizar `INewsArticleRepository` con `findById`, `findUnanalyzed`, `countAnalyzed`.
- [x] Crear `AnalyzeArticleUseCase` con análisis single y batch.
- [x] Crear `AnalyzeController` y rutas Express.
- [x] Validación Zod para endpoints de análisis.
- [x] 25 tests unitarios para AnalyzeArticleUseCase (41 tests totales).

---

## Historial de Decisiones (ADRs)

- **ADR-001:** Se elige **Monorepo** para facilitar la gestión de tipos compartidos entre Front y Back.
- **ADR-002:** Se utilizará **Prisma 7** como ORM con `@prisma/adapter-pg` para conexión directa a PostgreSQL.
- **ADR-003:** Se usará **Gemini 2.5 Flash** (Pay-As-You-Go) por rendimiento y coste optimizado (~0.0002€/artículo).
- **ADR-004:** Pipeline de Ingesta implementado siguiendo Clean Architecture estricta (Domain → Application → Infrastructure → Presentation).
- **ADR-005:** Validación Zod en capa de Presentation (Shift Left Security) antes de llegar al UseCase.
- **ADR-006:** Testing unitario con Vitest, objetivo 100% coverage en Domain y Application, 80% en Presentation.
- **ADR-007:** Jina Reader API para extracción de contenido web (scraping) por su simplicidad y calidad de resultados.
- **ADR-008:** Análisis de bias con escala numérica 0-1 (0=neutral, 1=altamente sesgado) con indicadores específicos.
- **ADR-009:** Prisma 7 requiere Driver Adapters - se usa `@prisma/adapter-pg` en lugar de conexión directa.

---

## Logros Sprint 2 (2026-01-29)

### Sistema de Análisis IA Completo

**Domain Layer** (Puro, sin dependencias):
- Entidad `NewsArticle` actualizada con campos de análisis (`summary`, `biasScore`, `analysis`, `analyzedAt`)
- Nueva interfaz `ArticleAnalysis` para tipado de resultados
- Interfaz `IGeminiClient` con contrato para análisis de contenido
- Interfaz `IJinaReaderClient` con contrato para scraping web
- Métodos inmutables en entidad: `withAnalysis()`, `withFullContent()`, `getParsedAnalysis()`

**Application Layer** (Lógica de negocio):
- `AnalyzeArticleUseCase` con:
  - Análisis individual por ID de artículo
  - Análisis en batch de artículos pendientes
  - Estadísticas de análisis (total, analizados, pendientes, porcentaje)
  - Scraping automático si el contenido es insuficiente
  - **25 tests unitarios con 100% coverage**

**Infrastructure Layer**:
- `GeminiClient` con:
  - Modelo: **Gemini 2.5 Flash** (Pay-As-You-Go)
  - Sanitización de inputs (prevención prompt injection)
  - Parsing robusto de respuestas JSON
  - Manejo de errores: 404 (modelo), 429 (rate limit), 401 (API key)
- `JinaReaderClient` con:
  - Validación de URLs
  - Timeout configurable
  - Limpieza de contenido extraído
- `PrismaNewsArticleRepository` actualizado con:
  - Prisma 7 + `@prisma/adapter-pg`
  - `findById()`, `findUnanalyzed()`, `countAnalyzed()`
  - Soporte para nuevos campos de análisis

**Presentation Layer**:
- `AnalyzeController` con manejo de errores centralizado
- Rutas Express para análisis
- Schemas Zod para validación de inputs

**Schema Prisma actualizado**:
```prisma
model Article {
  // ... campos existentes ...

  // AI Analysis fields
  summary       String?   @db.Text
  biasScore     Float?
  analysis      String?   @db.Text
  analyzedAt    DateTime?

  @@index([analyzedAt])
}
```

**Archivos Creados/Modificados** (17 archivos):
```
backend/
├── prisma.config.ts (configuración Prisma 7)
├── prisma/
│   └── schema.prisma (campos IA)
└── src/
    ├── domain/
    │   ├── entities/news-article.entity.ts
    │   ├── repositories/news-article.repository.ts
    │   └── services/
    │       ├── gemini-client.interface.ts (nuevo)
    │       └── jina-reader-client.interface.ts (nuevo)
    ├── application/
    │   └── use-cases/
    │       ├── analyze-article.usecase.ts (nuevo)
    │       └── analyze-article.usecase.spec.ts (nuevo)
    └── infrastructure/
        ├── external/
        │   ├── gemini.client.ts (nuevo - Gemini 2.5 Flash)
        │   ├── jina-reader.client.ts (nuevo)
        │   └── newsapi.client.ts (corregido NEWS_API_KEY)
        ├── persistence/prisma-news-article.repository.ts
        ├── config/dependencies.ts (Prisma 7 adapter)
        └── http/
            ├── schemas/analyze.schema.ts (nuevo)
            ├── controllers/analyze.controller.ts (nuevo)
            ├── routes/analyze.routes.ts (nuevo)
            └── server.ts
```

**API Endpoints Disponibles**:
- `POST /api/ingest/news` - Ingestar noticias desde NewsAPI
- `GET /api/ingest/status` - Estado de última ingesta
- `POST /api/analyze/article` - Analizar artículo individual `{ articleId: UUID }`
- `POST /api/analyze/batch` - Analizar batch de artículos `{ limit: 1-100 }`
- `GET /api/analyze/stats` - Estadísticas de análisis
- `GET /health` - Health check

**Testing**:
- 41 tests unitarios pasando
- 25 tests para AnalyzeArticleUseCase
- 16 tests para IngestNewsUseCase

---

## Correcciones Técnicas (2026-01-29)

### Migración a Prisma 7 con Driver Adapters
Prisma 7 eliminó el soporte para `new PrismaClient()` sin opciones. Se requiere:
```typescript
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
```

**Dependencias añadidas:**
- `@prisma/adapter-pg`
- `pg` + `@types/pg`

### Actualización del Modelo de IA
- **Antes:** `gemini-1.5-flash` (no disponible en cuenta de pago)
- **Después:** `gemini-2.5-flash` (modelo estable, Pay-As-You-Go)

### Variables de Entorno
- Corregida variable `NEWSAPI_KEY` → `NEWS_API_KEY` para coincidir con `.env`

### Unit Economics Validados
- **Coste por artículo:** < 0.0002€ con Gemini 2.5 Flash
- **Presupuesto 5€/mes:** Permite procesar +25.000 artículos
- **Modelo de negocio:** Freemium viable

---

## Sprint 3: La Capa de Experiencia (Completado - 2026-01-29)

### Cambios Técnicos Realizados

**Backend:**
- `gemini.client.ts`: Corregido tool de Gemini `googleSearchRetrieval` → `googleSearch` con `@ts-expect-error`
- `analyze-article.usecase.ts`: Implementada fallback strategy robusta para URLs bloqueadas
  - Detección de contenido inválido (null, < 100 chars, "JinaReader API Error")
  - Fallback a `title + description` cuando scraping falla
  - Flag `usedFallback` para advertencia en prompt

**Frontend:**
- `app/page.tsx`: Convertida a `'use client'` component con React hooks
  - `useEffect` para fetching con `Promise.all([fetchNews, fetchDashboardStats])`
  - Layout de dos columnas: `<Sidebar /> + <main className="flex-1">`
  - Integración de `<DashboardDrawer isOpen={isDashboardOpen} />`
  - Estados de error, carga, vacío y populated
  - Función `calculateBiasDistribution()` integrada

- `components/layout/sidebar.tsx` (NEW, 142 líneas):
  - Hamburger menu en móvil (top-left fijo)
  - 4 items: Últimas noticias, Tendencias, Favoritos, Inteligencia de Medios
  - Sección de Settings
  - Responsive: Hidden en móvil (-translate-x-full), 264px fijo en desktop
  - Prop `onOpenDashboard` para abrir analytics

- `components/layout/dashboard-drawer.tsx` (NEW, 59 líneas):
  - Sheet lateral que contiene `StatsOverview`
  - Props: isOpen, onOpenChange, stats data
  - Responsive: Full width en móvil, max-w-2xl en desktop

- `components/dashboard/bias-distribution-chart.tsx` (NEW, 60 líneas):
  - Donut chart con Recharts
  - Colores semánticos: Left (Red 500), Neutral (Slate 400), Right (Blue 500)
  - Tooltips interactivos
  - Fallback UI "Sin datos de sesgo"

- `components/dashboard/stats-overview.tsx` (NEW, 127 líneas):
  - Grid de 5 columnas (2 KPI + 3 gráfico)
  - 4 KPI Cards + BiasDistributionChart
  - Skeletons para carga
  - Responsive

- `app/layout.tsx`: Metadata actualizada, background global
- `components/news-chat-drawer.tsx`: Auto-scroll con viewport ref
- `components/layout/index.ts` (NEW): Barrel exports

### Archivos Modificados/Creados
- 10 archivos modificados/creados
- ~650 líneas de código nuevo
- 0 errores de TypeScript
- 0 warnings de Tailwind CSS (clases canónicas)

### Dependencias Añadidas
- `recharts` (gráficos)
- `@radix-ui/react-sheet` (drawer)
- `lucide-react` (iconos)

### Errores Corregidos
1. ✅ Gemini API: `google_search_retrieval` → `google_search`
2. ✅ TypeScript compilation error en gemini.client.ts
3. ✅ Auto-scroll fallaba con ScrollArea (reemplazado con div nativo)
4. ✅ Scraping fallido dejaba contenido vacío (fallback strategy)
5. ✅ Llave extra en page.tsx (removida)
6. ✅ Warnings de Tailwind: `flex-shrink-0` → `shrink-0`

### Testing Validado
- ✅ No TypeScript errors
- ✅ No lint errors
- ✅ Todos los imports resolvidos
- ✅ Componentes renderizando correctamente
- ✅ Responsive en móvil/tablet/desktop

---

## Próximos Pasos: Sprint 4 - Cierre y Refinamiento

### 1. Integración de ChromaDB
- [ ] Generar embeddings de artículos analizados
- [ ] Almacenar embeddings en ChromaDB
- [ ] Crear endpoint `/api/search/semantic` para RAG global
- [ ] Búsqueda semántica entre todas las noticias

### 2. Auditoría Final
- [ ] Revisión de seguridad OWASP (SQL injection, XSS, CSRF)
- [ ] Optimización de costes de APIs (Gemini, NewsAPI, Jina)
- [ ] Performance audit (Lighthouse, Web Vitals)
- [ ] Testing de carga (k6 o Artillery)

### 3. Memoria TFM
- [ ] Redacción de capítulo de IA Assisted Engineering
- [ ] Conclusiones y limitaciones
- [ ] Recomendaciones futuras
- [ ] Apéndices técnicos

### 4. Mejoras Futuras (Sprint 5+)
- [ ] Rutas adicionales: `/trending`, `/favorites`, `/news/[id]`
- [ ] Persistencia de favoritos en BD
- [ ] Historial de búsquedas semánticas
- [ ] Alertas personalizadas por tema
- [ ] Exportación de reportes de sesgo

---

## Métricas de Desarrollo - Sprint 3

| Métrica | Valor |
|---------|-------|
| **Duración** | 1 día (2026-01-29) |
| **Componentes Creados** | 5 nuevos |
| **Archivos Modificados** | 5 existentes |
| **Líneas de Código** | ~650 |
| **Tests** | 41 pasando (sin cambios) |
| **TypeScript Errors** | 0 |
| **Warnings** | 0 |
| **Tiempo de Build** | ~45s (Turbopack) |

---

## Conclusión Sprint 3

**Sprint 3 representa la materialización de la "Capa de Experiencia"** - aquella que el usuario ve e interactúa. Se ha logrado:

1. ✅ Una interfaz profesional y escalable con Sidebar
2. ✅ Un chat inteligente con capacidades de búsqueda web
3. ✅ Un dashboard de analítica que expone insights valiosos
4. ✅ Una resiliencia robusta ante fallos de servicios externos
5. ✅ Una UX pulida con auto-scroll, skeletons y manejo de errores

**El proyecto ahora tiene:**
- 🧠 Cerebro (Backend IA + Gemini) - Sprint 2 ✅
- 👁️ Ojos (Dashboard + Visualización) - Sprint 3 ✅
- 🤖 Voz (Chat conversacional) - Sprint 3 ✅
- 💾 Memoria (ChromaDB embeddings) - Sprint 4 (Pendiente)

**Status:** Listo para auditoría técnica final y redacción de TFM.

