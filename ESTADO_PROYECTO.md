# Estado del Proyecto - Verity News

> Última actualización: Sprint 2 - El Cerebro de la IA (2026-01-29) - Revisión Final

---

## Estado Actual: SPRINT 2 - ANÁLISIS IA COMPLETO Y VALIDADO

| Componente | Estado | Notas |
|------------|--------|-------|
| **Estructura Proyecto** | ✅ Listo | Carpetas creadas, Monorepo setup. |
| **Frontend** | ✅ Listo | Vite + React + TS corriendo en puerto 5173. |
| **Backend - Core** | ✅ Listo | Express + TS + Clean Arch configurado. Health check OK. |
| **Backend - Domain** | ✅ Listo | Entidades, Repositories, Errores personalizados, interfaces IA. |
| **Backend - Application** | ✅ Listo | IngestNewsUseCase + AnalyzeArticleUseCase con tests. |
| **Backend - Infrastructure** | ✅ Listo | NewsAPI, Gemini 2.5 Flash, JinaReader, Prisma 7 + Adapter. |
| **Base de Datos** | ✅ Listo | PostgreSQL + Prisma 7 con `@prisma/adapter-pg`. |
| **Infraestructura Docker** | ✅ Listo | PostgreSQL, ChromaDB y Redis corriendo. |
| **Pipeline de Ingesta** | ✅ Listo | NewsAPI integrado con filtrado de duplicados. |
| **Pipeline de Análisis IA** | ✅ Listo | **Gemini 2.5 Flash** + Jina Reader integrados y validados. |
| **Testing** | ✅ Listo | Vitest configurado, 41 tests pasando. |
| **ChromaDB Integration** | ⏳ Pendiente | Embeddings y búsqueda vectorial por integrar. |

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

## Próximos Pasos (Sprint 3)

1. **Integrar ChromaDB** para almacenamiento de embeddings
2. **Generar embeddings** de los artículos analizados
3. **Implementar búsqueda semántica** (RAG)
4. **Crear endpoint de chat conversacional** con contexto
5. **Frontend básico** para visualizar artículos y análisis
