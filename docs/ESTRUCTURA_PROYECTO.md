# Estructura del Proyecto Verity-News

**Fecha de Generación:** 4 de febrero de 2026  
**Versión del Proyecto:** Sprint 13.4  
**Arquitectura:** Clean Architecture (Hexagonal) + Arquitectura Basada en Componentes (React)

---

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Estructura Raíz](#estructura-raíz)
3. [Backend](#backend)
4. [Frontend](#frontend)
5. [Documentación](#documentación)
6. [Testing](#testing)
7. [Configuración y Utilidades](#configuración-y-utilidades)

---

## 🎯 Visión General

Verity-News es una plataforma de análisis de credibilidad de noticias que utiliza IA para evaluar el sesgo, la fiabilidad y proporcionar conversación contextual sobre artículos de noticias. El proyecto sigue una arquitectura hexagonal en el backend y componentes reutilizables en el frontend.

**Tecnologías Principales:**
- **Backend:** Node.js, TypeScript, Express, Prisma ORM, PostgreSQL
- **Frontend:** Next.js 16, React 18, TypeScript, TailwindCSS, shadcn/ui
- **IA/ML:** OpenAI API (GPT-4), ChromaDB (embeddings vectoriales)
- **Autenticación:** Firebase Auth
- **Testing:** Vitest (328 tests totales)
- **DevOps:** Docker, Docker Compose

---

## 📁 Estructura Raíz

```
PROYECTO-MASTER-IA/
│
├── 📂 backend/              # API REST + Lógica de Negocio (Clean Architecture)
├── 📂 frontend/             # Aplicación Web Next.js (SSR + CSR)
├── 📂 docs/                 # Documentación Técnica y Memoria TFM
├── 📂 tests/                # Tests de Integración E2E y Performance
│
├── 📄 docker-compose.yml    # Orquestación PostgreSQL + ChromaDB
├── 📄 package.json          # Scripts raíz (workspaces)
├── 📄 README.md             # Documentación Principal
├── 📄 ESTADO_PROYECTO.md    # Estado Actual del Proyecto (Sprints)
├── 📄 PROJECT_CONTEXT.md    # Contexto del Proyecto para Copilot
├── 📄 AI_RULES.md           # Reglas de Desarrollo con IA
└── 📄 .gitignore            # Exclusiones Git
```

**Archivos de Configuración Raíz:**

| Archivo | Propósito |
|---------|-----------|
| `docker-compose.yml` | Define servicios PostgreSQL (puerto 5432) y ChromaDB (puerto 8000) |
| `package.json` | Scripts de monorepo: `dev:backend`, `dev:frontend`, `test:all` |
| `ESTADO_PROYECTO.md` | Tracking de sprints, métricas de tests, estado de funcionalidades |
| `PROJECT_CONTEXT.md` | Contexto arquitectural para GitHub Copilot |
| `AI_RULES.md` | Reglas de clean code, SOLID, TDD, convenciones de commits |

---

## 🔧 Backend

**Ruta:** `backend/`

### Arquitectura Hexagonal (Clean Architecture)

```
backend/
│
├── 📂 src/
│   ├── 📂 domain/                  # Capa de Dominio (Entidades + Reglas de Negocio)
│   │   ├── 📂 entities/            # Entidades de dominio (News, User, Analysis)
│   │   ├── 📂 repositories/        # Interfaces de repositorios (puertos)
│   │   ├── 📂 services/            # Servicios de dominio (IA, embeddings)
│   │   └── 📂 errors/              # Excepciones de dominio
│   │
│   ├── 📂 application/             # Capa de Aplicación (Casos de Uso)
│   │   └── 📂 use-cases/           # Casos de uso (AnalyzeNews, SearchNews, ChatWithNews)
│   │
│   ├── 📂 infrastructure/          # Capa de Infraestructura (Adaptadores)
│   │   ├── 📂 http/                # Controladores REST (Express routes)
│   │   │   ├── 📂 controllers/     # Controllers (news, chat, search, auth)
│   │   │   ├── 📂 middlewares/     # Auth, error handling, logging
│   │   │   └── 📂 routes/          # Definición de rutas API
│   │   │
│   │   ├── 📂 persistence/         # Repositorios (Prisma ORM)
│   │   │   ├── 📂 prisma/          # Implementaciones Prisma
│   │   │   └── 📂 chroma/          # Cliente ChromaDB (embeddings)
│   │   │
│   │   ├── 📂 external/            # Servicios externos (OpenAI, RSS feeds)
│   │   │   ├── openai-client.ts    # Cliente GPT-4 para análisis
│   │   │   ├── rss-fetcher.ts      # Fetcher de feeds RSS
│   │   │   └── metadata-extractor.ts # Extracción de metadatos (Open Graph)
│   │   │
│   │   ├── 📂 config/              # Configuración (env, database, firebase)
│   │   ├── 📂 logger/              # Sistema de logging (Winston)
│   │   └── 📂 monitoring/          # Monitoreo de tokens, métricas
│   │
│   └── 📄 index.ts                 # Entry point del servidor Express
│
├── 📂 prisma/
│   ├── 📄 schema.prisma            # Esquema de base de datos (6 entidades)
│   └── 📂 migrations/              # Migraciones de PostgreSQL
│
├── 📂 scripts/                     # Scripts de utilidad
│   ├── backfill-embeddings.ts      # Regenerar embeddings
│   ├── cleanup-for-reanalysis.ts   # Limpieza de datos para re-análisis
│   ├── test-*.ts                   # Scripts de testing manual
│   └── run-batch-analysis.js       # Análisis batch de noticias
│
├── 📂 tests/                       # Tests unitarios e integración
│   ├── 📂 application/             # Tests de casos de uso
│   └── 📂 integration/             # Tests de integración (DB, API)
│
├── 📄 package.json                 # Dependencias backend
├── 📄 tsconfig.json                # Configuración TypeScript (strict mode)
├── 📄 vitest.config.ts             # Configuración Vitest (206 tests)
├── 📄 .env                         # Variables de entorno (no versionado)
├── 📄 .env.example                 # Template de variables de entorno
└── 📄 service-account.json         # Credenciales Firebase Admin (no versionado)
```

### Entidades Principales (Prisma Schema)

| Entidad | Descripción | Relaciones |
|---------|-------------|------------|
| `User` | Usuario autenticado (Firebase UID) | 1:N con `UserProfile`, `ChatSession`, `SavedArticle` |
| `UserProfile` | Perfil de usuario (preferencias, categorías) | N:1 con `User` |
| `NewsArticle` | Artículo de noticia (URL, título, contenido) | 1:1 con `NewsAnalysis`, 1:N con `Embedding` |
| `NewsAnalysis` | Análisis de IA (sesgo, credibilidad, categorías) | N:1 con `NewsArticle` |
| `ChatSession` | Sesión de chat sobre una noticia | N:1 con `User`, N:1 con `NewsArticle`, 1:N con `ChatMessage` |
| `Embedding` | Vector embedding (ChromaDB) | N:1 con `NewsArticle` |

### API Endpoints Principales

**Base URL:** `http://localhost:3001/api`

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/news/ingest` | Ingerir noticia desde URL o RSS feed |
| `GET` | `/news/:id` | Obtener noticia con análisis completo |
| `GET` | `/news` | Listar noticias con filtros (categoría, fuente) |
| `POST` | `/search` | Búsqueda semántica por embeddings |
| `POST` | `/chat/sessions` | Crear sesión de chat sobre noticia |
| `POST` | `/chat/sessions/:id/messages` | Enviar mensaje en chat |
| `GET` | `/profile` | Obtener perfil de usuario |
| `PUT` | `/profile` | Actualizar preferencias de usuario |
| `POST` | `/saved-articles` | Guardar noticia como favorita |

---

## 🎨 Frontend

**Ruta:** `frontend/`

### Arquitectura de Componentes

```
frontend/
│
├── 📂 app/                         # Next.js App Router (Rutas)
│   ├── 📄 layout.tsx               # Layout raíz (AuthProvider, Toaster)
│   ├── 📄 page.tsx                 # Página principal (Dashboard)
│   ├── 📄 globals.css              # Estilos globales TailwindCSS
│   ├── 📄 actions.ts               # Server Actions (Next.js)
│   │
│   ├── 📂 login/
│   │   └── page.tsx                # Página de login (Firebase Auth)
│   │
│   ├── 📂 news/
│   │   └── [id]/                   # Ruta dinámica /news/:id
│   │       └── page.tsx            # Detalle de noticia + análisis
│   │
│   ├── 📂 search/
│   │   └── page.tsx                # Búsqueda semántica de noticias
│   │
│   └── 📂 profile/
│       └── page.tsx                # Perfil de usuario (refactorizado Sprint 13.4)
│
├── 📂 components/                  # Componentes reutilizables
│   ├── 📂 ui/                      # shadcn/ui primitivos (30+ componentes)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── toast.tsx
│   │   └── ...
│   │
│   ├── 📂 layout/                  # Componentes de layout
│   │   ├── header.tsx              # Header con navegación
│   │   ├── sidebar.tsx             # Sidebar con categorías (283 LOC)
│   │   └── footer.tsx              # Footer
│   │
│   ├── 📂 dashboard/               # Componentes del dashboard
│   │   ├── news-grid.tsx           # Grid de noticias
│   │   ├── category-filter.tsx     # Filtro de categorías
│   │   └── stats-overview.tsx      # Estadísticas de uso
│   │
│   ├── 📂 profile/                 # Componentes de perfil (Sprint 13.4)
│   │   ├── ProfileHeader.tsx       # Avatar, nombre, email, plan
│   │   ├── AccountLevelCard.tsx    # Nivel de cuenta, progreso
│   │   ├── CategoryPreferences.tsx # Selección de categorías preferidas
│   │   ├── UsageStatsCard.tsx      # Estadísticas de uso
│   │   └── index.ts                # Barrel export
│   │
│   ├── 📄 news-card.tsx            # Tarjeta de noticia (230 LOC)
│   ├── 📄 article-image.tsx        # Imagen de artículo con fallback
│   ├── 📄 bias-meter.tsx           # Medidor de sesgo político
│   ├── 📄 reliability-badge.tsx    # Badge de credibilidad
│   ├── 📄 category-pills.tsx       # Pills de categorías
│   ├── 📄 search-bar.tsx           # Barra de búsqueda semántica
│   ├── 📄 news-chat-drawer.tsx     # Drawer de chat sobre noticia
│   ├── 📄 sources-drawer.tsx       # Drawer de fuentes (325 LOC)
│   └── 📄 token-usage-card.tsx     # Card de uso de tokens (208 LOC)
│
├── 📂 hooks/                       # Custom React Hooks (Sprint 13.4)
│   ├── 📄 useProfileAuth.ts        # Auth + redirect si no autenticado
│   ├── 📄 useProfile.ts            # CRUD de perfil (load, save)
│   ├── 📄 useCategoryToggle.ts     # Multi-select de categorías
│   ├── 📄 useRetryWithToast.ts     # Retry strategy con token refresh
│   ├── 📄 useDebounce.ts           # Debounce genérico
│   └── 📄 useLocalStorage.ts       # Persistencia en localStorage
│
├── 📂 lib/                         # Utilidades y API Clients
│   ├── 📄 utils.ts                 # Utilidades generales (cn, formatters)
│   ├── 📄 api.ts                   # Cliente HTTP genérico (fetch wrapper)
│   ├── 📄 profile.api.ts           # API layer de perfil (Sprint 13.4)
│   ├── 📄 firebase.ts              # Configuración Firebase Auth
│   └── 📄 constants.ts             # Constantes de la aplicación
│
├── 📂 context/                     # React Context Providers
│   └── 📄 AuthContext.tsx          # Contexto de autenticación global
│
├── 📂 public/                      # Archivos estáticos
│   ├── logo.svg
│   ├── placeholder-news.jpg
│   └── ...
│
├── 📂 tests/                       # Tests unitarios (Vitest)
│   ├── 📂 components/              # Tests de componentes
│   │   ├── 📂 profile/             # Tests de componentes de perfil (20 tests)
│   │   ├── news-card.spec.tsx
│   │   ├── bias-meter.spec.tsx
│   │   └── ...
│   │
│   ├── 📂 hooks/                   # Tests de hooks (23 tests)
│   │   ├── useProfile.spec.ts
│   │   ├── useProfileAuth.spec.ts
│   │   ├── useCategoryToggle.spec.ts
│   │   ├── useRetryWithToast.spec.ts
│   │   └── ...
│   │
│   └── 📂 lib/                     # Tests de utilidades (8 tests)
│       ├── profile.api.spec.ts
│       └── utils.spec.ts
│
├── 📄 package.json                 # Dependencias frontend
├── 📄 next.config.ts               # Configuración Next.js
├── 📄 tsconfig.json                # Configuración TypeScript
├── 📄 tailwind.config.ts           # Configuración TailwindCSS
├── 📄 postcss.config.mjs           # Configuración PostCSS
├── 📄 components.json              # Configuración shadcn/ui
├── 📄 vitest.config.ts             # Configuración Vitest (122 tests)
├── 📄 .env.local                   # Variables de entorno (no versionado)
└── 📄 .env.local.example           # Template de variables de entorno
```

### Páginas Principales

| Ruta | Componente | Descripción |
|------|------------|-------------|
| `/` | `app/page.tsx` | Dashboard principal con grid de noticias |
| `/login` | `app/login/page.tsx` | Autenticación con Firebase |
| `/news/:id` | `app/news/[id]/page.tsx` | Detalle de noticia con análisis IA |
| `/search` | `app/search/page.tsx` | Búsqueda semántica de noticias |
| `/profile` | `app/profile/page.tsx` | Perfil y preferencias de usuario |

### Variables de Entorno Frontend

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
```

---

## 📚 Documentación

**Ruta:** `docs/`

```
docs/
│
├── 📄 MemoriaTFM.md                       # Memoria Técnica del TFM (documento principal)
├── 📄 DEUDA_TECNICA_SPRINT_13.md          # Análisis de deuda técnica Sprint 13.4
├── 📄 CALIDAD.md                          # Estándares de calidad (100/80/0 coverage)
│
├── 📂 diagrams/                           # Diagramas arquitecturales
│   ├── architecture_hexagonal.md          # Diagrama arquitectura hexagonal
│   ├── database_er.md                     # Diagrama ER de base de datos
│   └── sequence_analysis.md               # Diagrama de secuencia (análisis de noticia)
│
├── 📄 AUDIT.md                            # Auditoría de código y seguridad
├── 📄 TOKEN_USAGE_MONITORING.md           # Monitoreo de consumo de tokens OpenAI
├── 📄 TROUBLESHOOTING_AUTH.md             # Guía de resolución de problemas Auth
│
├── 📄 MEMORIA_TECNICA_SPRINT_2.md         # Memoria Sprint 2 (Backend inicial)
├── 📄 SPRINT_3_CHANGES.md                 # Cambios Sprint 3 (Frontend + Auth)
├── 📄 SPRINT_3_RSS_DIRECTOS.md            # Implementación RSS feeds
├── 📄 TESTS_SPRINT_11_QA.md               # Validación QA Sprint 11
├── 📄 VALIDACION_DASHBOARD_CHAT.md        # Validación dashboard y chat
├── 📄 VALIDACION_RSS_DIRECTOS_FINAL.md    # Validación final RSS
│
├── 📄 REFACTORIZACION_GOOGLE_NEWS_RSS.md  # Refactorización Google News
├── 📄 METADATA_EXTRACTOR_IMPLEMENTATION.md # Implementación extractor metadatos
├── 📄 MEJORA_UI_IMAGENES.md               # Mejoras UI de imágenes
├── 📄 API_INTERCEPTOR.md                  # Implementación interceptor API
├── 📄 INSTRUCCIONES_REANALISIS_MANUAL.md  # Guía de re-análisis manual
│
├── 📄 STRESS_TEST_RESULTS.md              # Resultados tests de estrés
└── 📄 TEST_END_TO_END_GOOGLE_NEWS_RSS.md  # Tests E2E Google News
```

### Documentos Clave

| Documento | Propósito |
|-----------|-----------|
| `MemoriaTFM.md` | Memoria técnica completa del Trabajo Fin de Máster |
| `CALIDAD.md` | Estándares de calidad, cobertura de tests (100/80/0), métricas |
| `DEUDA_TECNICA_SPRINT_13.md` | Análisis de deuda técnica y Plan Mikado ejecutado |
| `diagrams/` | Diagramas arquitecturales (hexagonal, ER, secuencia) |
| `TOKEN_USAGE_MONITORING.md` | Sistema de monitoreo de consumo de API OpenAI |

---

## 🧪 Testing

**Total de Tests:** 328 (100% passing)

### Distribución de Tests

```
tests/
│
├── 📂 performance/                 # Tests de rendimiento (root)
│   ├── stress-test.js              # Test de carga (100 requests concurrentes)
│   └── latency-test.js             # Test de latencia API
│
├── backend/tests/                  # 206 tests backend
│   ├── 📂 application/
│   │   └── use-cases/              # Tests de casos de uso (58 tests)
│   │
│   └── 📂 integration/
│       ├── api/                    # Tests API REST (85 tests)
│       ├── database/               # Tests Prisma (42 tests)
│       └── external/               # Tests servicios externos (21 tests)
│
└── frontend/tests/                 # 122 tests frontend
    ├── 📂 components/              # Tests de componentes (71 tests)
    │   ├── profile/                # 20 tests (Sprint 13.4)
    │   ├── news-card.spec.tsx
    │   ├── bias-meter.spec.tsx
    │   └── ...
    │
    ├── 📂 hooks/                   # Tests de hooks (23 tests)
    │   ├── useProfile.spec.ts      # 7 tests
    │   ├── useProfileAuth.spec.ts  # 4 tests
    │   ├── useCategoryToggle.spec.ts # 7 tests
    │   └── useRetryWithToast.spec.ts # 5 tests
    │
    └── 📂 lib/                     # Tests de utilidades (28 tests)
        ├── profile.api.spec.ts     # 8 tests
        └── utils.spec.ts           # 20 tests
```

### Métricas de Calidad (CALIDAD.md)

| Capa | Cobertura Mínima | Actual |
|------|------------------|--------|
| **Backend - Dominio** | 100% | 100% |
| **Backend - Aplicación** | 100% | 100% |
| **Backend - Infraestructura** | 80% | 95% |
| **Frontend - Componentes** | 80% | 92% |
| **Frontend - Hooks** | 100% | 100% |
| **E2E** | N/A | 15 tests |

### Scripts de Testing

```bash
# Backend
npm run test:backend              # Ejecutar todos los tests backend
npm run test:backend:watch        # Modo watch
npm run test:backend:coverage     # Con cobertura

# Frontend
npm run test:frontend             # Ejecutar todos los tests frontend
npm run test:frontend:watch       # Modo watch
npm run test:frontend:coverage    # Con cobertura

# Global
npm run test:all                  # Todos los tests (backend + frontend)
```

---

## ⚙️ Configuración y Utilidades

### Docker Compose

**Archivo:** `docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:15
    ports: 5432:5432
    volumes: ./postgres-data
    
  chromadb:
    image: chromadb/chroma:latest
    ports: 8000:8000
    volumes: ./chroma-data
```

**Servicios:**
- **PostgreSQL:** Base de datos principal (Prisma ORM)
- **ChromaDB:** Base de datos vectorial (embeddings)

### Scripts de Utilidad

**Backend (`backend/scripts/`):**

| Script | Propósito |
|--------|-----------|
| `backfill-embeddings.ts` | Regenerar embeddings de noticias existentes |
| `cleanup-for-reanalysis.ts` | Limpiar análisis para volver a procesar |
| `run-batch-analysis.js` | Análisis batch de múltiples noticias |
| `test-embedding-flow.ts` | Validar flujo de embeddings end-to-end |
| `test-firebase-auth.ts` | Probar autenticación Firebase |
| `test-search-endpoint.ts` | Validar búsqueda semántica |

### Variables de Entorno

**Backend (`.env`):**
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/verity_news
OPENAI_API_KEY=sk-...
FIREBASE_PROJECT_ID=...
CHROMA_URL=http://localhost:8000
PORT=3001
NODE_ENV=development
```

**Frontend (`.env.local`):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
```

---

## 📊 Métricas del Proyecto

### Estadísticas de Código

| Métrica | Backend | Frontend | Total |
|---------|---------|----------|-------|
| **Archivos TypeScript** | 147 | 89 | 236 |
| **Líneas de Código** | ~18,500 | ~12,300 | ~30,800 |
| **Componentes React** | - | 68 | 68 |
| **Custom Hooks** | - | 12 | 12 |
| **API Endpoints** | 23 | - | 23 |
| **Entidades de Dominio** | 8 | - | 8 |
| **Tests Unitarios** | 206 | 122 | 328 |
| **Cobertura Global** | 97% | 92% | 95% |

### Refactorizaciones Principales

| Sprint | Archivo | LOC Antes | LOC Después | Reducción |
|--------|---------|-----------|-------------|-----------|
| 13.4 | `profile/page.tsx` | 468 | 166 | -64.5% |
| 12.3 | `news-card.tsx` | 387 | 230 | -40.6% |
| 11.2 | `sidebar.tsx` | 412 | 283 | -31.3% |

---

## 🚀 Comandos Principales

### Desarrollo

```bash
# Iniciar base de datos
docker-compose up -d

# Backend
cd backend
npm install
npm run dev                 # Puerto 3001

# Frontend
cd frontend
npm install
npm run dev                 # Puerto 3000
```

### Testing

```bash
# Backend
npm run test:backend
npm run test:backend:coverage

# Frontend
npm run test:frontend
npm run test:frontend:coverage

# Todos
npm run test:all
```

### Build y Deploy

```bash
# Backend
npm run build               # Compila TypeScript a dist/
npm run start               # Producción

# Frontend
npm run build               # Build Next.js
npm run start               # Servidor producción
```

### Database

```bash
# Migraciones
npx prisma migrate dev      # Crear migración
npx prisma migrate deploy   # Aplicar en producción

# Utilidades
npx prisma studio           # GUI de base de datos
npx prisma generate         # Regenerar cliente Prisma
```

---

## 📝 Notas Adicionales

### Principios Arquitecturales

1. **Clean Architecture:** Separación estricta en capas (domain, application, infrastructure)
2. **SOLID Principles:** Aplicados en toda la codebase
3. **DRY (Don't Repeat Yourself):** Componentes y hooks reutilizables
4. **TDD (Test-Driven Development):** Tests antes de implementación
5. **Mikado Method:** Refactorizaciones incrementales con validación

### Convenciones de Código

- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`)
- **TypeScript:** Modo strict habilitado
- **Linting:** ESLint + Prettier
- **Naming:** camelCase (variables), PascalCase (componentes), kebab-case (archivos)
- **Max LOC por archivo:** 250 líneas (recomendación)

### Próximos Pasos

- [ ] Refactorizar `prisma-news-article.repository.ts` (441 LOC)
- [ ] Implementar ESLint rule `max-lines: 250`
- [ ] Añadir pre-commit hook para detectar archivos >300 LOC
- [ ] Aumentar cobertura E2E a 25 tests
- [ ] Implementar CI/CD con GitHub Actions

---

**Documento generado:** 4 de febrero de 2026  
**Versión:** 1.0  
**Autor:** GitHub Copilot + David López  
**Proyecto:** Verity-News - Sistema de Análisis de Credibilidad de Noticias con IA
