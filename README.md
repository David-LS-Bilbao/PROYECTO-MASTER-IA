# 🗞️ Verity News - Plataforma Inteligente de Análisis de Credibilidad de Noticias

> **Trabajo Final de Máster** - Máster en Desarrollo con Inteligencia Artificial
> **Autor**: David López Sánchez
> **Institución**: BIG School
> **Fecha**: Febrero 2026

[![Status](https://img.shields.io/badge/status-en%20producci%C3%B3n-success)](https://verity-news.vercel.app)
[![Tests](https://img.shields.io/badge/tests-328%20passing-brightgreen)](#testing)
[![Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen)](#testing)
[![Architecture](https://img.shields.io/badge/architecture-clean%20hexagonal-blue)](#arquitectura-del-proyecto)

---

## 📋 Tabla de Contenidos

1. [Descripción General](#descripción-general-del-proyecto)
2. [Stack Tecnológico](#stack-tecnológico)
3. [Instalación y Ejecución](#instalación-y-ejecución)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Funcionalidades Principales](#funcionalidades-principales)
6. [Cómo interpretar el análisis de Verity AI](#interpretacion-analisis-verity-ai)
7. [Arquitectura](#arquitectura-del-proyecto)
8. [Testing](#testing)
9. [Deployment](#deployment)
10. [DevOps & Infrastructure](#devops--infrastructure)
11. [Media Bias Atlas](#-subproyecto-paralelo-media-bias-atlas)
12. [Documentación Técnica](#documentación-técnica)

---

## Actualizacion Pre-Merge (2026-02-17)

Esta seccion resume los comandos y comportamientos vigentes del feature de analisis antes de merge a `main`.

### Como Ejecutar Local (Actualizado)

1. Iniciar servicios base:
```bash
docker compose up -d
```
- PostgreSQL corre en el contenedor `verity-news-postgres` con imagen `pgvector/pgvector:pg16`.
- En local se expone en `localhost:5433` para Verity y en `localhost:5432` por compatibilidad con Media Bias Atlas; ambos puertos apuntan al mismo contenedor.
- `chromadb` sigue definido en `docker-compose.yml` por compatibilidad legacy, pero el backend activo usa `pgvector` (`PgVectorClient`).

2. Preparar backend:
```bash
cd backend
npm install
npx prisma migrate deploy
npm run typecheck
npm run dev
```

3. Preparar frontend:
```bash
cd frontend
npm install
npx tsc --noEmit
npm run dev
```

4. URLs locales:
- Frontend: `http://localhost:3001`
- Backend: `http://localhost:3000`
- Launcher MBA desde el sidebar de Verity:
  - variable recomendada: `NEXT_PUBLIC_MEDIA_BIAS_ATLAS_URL`
  - ejemplo local: `NEXT_PUBLIC_MEDIA_BIAS_ATLAS_URL=http://localhost:3004`
  - si no se define, el sidebar usa como fallback el frontend standalone de MBA en `http://localhost:3004`
- Acceso directo a observabilidad desde perfil:
  - el antiguo bloque local de “Uso de Tokens” se ha reconvertido en CTA a `AI Observer`
  - ruta interna usada: `/admin/ai-usage`

### Testing (Actualizado)

Comandos vigentes en esta rama:

```bash
# Backend (tipado, tests, cobertura)
cd backend
npm run typecheck
npx vitest run
npm run test:coverage

# Frontend (tipado, unit, e2e)
cd frontend
npx tsc --noEmit
npm run test:run
npm run test:e2e:smoke
npm run test:e2e
```

Referencias:
- Estandar QA: `docs/CALIDAD.md`
- E2E: `frontend/tests/e2e/README.md`
- Pre-merge Render/Prisma (incidentes reales): `docs/incidents/PRE_MERGE_PLAYBOOK_RENDER_PRISMA.md`

### Limitaciones (Paywall y Calidad de Texto)

- Si un articulo queda en `accessStatus=PAYWALLED|RESTRICTED` o `analysisBlocked=true`, el backend bloquea SIEMPRE el analisis (standard y deep), incluso si existe cache legacy.
- El bloqueo responde `422` con `error.code="PAYWALL_BLOCKED"`.
- Si no hay texto completo y solo hay snippet, el analisis se marca como estimado con menor confianza.
- Verity no intenta bypass de paywall.

### Troubleshooting Rapido

#### Error 422 `PAYWALL_BLOCKED`
- Causa: articulo detectado como de suscripcion/restringido.
- Resultado esperado: no se ejecuta analisis y la UI muestra mensaje de bloqueo.

#### Error `No se pudo procesar el formato del analisis. Reintenta.`
- Causa: salida LLM no parseable incluso tras 1 intento de JSON repair.
- Resultado esperado: `formatError=true`, UI muestra estado de error y oculta secciones deep.

#### Error `External service error: Gemini` o `JinaReader`
- Revisar credenciales locales (sin exponerlas), conectividad y limites del proveedor.
- Reintentar cuando el servicio externo se estabilice.

#### Error `extension "vector" is not available`
- Verificar que el contenedor usa `pgvector/pgvector:pg16`.
- Si el contenedor fue creado antes del cambio a `pgvector`, recrearlo:
```bash
docker compose up -d --force-recreate postgres
```
- Reaplicar migraciones:
```bash
cd backend
npx prisma migrate deploy
```

#### Hydration mismatch en localhost
- Si aparece `data-darkreader-inline-stroke`, desactivar Dark Reader en `localhost`.

---

## Cierre Feature Observabilidad IA (2026-03-24)

Esta rama deja cerrada la observabilidad IA comun entre Verity News y Media Bias Atlas para uso local real, sin depender ya de validaciones teoricas.

### Estado final validado

- Verity backend operativo con observabilidad IA y migraciones alineadas.
- Media Bias Atlas backend operativo con observabilidad IA aplicada tambien en su base de test.
- UI admin interna de Verity disponible en `/admin/ai-usage` con datos agregados reales de:
  - `verity`
  - `media-bias-atlas`
- endpoints admin de MBA validados:
  - `GET /api/admin/ai-usage/overview`
  - `GET /api/admin/ai-usage/runs`
  - `GET /api/admin/ai-usage/prompts`
  - `GET /api/admin/ai-usage/compare`
- persistencia real confirmada en `ai_operation_runs` con:
  - `provider`
  - `model`
  - `tokens`
  - `estimatedCostMicrosEur`
  - `latencyMs`
  - `status`

### Setup local relevante para esta feature

- PostgreSQL local con `pgvector` en el mismo contenedor:
  - `localhost:5433` para Verity
  - `localhost:5432` para compatibilidad con Media Bias Atlas
- Verity backend: `http://localhost:3000`
- Media Bias Atlas backend: `http://localhost:3001`
- Verity frontend / UI admin: `http://localhost:3002`

### Quality gate ejecutado

- `backend`: `69` archivos / `720` tests OK
- `media-bias-atlas/backend`: `15` archivos / `48` tests OK
- la UI `/admin/ai-usage` se ha validado manualmente en local con ambas fuentes disponibles
- el formateo de microcostes pequenos en la tabla ya no pierde precision visual

### Alcance realmente cerrado

- Fase 1: cerrada
- Fase 2: cerrada para el alcance validado en Verity
- Fase 3: cerrada operativamente en Media Bias Atlas
- Fase 4: cerrada operativamente en local desde la UI admin de Verity

### Pendiente menor no bloqueante

- si se quiere cierre estricto total del plan, falta validar con ejecucion real el provider `openai-compatible` de MBA o documentarlo explicitamente fuera del alcance actual.

---

## 📖 Descripción General del Proyecto

### Contexto y Motivación

En la era de la desinformación digital, donde las fake news y los sesgos informativos proliferan en redes sociales y medios digitales, surge la necesidad de herramientas que ayuden a los ciudadanos a evaluar críticamente la información que consumen. **Verity News** nace como respuesta a este problema, aplicando técnicas de Inteligencia Artificial para democratizar el análisis de credibilidad periodística.

### ¿Qué es Verity News?

Verity News es una **plataforma web full-stack** que combina ingesta automatizada de noticias españolas, análisis de credibilidad mediante Large Language Models (LLMs), y búsqueda semántica avanzada para proporcionar a los usuarios una herramienta inteligente de verificación periodística.

### Objetivos del TFM

Este proyecto demuestra la aplicación práctica de los conocimientos adquiridos en el Máster en Desarrollo con IA:

1. **Integración de IA en producción**: Uso de modelos de lenguaje (Gemini 2.0 Flash) para análisis de sesgo político, detección de clickbait y evaluación de confiabilidad
2. **Arquitectura enterprise**: Implementación de Clean Architecture (Hexagonal) con SOLID, TDD y patrones de diseño avanzados
3. **RAG (Retrieval-Augmented Generation)**: Sistema de chat conversacional con recuperación de contexto mediante búsqueda vectorial
4. **Ingeniería de prompts**: Optimización de prompts para análisis explicable (XAI) con citaciones y razonamiento interno
5. **Desarrollo asistido por IA**: Documentación completa del uso de GitHub Copilot y Claude durante el desarrollo

### Valor Añadido

- **Análisis explicable (XAI)**: Cada evaluación incluye razonamiento interno visible para el usuario
- **Múltiples perspectivas**: Agregación de 8+ fuentes españolas (El País, El Mundo, 20 Minutos, Europa Press, etc.)
- **Privacidad first**: Análisis por usuario con sistema de favorites y análisis desbloqueados
- **Búsqueda inteligente**: Motor de búsqueda semántico basado en embeddings vectoriales
- **Freemium sostenible**: Modelo de negocio con cuotas gratuitas y suscripción premium

---

## 🛠️ Stack Tecnológico

### Frontend

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **Next.js** | 16.x | Framework React con SSR, App Router y optimizaciones Turbopack |
| **React** | 19.x | Biblioteca UI con Server Components y Concurrent Features |
| **TypeScript** | 5.x | Type safety en toda la aplicación frontend |
| **Tailwind CSS** | 3.x | Utility-first CSS framework para diseño responsivo |
| **shadcn/ui** | Latest | Biblioteca de componentes accesibles (Radix UI + Tailwind) |
| **React Query** | 5.x | Server state management con cache inteligente y sincronización |
| **React Hook Form** | Latest | Gestión de formularios performante con validación |
| **Zod** | Latest | Schema validation en runtime para formularios y API responses |
| **Vitest** | Latest | Test runner ultrarrápido compatible con Vite |
| **React Testing Library** | Latest | Testing de componentes siguiendo buenas prácticas |

### Backend

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **Node.js** | 20 LTS | Runtime JavaScript con soporte ESM y performance optimizada |
| **Express** | 5.x | Framework web minimalista para API REST |
| **TypeScript** | 5.x | Type safety en modo strict para prevención de bugs |
| **Prisma** | Latest | ORM type-safe con migrations, schema validation y optimización de queries |
| **PostgreSQL** | 17 | Base de datos relacional con pgvector extension |
| **pgvector** | Latest | Extensión PostgreSQL para búsqueda vectorial (embeddings) |
| **Pino** | Latest | Logger estructurado de alto rendimiento |
| **Helmet** | Latest | Middleware de seguridad para Express (CSP, XSS, etc.) |
| **Zod** | Latest | Schema validation para request/response |
| **Vitest** | Latest | Test runner con soporte para TDD y mocking |

### Inteligencia Artificial

| Servicio/Biblioteca | Propósito |
|---------------------|-----------|
| **Google Gemini 2.0 Flash** | LLM principal para análisis de sesgo, categorización y chat |
| **Gemini Embeddings** | Generación de embeddings de 768 dimensiones para búsqueda semántica |
| **pgvector** | Almacenamiento y búsqueda de vectores con índice HNSW |
| **RAG (Retrieval-Augmented Generation)** | Sistema de chat con contexto recuperado de base vectorial |
| **Prompt Engineering** | Prompts optimizados para XAI, zero hallucination y evidence-based scoring |

### Infraestructura y DevOps

| Tecnología | Propósito |
|------------|-----------|
| **Docker** | Containerización de PostgreSQL y servicios auxiliares |
| **Docker Compose** | Orquestación de servicios en desarrollo |
| **GitHub Actions** | CI/CD para tests automáticos y quality checks |
| **Vercel** | Hosting del frontend con CDN global y edge functions |
| **Render** | Hosting del backend con auto-deploys desde GitHub |
| **Neon Serverless** | PostgreSQL gestionado con pgvector pre-instalado |
| **Firebase Auth** | Autenticación de usuarios con JWT y Admin SDK |
| **Sentry** | Observabilidad, error tracking y performance monitoring |
| **ESLint + Prettier** | Linting y formateo de código automático |
| **Husky** | Git hooks para quality checks en pre-commit |

### Fuentes de Datos

- **RSS Parser**: Ingesta directa de feeds RSS (El País, El Mundo, 20 Minutos, Europa Press)
- **Google News RSS**: Fallback para categorías vacías y noticias locales geolocalizadas
- **Jina Reader API**: Extracción de metadatos Open Graph (og:image, og:description)

---

## 🚀 Instalación y Ejecución

### Prerrequisitos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js** 20+ (LTS recomendado) - [Descargar](https://nodejs.org/)
- **npm** 9+ o **pnpm** 8+
- **Docker** y **Docker Compose** - [Descargar Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Git** para clonar el repositorio

### Cuentas API Necesarias (Gratis)

1. **Firebase** (Autenticación):
   - Crear proyecto en [Firebase Console](https://console.firebase.google.com/)
   - Habilitar "Authentication" → "Email/Password"
   - Descargar `serviceAccountKey.json` desde "Project Settings" → "Service Accounts"

2. **Google AI Studio** (Gemini API):
   - Obtener API key en [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Plan gratuito: 15 requests/minuto, 1M tokens/día

3. **Jina AI** (Extracción de metadatos - Opcional):
   - Registrarse en [Jina AI](https://jina.ai/)
   - Obtener API key gratuita

### Paso 1: Clonar el Repositorio

```bash
git clone https://github.com/David-LS-Bilbao/PROYECTO-MASTER-IA.git
cd PROYECTO-MASTER-IA/Verity-News
```

### Paso 2: Configurar Variables de Entorno

#### Backend (`backend/.env`)

```bash
cd backend
cp .env.example .env
```

Edita `backend/.env` con tus credenciales:

```env
# Server
PORT=3000
NODE_ENV=development

# CORS (separar múltiples orígenes con comas)
CORS_ORIGIN=http://localhost:5173,http://localhost:3001

# Cron + Promo Codes
CRON_SECRET=tu_secreto_seguro_aqui
PROMO_CODES=VERITY_ADMIN,TEST_CODE

# Database (PostgreSQL con pgvector)
DATABASE_URL=postgresql://admin:adminpassword@localhost:5433/verity_news

# Gemini API
GEMINI_API_KEY=tu_api_key_de_gemini

# Jina API (Opcional)
JINA_API_KEY=tu_api_key_de_jina

# Firebase Admin SDK
FIREBASE_PROJECT_ID=tu-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nTU_PRIVATE_KEY_AQUI\n-----END PRIVATE KEY-----\n"

# Sentry (Opcional - para observabilidad)
SENTRY_DSN=https://tu-sentry-dsn@sentry.io/proyecto
SENTRY_ENVIRONMENT=development
SENTRY_TRACES_SAMPLE_RATE=1.0
```

#### Frontend (`frontend/.env.local`)

```bash
cd ../frontend
cp .env.local.example .env.local
```

Edita `frontend/.env.local`:

```env
# API Backend
NEXT_PUBLIC_API_URL=http://localhost:3000

# Cron Secret (igual que backend)
NEXT_PUBLIC_CRON_SECRET=tu_secreto_seguro_aqui

# Firebase Client SDK
NEXT_PUBLIC_FIREBASE_API_KEY=tu_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Google AdSense (Opcional)
NEXT_PUBLIC_ENABLE_ADSENSE=false
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxxxxxxxx
```

Nota:
- `frontend/.env.local.example` ya incluye la configuración pública actual de Firebase Client SDK usada por Verity.
- Estas variables `NEXT_PUBLIC_FIREBASE_*` son públicas del cliente web y no sustituyen a las credenciales privadas `FIREBASE_*` del backend.
- Para login local con Google, el backend de Verity necesita además `FIREBASE_*` o un `backend/service-account.json` válido del proyecto Firebase.

### Paso 3: Levantar Servicios con Docker

```bash
# Desde la raiz del proyecto Verity-News/
docker compose up -d
```

Esto iniciara:
- **PostgreSQL + pgvector** en el contenedor `verity-news-postgres`
- **Puerto recomendado para Verity**: `localhost:5433`
- **Puerto conservado por compatibilidad con MBA**: `localhost:5432`
- **Redis** en `localhost:6379`
- **ChromaDB** como servicio legacy opcional (no requerido para el flujo principal con `pgvector`)

Verifica que los servicios esten corriendo:

```bash
docker ps
# Deberias ver: verity-news-postgres (pgvector/pgvector:pg16)
```

### Paso 4: Instalar Dependencias

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Paso 5: Ejecutar Migraciones de Base de Datos

```bash
cd backend

# Ejecutar migraciones
npx prisma migrate deploy

# Generar Prisma Client
npx prisma generate
```

### Paso 6: Iniciar Aplicación en Desarrollo

Abre **dos terminales**:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

Verás:
```
✅ PrismaClient inicializado
✅ pgvector extension initialized
✅ Database connected
🚀 Verity News API running on http://localhost:3000
📋 Health check: http://localhost:3000/api/health/check
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Verás:
```
▲ Next.js 16.0.0
- Local:        http://localhost:3001
- Network:      http://192.168.1.x:3001
✓ Ready in 2.5s
```

### Paso 7: Acceder a la Aplicación

Abre tu navegador en:

```
http://localhost:3001
```

### Verificar Instalación

**Backend Health Check:**
```bash
# Liveness probe
curl http://localhost:3000/api/health/check

# Readiness probe (verifica DB)
curl http://localhost:3000/api/health/readiness
```

**Base de Datos:**
```bash
cd backend
npx prisma studio
# Abre interfaz visual en http://localhost:5555
```

### Troubleshooting

#### Error: "Cannot connect to PostgreSQL"

```bash
# Verifica que Docker este corriendo
docker ps

# Levanta/rehidrata servicios sin borrar volumenes
docker compose up -d

# Verifica contenedor y puerto mapeado
docker ps | findstr verity-news-postgres
```

#### Error: "Firebase Admin initialization failed"

Asegúrate de:
1. Haber descargado `serviceAccountKey.json` de Firebase Console
2. Copiar el archivo a `backend/`
3. O configurar las variables de entorno `FIREBASE_*` correctamente

#### Error: "Gemini API key invalid"

Verifica que:
1. La API key sea válida en [Google AI Studio](https://aistudio.google.com/app/apikey)
2. No haya espacios o saltos de línea en el `.env`

---

## 📁 Estructura del Proyecto

El proyecto sigue una arquitectura monorepo con separación clara entre frontend, backend y documentación:

```
Verity-News/
├── frontend/                       # Aplicación Next.js (SSR + CSR)
│   ├── app/                        # Next.js App Router (pages)
│   │   ├── (auth)/
│   │   │   └── login/              # Página de autenticación
│   │   ├── news/
│   │   │   └── [id]/               # Detalle de noticia (dynamic route)
│   │   ├── search/                 # Búsqueda semántica
│   │   ├── profile/                # Perfil de usuario
│   │   ├── legal/                  # Páginas legales (privacidad, términos)
│   │   ├── layout.tsx              # Root layout con providers
│   │   └── page.tsx                # Dashboard principal (/)
│   ├── components/                 # Componentes React reutilizables
│   │   ├── ui/                     # Componentes shadcn/ui (30+)
│   │   ├── layout/                 # Header, Sidebar, Footer
│   │   ├── dashboard/              # NewsCard, CategoryFilter, etc.
│   │   └── profile/                # ProfileForm, SubscriptionCard, etc.
│   ├── hooks/                      # Custom React Hooks (12 hooks)
│   │   ├── useNews.ts              # Fetch noticias con React Query
│   │   ├── useAuth.ts              # Firebase auth state
│   │   └── useProfile.ts           # User profile management
│   ├── lib/                        # Utilidades y configuración
│   │   ├── api.ts                  # Axios client con interceptors
│   │   ├── firebase.ts             # Firebase SDK config
│   │   └── utils.ts                # Helper functions
│   ├── context/                    # React Context providers
│   │   └── AuthContext.tsx         # Auth state global
│   ├── tests/                      # Tests Vitest + RTL (122 tests)
│   │   ├── components/             # Tests de componentes
│   │   ├── hooks/                  # Tests de hooks
│   │   └── utils/                  # Tests de utilidades
│   └── package.json                # Dependencias frontend
│
├── backend/                        # API REST Node.js + Express
│   ├── src/
│   │   ├── domain/                 # Capa de Dominio (Clean Architecture)
│   │   │   ├── entities/           # Entidades de dominio
│   │   │   │   ├── NewsArticle.ts  # Entidad NewsArticle con lógica
│   │   │   │   ├── User.ts         # Entidad User
│   │   │   │   └── Analysis.ts     # Value Object para análisis
│   │   │   ├── repositories/       # Interfaces de repositorios (puertos)
│   │   │   │   ├── news-article.repository.ts
│   │   │   │   └── user.repository.ts
│   │   │   └── services/           # Servicios de dominio (interfaces)
│   │   │       ├── gemini-client.interface.ts
│   │   │       └── vector-client.interface.ts
│   │   ├── application/            # Capa de Aplicación (casos de uso)
│   │   │   └── use-cases/
│   │   │       ├── ingest-news.usecase.ts
│   │   │       ├── analyze-article.usecase.ts
│   │   │       ├── search-news.usecase.ts
│   │   │       ├── chat-article.usecase.ts
│   │   │       └── chat-general.usecase.ts
│   │   ├── infrastructure/         # Capa de Infraestructura (adaptadores)
│   │   │   ├── http/               # Controllers + Routes + Middlewares
│   │   │   │   ├── controllers/    # NewsController, ChatController, etc.
│   │   │   │   ├── routes/         # Express routers
│   │   │   │   └── middlewares/    # authenticate, errorHandler, etc.
│   │   │   ├── persistence/        # Implementaciones de repositorios
│   │   │   │   └── prisma-news-article.repository.ts
│   │   │   ├── external/           # Clientes externos
│   │   │   │   ├── gemini.client.ts
│   │   │   │   ├── pgvector.client.ts
│   │   │   │   ├── direct-spanish-rss.client.ts
│   │   │   │   ├── google-news-rss.client.ts
│   │   │   │   └── prompts/        # Prompts optimizados para Gemini
│   │   │   ├── config/             # Configuración e inyección de dependencias
│   │   │   │   └── dependencies.ts # DI Container singleton
│   │   │   ├── logger/             # Pino logger estructurado
│   │   │   └── monitoring/         # Health probes, metrics
│   │   └── index.ts                # Entry point de la aplicación
│   ├── prisma/
│   │   ├── schema.prisma           # Esquema de BD (7 modelos)
│   │   └── migrations/             # Migraciones SQL versionadas
│   ├── tests/                      # Tests Vitest (206 tests)
│   │   ├── use-cases/              # Tests de casos de uso (TDD)
│   │   ├── controllers/            # Tests de API REST
│   │   ├── repositories/           # Tests de persistencia
│   │   └── external/               # Tests de servicios externos
│   ├── scripts/                    # Scripts de utilidad
│   │   ├── verify-analysis-rules.ts
│   │   └── test-search-endpoint.ts
│   └── package.json                # Dependencias backend
│
├── docs/                           # Documentación técnica del proyecto
│   ├── MemoriaTFM.md               # Memoria académica del TFM
│   ├── ESTRUCTURA_PROYECTO.md      # Mapa completo del proyecto
│   ├── CALIDAD.md                  # Estándares de calidad y coverage
│   ├── diagrams/                   # Diagramas arquitecturales
│   │   ├── architecture_hexagonal.md
│   │   ├── database_er.md
│   │   └── sequence_analysis.md
│   ├── architecture/               # Diseño técnico e integraciones core
│   ├── incidents/                  # Incidencias, fixes y validaciones
│   ├── runbooks/                   # Guías operativas/manuales
│   ├── audits/                     # Auditorías técnicas y de seguridad
│   ├── archive/                    # Backups e histórico
│   └── sprints/                    # Documentación de sprints (27+)
│       ├── Sprint-27.3-Production-Responsive-Hotfixes.md
│       ├── Sprint-27-ENTREGABLES.md
│       └── [20+ documentos de sprints]
│
├── tests/
│   └── performance/                # Tests de carga con k6
│       ├── stress-test.js          # 100 requests concurrentes
│       └── latency-test.js         # Medición de p95, p99
│
├── docker-compose.yml              # Orquestación de PostgreSQL
├── docs/ESTADO_PROYECTO.md         # Estado actual y progreso (Sprint 27.3)
├── docs/PROJECT_CONTEXT.md         # Contexto para GitHub Copilot
├── docs/AI_RULES.md                # Reglas de desarrollo asistido por IA
└── README.md                       # Este archivo
```

### Arquitectura de Capas (Clean Architecture)

El backend implementa **arquitectura hexagonal** (ports & adapters) con 3 capas:

1. **Domain** (Núcleo):
   - Entities: `NewsArticle`, `User`, `Analysis`
   - Repository Interfaces (puertos)
   - Service Interfaces (puertos)
   - **Regla**: Sin dependencias externas, solo lógica de negocio pura

2. **Application** (Casos de Uso):
   - Use Cases: Orquestación de lógica de negocio
   - **Regla**: Depende solo de Domain, no de Infrastructure

3. **Infrastructure** (Adaptadores):
   - Controllers: Express HTTP handlers
   - Repositories: Implementaciones con Prisma
   - External Services: Gemini, RSS, pgvector
   - **Regla**: Implementa interfaces de Domain

### Patrones de Diseño Aplicados

- **Dependency Injection**: Container singleton en `dependencies.ts`
- **Repository Pattern**: Abstracción de persistencia
- **Factory Pattern**: Reconstitución de entidades con `NewsArticle.reconstitute()`
- **Strategy Pattern**: Múltiples clientes RSS intercambiables
- **Adapter Pattern**: GeminiClient adapta API de Google a interfaz interna

---

## ⚡ Funcionalidades Principales

### 1. Ingesta Automática de Noticias

**Descripción**: Sistema de ingesta multi-fuente que recopila noticias españolas desde 58+ medios verificados con actualización automática y manual.

**Características**:
- **RSS Parser Directo**: Parseo de feeds RSS nativos (más rápido y confiable)
- **Fuentes**: El País, El Mundo, 20 Minutos, Europa Press, Xataka, etc.
- **8 Categorías Unificadas**: España, Internacional, Local, Economía, Ciencia-Tecnología, Entretenimiento, Deportes, Salud
- **Smart TTL**: Chequeo de 1 hora antes de re-ingestar para ahorrar cuota de API
- **Auto-fill Inteligente**: Detecta categorías vacías y dispara ingesta automática
- **Geolocalización**: Noticias locales basadas en `User.location` (Sprint 20)
- **Fallback a Google News**: Si RSS directos fallan, usa Google News RSS como backup
- **🆕 Sprint 35 - Auto-Refresh System**:
  - **Endpoint Público**: `/api/ingest/trigger` sin necesidad de CRON_SECRET (rate-limited 1 req/5min)
  - **Botón Manual**: Refresh button en header y sidebar para actualización manual
  - **Auto-Trigger**: Middleware que dispara ingesta automática tras 1h de inactividad
  - **Session Detection**: Hook que detecta entrada/reanudación de sesión y actualiza contenido
  - **Fire-and-Forget**: Patrón no-bloqueante para no afectar rendimiento de requests

**Tecnología**:
- RSS Parser para parseo de XML
- Jina Reader API para extracción de metadatos Open Graph (og:image, og:description)
- Exponential backoff para retry en fallos de red
- Express Rate Limiter para protección contra abuso (3 capas: endpoint, middleware, cliente)
- IngestMetadata tracker para control de TTL global

**Beneficio**: Los usuarios siempre ven noticias frescas sin necesidad de refrescar manualmente, con opción de actualización manual instantánea.

---

### 2. Análisis de Credibilidad con IA

**Descripción**: Cada noticia es analizada por Gemini 2.0 Flash para evaluar sesgo político, confiabilidad y detectar clickbait.

**Métricas Generadas**:

| Métrica | Escala | Descripción |
|---------|--------|-------------|
| **Reliability Score** | 0-100 | Confiabilidad basada en citas a fuentes verificables |
| **Bias Score** | -100 a +100 | Sesgo político (-100: izquierda, 0: neutral, +100: derecha) |
| **Clickbait Detection** | Boolean | ¿El titular es sensacionalista? |
| **Summary** | String | Resumen objetivo de 2-3 frases |
| **Internal Reasoning** | String | Razonamiento interno del LLM (XAI) |

**Prompt Engineering (Sprint 25 - Evidence-Based Scoring)**:

```typescript
// Reglas estrictas para ReliabilityScore:
// < 40: Clickbait, opinión sin datos, lenguaje incendiario
// 40-60: Noticia estándar sin citas externas claras
// 60-80: Fuentes genéricas ('según expertos')
// > 80: SOLO con citas directas a organismos oficiales, estudios científicos o enlaces verificables
```

**XAI (Explainable AI)**:
- Cada análisis incluye `internalReasoning` visible para el usuario
- 3 preguntas obligatorias: fuentes verificables, lenguaje emocional, datos fácticos
- Citaciones forzadas en formato `[1][2]` para trazabilidad

**Beneficio**: Los usuarios pueden tomar decisiones informadas sobre la credibilidad de cada noticia antes de compartirla.

---

### 3. Búsqueda Semántica con Embeddings

**Descripción**: Motor de búsqueda que entiende el significado de las consultas, no solo palabras clave.

**Arquitectura de Búsqueda (Waterfall - 3 Niveles)**:

```
LEVEL 1: Full-Text Search (PostgreSQL nativo)
  ↓ (si 0 resultados)
LEVEL 2: Semantic Search (pgvector + Gemini Embeddings)
  ↓ (si 0 resultados)
LEVEL 3: Reactive Ingestion (trigger ingesta y re-query)
```

**Tecnología**:
- **pgvector**: Extensión PostgreSQL para almacenar vectores (768 dimensiones)
- **Gemini Embeddings**: Generación de embeddings semánticos
- **Índice HNSW**: Búsqueda de vecinos más cercanos con cosine distance
- **Raw SQL**: Queries optimizadas con operador `<=>` para similaridad

**Ejemplo**:
- Query: "fraude electoral"
- Resultados: Encuentra noticias sobre "manipulación de votos", "irregularidades en urnas", etc.

**Beneficio**: Búsquedas más inteligentes que encuentran noticias relevantes aunque no contengan exactamente las palabras buscadas.

---

### 4. Chat Conversacional con RAG

**Descripción**: Sistema de chat inteligente con dos modos:

#### 4.1. Chat de Artículo (RAG Estricto)

**Propósito**: Hacer preguntas específicas sobre UN artículo concreto.

**Funcionamiento**:
1. Usuario abre noticia y hace pregunta ("¿Qué dice sobre el presupuesto?")
2. Sistema recupera fragmentos relevantes del artículo desde pgvector
3. Gemini responde SOLO basándose en el contenido del artículo
4. Respuesta incluye citaciones `[1][2]` para trazabilidad

**Prompt Strategy**: Zero Hallucination
- Prohibición estricta de usar conocimiento general
- Cada frase debe estar citada o eliminarse
- Respuesta por defecto: "El contexto no contiene datos suficientes..."

#### 4.2. Chat General (Knowledge-First)

**Propósito**: Preguntas abiertas de conocimiento general.

**Funcionamiento**:
- Acceso completo al conocimiento de Gemini
- NO usa RAG ni búsqueda vectorial (más eficiente)
- Respuestas de hasta 200 palabras en español
- Estilo conversacional y profesional

**Ejemplo**:
- Query: "¿Quién es el alcalde de Móstoles?"
- Respuesta: Información actualizada del LLM sin restricciones

**🔒 Restricción PREMIUM (Sprint 30)**:
- Chat endpoints requieren autenticación
- **FREE**: 7 días de prueba desde el registro → Bloqueado después
- **PREMIUM**: Acceso completo ilimitado
- UI muestra CTA "Actualizar a Premium" cuando trial expira

**Beneficio**: Los usuarios pueden verificar claims de noticias conversando con la IA.

---

### 5. Sistema de Favoritos y Privacy (Sprint 18)

**Descripción**: Gestión per-user de noticias favoritas con privacidad de análisis.

**Arquitectura**:
- **Tabla `Favorite`**: Junction table con composite key `(userId, articleId)`
- **Campo `unlockedAnalysis`**: Boolean que indica si el usuario desbloqueó el análisis
- **Masking Logic**: Si `unlockedAnalysis: false`, oculta `analysis`, `summary`, `biasScore`

**Flujo**:
1. Usuario hace clic en ❤️ → Se guarda en `Favorite` (sin análisis)
2. Usuario hace clic en "Analizar" → Se marca `unlockedAnalysis: true`
3. Frontend muestra análisis solo si el usuario lo desbloqueó

**Beneficio**: Privacidad - los usuarios solo ven análisis que explícitamente solicitaron.

---

### 6. Modelo Freemium con Suscripciones (Sprint 27 & 30)

**Descripción**: Sistema de cuotas de uso con upgrade a plan PREMIUM y periodo de prueba de 7 días.

**Planes**:

| Plan | Análisis/mes | Chat (Trial) | Búsquedas/mes | Precio |
|------|--------------|--------------|---------------|--------|
| **FREE** | 500 | ✅ 7 días | 20 | Gratis |
| **PREMIUM** | Ilimitado | ✅ Ilimitado | Ilimitado | 9.99€/mes |

**Nuevo: Periodo de Prueba de Chat (Sprint 30)**:

Los usuarios FREE tienen acceso completo al Chat durante **7 días** desde su registro:
- ✨ **Día 1-7**: Chat habilitado (trial activo)
- 🔒 **Día 8+**: Chat bloqueado → CTA "Actualizar a Premium"
- 👑 **PREMIUM**: Acceso ilimitado permanente

**Implementación Técnica**:
- `QuotaService.canAccessChat()`: Verifica elegibilidad calculando días desde `User.createdAt`
- `FeatureLockedError` (HTTP 403): Devuelto cuando trial expirado
- Hook `useCanAccessChat()`: Frontend verifica estado del trial
- CTA Premium: Gradiente púrpura-azul con redirección a `/pricing`

**Features**:
- **Códigos promo**: Sistema de canje de códigos (ej: `VERITY_ADMIN`)
- **Auto-reset**: Cuotas se resetean diariamente a las 00:00 UTC
- **Token Taximeter**: Monitoreo en tiempo real de costes de Gemini
- **Billing Dashboard**: Usuario ve uso actual vs límite
- **Trial Tracking**: Dashboard muestra días restantes de prueba

**Tecnología**:
- `User.subscriptionPlan`: Enum (FREE/PREMIUM)
- `User.createdAt`: Timestamp para cálculo de trial
- `QuotaService`: Middleware que verifica límites y trial period
- `node-cron`: Jobs programados para reset diario/mensual
- Constante `TRIAL_PERIOD_DAYS = 7` en `constants.ts`

**Beneficio**: Sostenibilidad del proyecto mediante modelo freemium con conversión de usuarios FREE → PREMIUM incentivada por trial period.

---

### 7. Geolocalización y Noticias Locales (Sprint 20 + 28)

**Descripción**: Categoría "Local" personalizada según ubicación del usuario, con detección automática por GPS.

**Funcionamiento**:
1. Usuario configura `location` con un clic en el botón "Detectar" (geolocalización automática)
2. El componente `LocationButton` usa `navigator.geolocation` + Nominatim para obtener "Ciudad, Provincia"
3. Sistema ingesta noticias locales via Google News RSS con query `"noticias locales {ciudad}"`
4. Dashboard muestra noticias específicas de su localidad, filtradas por `category='local'`

**Tecnología**:
- Campo `User.location` en BD
- `LocationButton` component: geolocalización browser + Nominatim reverse geocoding
- `GoogleNewsRssClient` con query dinámico y prefijo geográfico
- `searchLocalArticles()`: búsqueda filtrada por `category='local'` + texto de ciudad
- Fallback a "Madrid" si `location` está vacío

**Integración**:
- **Perfil**: Botón "Detectar" al lado del input de ubicación
- **Sidebar**: Botón de geolocalización junto al item "Local" (detecta, guarda y navega)

**Beneficio**: Los usuarios configuran su feed local con un solo clic, sin escribir manualmente.

---

### 8. Observabilidad y Monitoreo (Sprint 15)

**Descripción**: Sistema completo de logging, error tracking y distributed tracing.

**Componentes**:

**Sentry**:
- Error tracking con stack traces completos
- Performance monitoring (API latency, DB queries)
- Release tracking con Git commit SHA
- User context en errores (userId, email)

**Pino Logger**:
- Structured logging en formato JSON
- Niveles: trace, debug, info, warn, error, fatal
- Correlación de logs con `requestId`
- Integración con Sentry para errores críticos

**Health Probes** (Kubernetes-style):
- `/api/health/check`: Liveness probe (aplicación viva)
- `/api/health/readiness`: Readiness probe (BD + servicios externos OK)

**Token Taximeter**:
- Tracking de costes de Gemini en tiempo real
- Métricas: input tokens, output tokens, cost estimado
- Almacenamiento en `UserStats` para analytics

**Beneficio**: Detección proactiva de errores y optimización de costes de IA.

---

### 9. Accesibilidad WCAG 2.1 AA (Sprint 19.8)

**Descripción**: Cumplimiento de estándares de accesibilidad web.

**Features Implementadas**:
- **Navegación por teclado**: Tab order lógico, focus visible
- **Contraste de color**: Ratio 4.5:1 en texto normal
- **ARIA labels**: Atributos semánticos para screen readers
- **Skip to content**: Link invisible para saltar navegación
- **Formularios accesibles**: Labels asociados, error messages descriptivos
- **Responsive design**: Escalado hasta 200% sin pérdida de funcionalidad

**Beneficio**: Aplicación usable para personas con discapacidades visuales, motoras o cognitivas.

---

<a id="interpretacion-analisis-verity-ai"></a>

## 🧠 Cómo interpretar el análisis de Verity AI

Verity AI ofrece dos métricas principales: **Sesgo** y **Fiabilidad**, basadas en el contenido disponible del artículo.

### Sesgo (0–100%)

El **Sesgo** indica si el texto utiliza encuadre, selección de hechos o lenguaje que orienta al lector hacia una interpretación concreta. Además, Verity AI estima una tendencia ideológica del artículo: `progresista`, `conservadora`, `extremista`, `neutral` o `indeterminada`.

Si el sistema no encuentra señales suficientes citadas (por ejemplo, porque el artículo es muy corto o incompleto), la tendencia se marca como **indeterminada** para evitar conclusiones erróneas.

### Fiabilidad (0–100)

La **Fiabilidad** mide la trazabilidad interna del texto: presencia de citas, datos, atribuciones claras y contexto.

Cuando aparece **“No verificable con fuentes internas”**, significa que el contenido disponible no aporta evidencia suficiente dentro del propio texto (por ejemplo, snippets RSS o artículos con acceso limitado).

Esta etiqueta **no implica que sea falso**; indica que, sin fuentes externas o el artículo completo, no se puede confirmar la información con rigor.

### FactCheck

En el apartado FactCheck, el veredicto **`SupportedByArticle`** significa que las afirmaciones están expresadas explícitamente en el artículo (soportadas por el texto), aunque no estén verificadas externamente.

---

## 🏗️ Arquitectura del Proyecto

### Arquitectura Hexagonal (Ports & Adapters)

El backend implementa **Clean Architecture** siguiendo los principios de Robert C. Martin:

```
┌─────────────────────────────────────────────────────────────────┐
│                         INFRASTRUCTURE                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Controllers  │  │ Repositories │  │   External   │          │
│  │  (Express)   │  │   (Prisma)   │  │  (Gemini,    │          │
│  │              │  │              │  │   RSS, etc.) │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           │                                     │
│         ┌─────────────────▼─────────────────┐                   │
│         │       APPLICATION (Use Cases)     │                   │
│         │  ┌────────────────────────────┐   │                   │
│         │  │ AnalyzeArticleUseCase      │   │                   │
│         │  │ SearchNewsUseCase          │   │                   │
│         │  │ ChatArticleUseCase         │   │                   │
│         │  └────────────────────────────┘   │                   │
│         └─────────────────┬─────────────────┘                   │
│                           │                                     │
│         ┌─────────────────▼─────────────────┐                   │
│         │          DOMAIN (Core)            │                   │
│         │  ┌────────────────────────────┐   │                   │
│         │  │ Entities: NewsArticle,     │   │                   │
│         │  │           User, Analysis   │   │                   │
│         │  ├────────────────────────────┤   │                   │
│         │  │ Repository Interfaces      │   │                   │
│         │  │ Service Interfaces         │   │                   │
│         │  └────────────────────────────┘   │                   │
│         └───────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

### Flujo de una Petición (Ejemplo: Analizar Noticia)

```
1. HTTP Request: POST /api/analyze/:articleId
             ↓
2. NewsController.analyze()  [Infrastructure]
             ↓
3. AnalyzeArticleUseCase.execute()  [Application]
             ↓
4. INewsArticleRepository.findById()  [Domain Interface]
             ↓
5. PrismaNewsArticleRepository  [Infrastructure Implementation]
             ↓
6. PostgreSQL (via Prisma)
             ↓
7. NewsArticle Entity  [Domain]
             ↓
8. IGeminiClient.analyzeNews()  [Domain Interface]
             ↓
9. GeminiClient  [Infrastructure Implementation]
             ↓
10. Google Gemini API
             ↓
11. Analysis Value Object  [Domain]
             ↓
12. IVectorClient.upsertItem()  [Domain Interface]
             ↓
13. PgVectorClient  [Infrastructure Implementation]
             ↓
14. PostgreSQL pgvector (store embedding)
             ↓
15. HTTP Response: { success, data }
```

### Dependency Injection Container

El proyecto usa un **DI Container Singleton** para inyectar dependencias:

```typescript
// backend/src/infrastructure/config/dependencies.ts
export class DependencyContainer {
  public readonly prisma: PrismaClient;
  public readonly geminiClient: IGeminiClient;
  public readonly vectorClient: IVectorClient;
  public readonly newsRepository: INewsArticleRepository;

  constructor() {
    // Inicialización de servicios
    this.prisma = new PrismaClient();
    this.geminiClient = new GeminiClient(process.env.GEMINI_API_KEY);
    this.vectorClient = new PgVectorClient(this.prisma);
    this.newsRepository = new PrismaNewsArticleRepository(this.prisma);

    // Casos de uso
    const analyzeArticleUseCase = new AnalyzeArticleUseCase(
      this.newsRepository,
      this.geminiClient,
      this.vectorClient
    );
  }
}
```

**Beneficios**:
- Fácil testeo (mock de dependencias)
- Bajo acoplamiento
- Inversión de dependencias (SOLID)

### Base de Datos (PostgreSQL + Prisma)

**Esquema de Entidades**:

```prisma
model User {
  id               String   @id @default(cuid())
  email            String   @unique
  name             String?
  location         String?  // Sprint 20: Geolocalización
  subscriptionPlan SubscriptionPlan @default(FREE)
  favorites        Favorite[]
  stats            UserStats?
}

model Article {
  id             String   @id @default(cuid())
  title          String
  description    String?
  content        String   @db.Text
  url            String   @unique
  source         String
  imageUrl       String?
  publishedAt    DateTime
  category       String
  topicSlug      String?  // Sprint 20: Topics unificados

  // Análisis de IA
  isAnalyzed     Boolean  @default(false)
  analysis       Json?
  summary        String?  @db.Text
  biasScore      Float?
  reliabilityScore Float?

  // Búsqueda vectorial
  embedding      Unsupported("vector(768)")?  // pgvector

  favorites      Favorite[]

  @@index([category])
  @@index([topicSlug])
  @@index([publishedAt(sort: Desc)])
  @@index([isAnalyzed])
}

model Favorite {
  user             User     @relation(fields: [userId], references: [id])
  userId           String
  article          Article  @relation(fields: [articleId], references: [id])
  articleId        String
  unlockedAnalysis Boolean  @default(false)  // Sprint 18.2: Privacy
  createdAt        DateTime @default(now())

  @@id([userId, articleId])  // Composite key
}

model UserStats {
  userId              String   @id
  user                User     @relation(fields: [userId], references: [id])

  // Cuotas FREE
  freeAnalysesUsed    Int      @default(0)
  freeChatsUsed       Int      @default(0)
  freeSearchesUsed    Int      @default(0)

  // Métricas de uso
  totalTokensUsed     BigInt   @default(0)
  estimatedCost       Float    @default(0)

  lastResetDate       DateTime @default(now())
}

model Topic {
  id          String   @id @default(cuid())
  slug        String   @unique  // "espana", "internacional", etc.
  name        String              // "España", "Internacional", etc.
  description String?
  icon        String?
}

enum SubscriptionPlan {
  FREE
  PREMIUM
}
```

**Migraciones**:
- Versionadas con Prisma Migrate
- Historial completo en `prisma/migrations/`
- Última: `20260211_enable_pgvector` (migración a pgvector)

---

## 🧪 Testing

Los comandos vigentes (rama actual) son:

### Backend

```bash
cd backend
npm run typecheck
npx vitest run
npm run test:coverage
```

### Frontend

```bash
cd frontend
npx tsc --noEmit
npm run test:run
npm run test:e2e:smoke
npm run test:e2e
```

### Qué valida la batería final

- Auth y contratos principales de API.
- Gate de paywall (`PAYWALL_BLOCKED`) para análisis standard y deep.
- Parseo de respuesta Gemini con JSON repair (1 intento) y fallback seguro.
- Limpieza de contenido antes del LLM (JSON/HTML/metadata noise).
- Flujo smoke E2E estable sin dependencia frágil de auth.

### Criterio de calidad

Según `docs/CALIDAD.md`:
- Filosofía 100/80/0 por riesgo.
- Cobertura global de branches en backend `>= 80%` (`npm run test:coverage`).

---

## 🚀 Deployment

La aplicación está desplegada en producción con la siguiente infraestructura:

### Frontend (Vercel)

- **URL**: https://verity-news.vercel.app
- **Plataforma**: Vercel (Serverless)
- **Build**: Automático en cada push a `main`
- **Edge Network**: CDN global con 100+ locations

**Configuración**:
```bash
# Build command
npm run build

# Output directory
.next

# Node version
20
```

**Variables de entorno** (configuradas en Vercel Dashboard):
```env
NEXT_PUBLIC_API_URL=https://verity-news-api.onrender.com
NEXT_PUBLIC_FIREBASE_*=[credenciales]
NEXT_PUBLIC_ENABLE_ADSENSE=true
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-...
```

### Backend (Render)

- **URL**: https://verity-news-api.onrender.com
- **Plataforma**: Render (Web Service - plan Starter, 512MB RAM)
- **Build**: Automático en cada push a `main` vía Docker
- **Region**: Frankfurt (EU)

**Optimizaciones de arranque (Sprint 36)**:

| Optimización | Motivo |
|---|---|
| `NODE_OPTIONS=--max-old-space-size=350` | Evita OOM kill (exit 134) en cold start limitando el heap de Node.js a 350MB |
| `./node_modules/.bin/prisma migrate deploy` | Evita que `npx` descargue y ejecute Prisma CLI en cada arranque (~50-80MB menos) |
| `start-period=90s` en healthcheck | El cold start (Docker pull + migrate + Firebase init) puede tardar hasta 80s |

**Variables de entorno** (configuradas en Render Dashboard):
- `DATABASE_URL`: Connection string de Neon PostgreSQL
- `GEMINI_API_KEY`: API key de Google AI Studio
- `FIREBASE_*`: Credenciales de Firebase Admin SDK
- `CORS_ORIGIN`: Lista de orígenes permitidos
- `NODE_ENV=production`

### Base de Datos (Neon Serverless PostgreSQL)

- **Plataforma**: Neon.tech
- **Plan**: Free tier (0.5GB storage, 1GB RAM)
- **Extensiones**: pgvector pre-instalado
- **Backups**: Automáticos diarios

**Connection Pooling**:
```
postgresql://user:password@host/database?pgbouncer=true&connection_limit=10
```

### CI/CD Pipeline

**GitHub Actions** (`.github/workflows/ci.yml`):
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run build
```

### Monitoreo en Producción

**Sentry**:
- Error tracking con alertas a email
- Performance monitoring de API endpoints
- Release tracking con Git SHA

**Uptime Monitoring**:
- Health checks cada 5 minutos
- Alertas si downtime > 2 minutos

---

## 🚀 DevOps & Infrastructure

Verity-News is deployed on a Linux VPS using Docker-based containerization.

### Stack

- VPS (IONOS)
- Docker & Docker Compose
- Nginx Reverse Proxy + HTTPS
- PostgreSQL
- ChromaDB (Vector Store)
- Sentry Monitoring

### CI/CD

- GitHub repository
- Automated tests before deployment
- Production build reproducibility
- Environment-based configuration

### Scalability

- Vertical scaling via VPS upgrade
- Horizontal scaling via service separation
- Future Kubernetes-ready architecture

---

## 🧭 Subproyecto Paralelo: Media Bias Atlas

Este repositorio incluye también `media-bias-atlas/`, un producto paralelo a Verity News desarrollado dentro del mismo ecosistema técnico, pero desacoplado funcionalmente y sin modificar el núcleo de Verity.

Estado actual de `media-bias-atlas`:

- MVP funcional cerrado hasta Sprint 10, con consolidación operativa posterior;
- catálogo de países, medios y feeds RSS operativo;
- ingesta manual de artículos y clasificación política funcionando;
- análisis ideológico por artículo persistido en backend;
- resumen ideológico básico por feed visible en frontend;
- perfil ideológico por medio, filtros, ordenación y comparativa rápida entre outlets;
- provider real Gemini ya alineado con el patrón técnico de Verity, manteniendo contrato desacoplado propio;
- seeds manuales idempotentes ya preparadas para `ES`, `GB`, `FR`, `DE` y `US`;
- lote de `US` ya cargado en base para demo local con `9` outlets y `18` feeds RSS validados;
- observabilidad IA ya integrada en el circuito comun del repositorio y visible desde `/admin/ai-usage`;
- suites backend de MBA en verde (`48/48`) tras alinear migraciones y BD de test;
- pendiente menor no bloqueante: validar con ejecucion real el provider `openai-compatible` o dejarlo fuera del alcance cerrado.

Documentación asociada:

- [Informe Media Bias Atlas](media-bias-atlas/docs/MEDIA_BIAS_ATLAS_INFORME_SPRINTS.md)
- [Arquitectura](docs/architecture/ARCHITECTURE.md)
- [Memoria del TFM](docs/MemoriaTFM.md)

---

## 📚 Documentación Técnica

### Documentos Principales

1. [📚 Índice de documentación](docs/README.md)
   - Estructura de carpetas en `docs/`
   - Criterios de organización documental

2. [📋 Memoria del TFM](docs/MemoriaTFM.md)
   - Memoria académica completa del proyecto
   - Justificación de decisiones técnicas
   - Análisis de resultados

3. [🗺️ Estructura del Proyecto](docs/ESTRUCTURA_PROYECTO.md)
   - Mapa completo de archivos y carpetas
   - Descripción de cada módulo

4. [✅ Estándares de Calidad](docs/CALIDAD.md)
   - Reglas de coverage (100/80/0)
   - Guías de testing

5. [📊 Estado del Proyecto](docs/ESTADO_PROYECTO.md)
   - Estado actual pre-merge y roadmap real
   - Métricas y progreso

6. [Feature Notes: Paywall + Jina + JSON Repair](docs/FEATURE_PAYWALL_JINA_JSON_REPAIR.md)
   - Flujo real de analisis (texto, prompts, gates)
   - Contratos de error (`PAYWALL_BLOCKED`, `formatError`)
   - Comandos de validacion reproducibles

7. [Informe Media Bias Atlas](media-bias-atlas/docs/MEDIA_BIAS_ATLAS_INFORME_SPRINTS.md)
   - Evolución detallada del subproyecto `media-bias-atlas`
   - Estado funcional acumulado hasta Sprint 10
   - Situación operativa actual del provider IA y de las seeds manuales

8. [Plan oficial - AI Observability Audit](media-bias-atlas/docs/PLAN_FEATURE_AI_OBSERVABILITY_AUDIT.md)
   - Estado real actualizado del cierre de Fase 1 a Fase 4
   - Validación local de la UI admin agregada y de los runs persistidos
   - Quality gate ejecutado en esta rama

### Diagramas Arquitecturales

- [Arquitectura Hexagonal](docs/diagrams/architecture_hexagonal.md)
- [Diagrama ER](docs/diagrams/database_er.md)
- [Secuencia de Análisis](docs/diagrams/sequence_analysis.md)

### Documentación de Sprints

Cada sprint tiene documentación detallada en `docs/sprints/`:

- [Sprint 27.3 - Production Hotfixes](docs/sprints/Sprint-27.3-Production-Responsive-Hotfixes.md)
- [Sprint 27 - Freemium](docs/sprints/Sprint-27-ENTREGABLES.md)
- [Sprint 25 - AI Prompt Improvements](docs/sprints/Sprint-25-AI-Prompt-Improvements.md)
- [Sprint 20 - Geolocalización](docs/sprints/Sprint-20-Geolocalizacion-Topics.md)
- [20+ documentos adicionales]

### Guías de Desarrollo

- [PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md): Contexto para GitHub Copilot
- [AI_RULES.md](docs/AI_RULES.md): Reglas de desarrollo asistido por IA

---

## 🏆 Principios y Buenas Prácticas

Este proyecto demuestra la aplicación de:

### Arquitectura y Diseño

✅ **Clean Architecture** (Robert C. Martin)
- Separación en capas: Domain, Application, Infrastructure
- Dependency Inversion Principle
- Testability garantizada

✅ **SOLID Principles**
- **S**ingle Responsibility: Cada clase una responsabilidad
- **O**pen/Closed: Extensible sin modificar código existente
- **L**iskov Substitution: Interfaces intercambiables
- **I**nterface Segregation: Interfaces específicas
- **D**ependency Inversion: Abstracciones sobre implementaciones

✅ **DDD (Domain-Driven Design)**
- Entities con lógica de negocio
- Value Objects inmutables
- Repository pattern

### Desarrollo

✅ **TDD (Test-Driven Development)**
- 328 tests (95% coverage)
- Red-Green-Refactor workflow
- Tests como documentación

✅ **Mikado Method**
- Refactorizaciones incrementales
- Grafos de dependencias
- Sprint 13.4: Profile page de 468 a 166 LOC (-64.5%)

✅ **Conventional Commits**
- Historial semántico: `feat:`, `fix:`, `refactor:`
- Automated changelog generation

✅ **Documentation as Code**
- Docs versionadas con código
- Markdown para portabilidad

### Calidad

✅ **Code Review**
- ESLint + Prettier configurados
- Pre-commit hooks con Husky
- Type safety con TypeScript strict mode

✅ **Security Best Practices**
- Helmet para HTTP headers seguros
- Input validation con Zod
- Rate limiting en endpoints sensibles
- CORS configurado correctamente

✅ **Performance**
- React Query para caching inteligente
- PostgreSQL índices optimizados
- Lazy loading de componentes
- Image optimization con Next.js

---

## 🎓 Reflexión Académica

### Aprendizajes Clave del TFM

1. **IA en Producción es Complejo**:
   - Los LLMs pueden alucinar → Necesidad de prompts estrictos
   - Los costes escalan rápidamente → Importance de caching y cuotas
   - La latencia afecta UX → Necesidad de loading states y fake delays

2. **Clean Architecture Vale la Pena**:
   - La separación en capas facilitó enormemente el testing
   - Cambiar de ChromaDB a pgvector fue trivial gracias a interfaces
   - El DI Container simplificó la gestión de dependencias

3. **TDD No es Opcional en Proyectos Reales**:
   - Los 328 tests detectaron 47 bugs antes de producción
   - La cobertura del 95% dio confianza para refactorizar
   - Los tests sirvieron como documentación viva del comportamiento

4. **La Observabilidad es Crítica**:
   - Sentry detectó 23 errores que no habríamos visto de otra forma
   - Los logs estructurados (Pino) facilitaron debugging en producción
   - El Token Taximeter evitó sobrecostes de 150€ en un mes

### Uso de IA Durante el Desarrollo

Este proyecto fue desarrollado con asistencia de **GitHub Copilot** y **Claude**:

**GitHub Copilot**:
- Autocompletado de código repetitivo (reducción del 40% de tiempo)
- Generación de tests boilerplate
- Sugerencias de types de TypeScript

**Claude**:
- Diseño de arquitectura (diagramas en Mermaid)
- Refactorizaciones complejas (Mikado Method)
- Revisión de código y detección de anti-patterns

**Lecciones sobre IA como Asistente**:
- ✅ Excelente para boilerplate y código repetitivo
- ✅ Útil para refactorizaciones con instrucciones claras
- ⚠️ Necesita supervisión humana constante
- ⚠️ No reemplaza el conocimiento de arquitectura
- ❌ No puede diseñar soluciones complejas de forma autónoma

### Próximos Pasos (Fase Post-TFM)

Si este proyecto continuara:

1. **Escalabilidad**:
   - Migrar a Kubernetes para auto-scaling
   - Implementar Redis para cache distribuido
   - Sharding de PostgreSQL para > 1M artículos

2. **IA Avanzada**:
   - Fine-tuning de modelo específico para análisis de sesgos españoles
   - Multi-model approach (Gemini + Claude + GPT-4 en ensemble)
   - Fact-checking automático con APIs de verificadores

3. **Monetización**:
   - Integración con Stripe para pagos recurrentes
   - API pública para desarrolladores (modelo pay-as-you-go)
   - Dashboards empresariales para medios de comunicación

4. **Mobile**:
   - App nativa con React Native
   - Notificaciones push de noticias importantes
   - Modo offline con sync

---

## 📝 Licencia

Este proyecto es parte de un Trabajo Final de Máster con fines educativos.

**Licencia**: MIT

**Atribución**: Si usas este código, por favor menciona:
```
Verity News - TFM Máster en Desarrollo con IA
Autor: David López Sánchez (BIG School, 2026)
```

---

## 👤 Autor

**David López Sánchez**

- 🎓 Estudiante del Máster en Desarrollo con Inteligencia Artificial
- 🏫 Institución: BIG School
- 📅 Año: 2026
- 🐙 GitHub: [@David-LS-Bilbao](https://github.com/David-LS-Bilbao)
- 📧 Repositorio: [PROYECTO-MASTER-IA](https://github.com/David-LS-Bilbao/PROYECTO-MASTER-IA)

---

## 🙏 Agradecimientos

- **BIG School** - Por el programa de Máster en Desarrollo con IA
- **Comunidad Open Source**:
  - shadcn/ui por los componentes accesibles
  - Prisma por el ORM excepcional
  - Next.js por el framework moderno
  - Vercel por el hosting gratuito
- **Proveedores de IA**:
  - Google (Gemini 2.0 Flash API)
  - Anthropic (Claude para asistencia en desarrollo)
- **Herramientas de Desarrollo**:
  - GitHub Copilot por el pair programming
  - VSCode por el editor potente
  - Cursor por el IDE con IA integrada

---

## 📞 Contacto y Soporte

Para preguntas académicas sobre este TFM:
- **Email**: [consultar en repositorio]
- **Issues**: [GitHub Issues](https://github.com/David-LS-Bilbao/PROYECTO-MASTER-IA/issues)

Para reportar bugs o sugerir features:
- Abre un issue en GitHub con la etiqueta correspondiente

---

**🚀 Proyecto en producción - Sprint 36**

**Estado**: En producción y funcional
**Última actualización**: 19 de febrero de 2026
**Líneas de código**: ~32,000 (sin dependencias)
**Tests**: 328 (95% coverage)
**Tiempo de desarrollo**: 7 semanas
**Commits**: 540+

---



*Desarrollado con ❤️ y ☕ como Trabajo Final de Máster*

*"La desinformación es el mayor desafío de nuestra era digital.
Verity News es mi contribución para enfrentarlo con tecnología."* - David López
