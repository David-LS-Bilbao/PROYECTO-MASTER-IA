# 🗞️ Verity News - Plataforma Inteligente de Noticias con IA

> Trabajo Final de Máster - Máster en Desarrollo con Inteligencia Artificial (BIG School)

**Aplicación web full-stack** para análisis de credibilidad de noticias españolas con IA, arquitectura hexagonal y TDD.

---

## 📋 Descripción

Verity News es una plataforma de análisis de credibilidad de noticias que combina:
- 📰 **Ingesta automática** desde RSS de medios españoles (El País, El Mundo, 20 Minutos, Europa Press)
- 🖼️ **Extracción de imágenes reales** mediante MetadataExtractor (Open Graph)
- 🤖 **Análisis de sesgo político** y credibilidad con Gemini 2.0 Flash
- 💬 **Chat conversacional con RAG** y Google Search Grounding
- 🔍 **Búsqueda semántica** con ChromaDB (embeddings vectoriales)
- 📊 **Dashboard interactivo** con analytics y gestión de favoritos
- 👤 **Perfiles de usuario** con preferencias personalizadas y geolocalización (Firebase Auth)
- 🌍 **8 categorías unificadas** con navegación inteligente y auto-fill automático
- 🎯 **Smart Search** con keywords optimizados para mejores resultados
- 💰 **Monitoreo de costes** con Token Taximeter en tiempo real
- 💎 **Modelo Freemium** (FREE/PREMIUM) con canje de códigos
- 📢 **Monetización** con Google AdSense (mock/dev y producción)
- ✅ **328 tests** (100% cobertura crítica) con TDD y Mikado Method

---

## 🎯 Objetivos del Proyecto

1. Demostrar aplicación práctica de conceptos del máster
2. Integrar IA en todo el ciclo de desarrollo
3. Construir una aplicación real y funcional
4. Documentar el proceso de desarrollo asistido por IA

---

## 🛠️ Stack Tecnológico

### Frontend
- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **UI Library:** shadcn/ui + Radix UI + Tailwind CSS
- **State Management:** React Query v5 + Context API
- **Forms:** React Hook Form + Zod validation
- **Testing:** Vitest + React Testing Library
- **Build:** Turbopack (Next.js optimizations)

### Backend
- **Runtime:** Node.js 20+ + TypeScript (strict mode)
- **Framework:** Express 5 con Clean Architecture (Hexagonal)
- **ORM:** Prisma (PostgreSQL)
- **Validation:** Zod schemas
- **Logging:** Pino (structured logging)
- **Testing:** Vitest
- **Resilience:** Exponential Backoff + Retry Strategy

### IA & Machine Learning
- **LLMs:** Gemini 2.0 Flash (análisis de sesgo, categorización)
- **Vector Database:** ChromaDB (búsqueda semántica)
- **Embeddings:** Gemini Embeddings
- **News Sources:** RSS directos (El País, El Mundo, 20 Minutos, Europa Press)
- **Metadata Extraction:** Custom MetadataExtractor (og:image, og:description)
- **Chat Grounding:** Google Search API + RAG (Retrieval Augmented Generation)
### Infrastructure & DevOps
- **Auth:** Firebase Authentication + Admin SDK
- **Database:** PostgreSQL 17 (Docker)
- **Containerization:** Docker + Docker Compose
- **Monitoring:** 
  - Health Probes (liveness + readiness)
  - Token Taximeter (costes en tiempo real)
  - Pino structured logging
- **Version Control:** Git + GitHub
- **Quality:** ESLint + Prettier + Husky (pre-commit hooks)

---

## 📁 Estructura del Proyecto

```
Verity-News/
├── frontend/                       # Next.js App (SSR + CSR)
│   ├── app/                        # Next.js App Router
│   │   ├── login/                  # Página de autenticación
│   │   ├── news/[id]/              # Detalle de noticia
│   │   ├── search/                 # Búsqueda semántica
│   │   ├── profile/                # Perfil de usuario
│   │   └── page.tsx                # Dashboard principal
│   ├── components/                 # Componentes reutilizables
│   │   ├── ui/                     # shadcn/ui primitivos (30+ componentes)
│   │   ├── layout/                 # Header, Sidebar, Footer
│   │   ├── dashboard/              # Componentes del dashboard
│   │   └── profile/                # Componentes de perfil (Sprint 13.4)
│   ├── hooks/                      # Custom React Hooks (12 hooks)
│   ├── lib/                        # Utilidades y API clients
│   ├── context/                    # React Context (AuthContext)
│   ├── tests/                      # Tests Vitest (122 tests)
│   └── package.json
│
├── backend/                        # API REST Node.js
│   ├── src/
│   │   ├── domain/                 # Entidades + Reglas de Negocio
│   │   │   ├── entities/           # NewsArticle, User, Analysis
│   │   │   ├── repositories/       # Interfaces (puertos)
│   │   │   └── services/           # Servicios de dominio
│   │   ├── application/            # Casos de Uso
│   │   │   └── use-cases/          # AnalyzeNews, SearchNews, ChatWithNews
│   │   ├── infrastructure/         # Adaptadores
│   │   │   ├── http/               # Controllers + Routes + Middlewares
│   │   │   ├── persistence/        # Prisma + ChromaDB
│   │   │   ├── external/           # OpenAI, Gemini, RSS, MetadataExtractor
│   │   │   ├── config/             # Configuración
│   │   │   ├── logger/             # Pino logging
│   │   │   └── monitoring/         # Health probes, Token Taximeter
│   │   └── index.ts                # Entry point
│   ├── prisma/
│   │   ├── schema.prisma           # Esquema DB (6 entidades)
│   │   └── migrations/             # Migraciones SQL
│   ├── tests/                      # Tests Vitest (206 tests)
│   └── package.json
│
├── docs/                           # Documentación técnica
│   ├── MemoriaTFM.md               # Memoria del TFM
│   ├── ESTRUCTURA_PROYECTO.md      # Mapa completo del proyecto
│   ├── DEUDA_TECNICA_SPRINT_13.md  # Análisis deuda técnica
│   ├── CALIDAD.md                  # Estándares de calidad
│   ├── diagrams/                   # Diagramas arquitecturales
│   └── [20+ documentos técnicos]
│
├── tests/
│   └── performance/                # Tests de carga (k6)
│
├── docker-compose.yml              # PostgreSQL + ChromaDB
├── ESTADO_PROYECTO.md              # Estado actual (Sprint 13.4)
├── PROJECT_CONTEXT.md              # Contexto para Copilot
├── AI_RULES.md                     # Reglas de desarrollo con IA
└── README.md                       # Este archivo
```

📖 **Ver estructura completa:** [ESTRUCTURA_PROYECTO.md](./docs/ESTRUCTURA_PROYECTO.md)

---

## 🚀 Quick Start

### Prerrequisitos

- **Node.js** 20+ (LTS recomendado)
- **npm** o **pnpm**
- **Docker** y **Docker Compose**
- **Cuentas API:**
  - Firebase (Authentication - gratis)
  - Google AI Studio (Gemini API - gratis con límites)

### Instalación

1. **Clonar el repositorio**
```bash
git clone https://github.com/David-LS-Bilbao/PROYECTO-MASTER-IA.git
cd PROYECTO-MASTER-IA/Verity-News
```

2. **Configurar variables de entorno**
```bash
# Backend
cp backend/.env.example backend/.env
# Editar backend/.env con:
# - DATABASE_URL (PostgreSQL)
# - GEMINI_API_KEY
# - NEWS_API_KEY (NewsAPI)
# - FIREBASE_PROJECT_ID
# - CHROMA_URL=http://localhost:8000

# Frontend
cp frontend/.env.local.example frontend/.env.local
# Editar frontend/.env.local con:
# - NEXT_PUBLIC_API_URL=http://localhost:3000
# - NEXT_PUBLIC_CRON_SECRET (igual que CRON_SECRET del backend)
# - NEXT_PUBLIC_ENABLE_ADSENSE (true/false)
# - NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxxxxxxxx
# - NEXT_PUBLIC_FIREBASE_* (credenciales Firebase)
```

3. **Levantar servicios con Docker**
```bash
docker-compose up -d
# Servicios iniciados:
# - PostgreSQL (puerto 5432)
# - ChromaDB (puerto 8000)
```

4. **Instalar dependencias**
```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

5. **Ejecutar migraciones de base de datos**
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

6. **Iniciar en modo desarrollo**
```bash
# Terminal 1 - Backend (puerto 3000)
cd backend && npm run dev

# Terminal 2 - Frontend (puerto 3001)
cd frontend && npm run dev
```

7. **Abrir en el navegador**
```
http://localhost:3001
```

### Verificación de la Instalación

```bash
# Health check backend
curl http://localhost:3000/api/health/check

# Readiness probe (verifica DB)
curl http://localhost:3000/api/health/readiness
```

---

## 📖 Documentación

- [📋 Estado del Proyecto](./ESTADO_PROYECTO.md) - Sprint 27.2 completado
- [🗺️ Estructura del Proyecto](./docs/ESTRUCTURA_PROYECTO.md) - Mapa completo
- [🔬 Deuda Técnica Sprint 13](./docs/DEUDA_TECNICA_SPRINT_13.md) - Análisis + Plan Mikado
- [✅ Estándares de Calidad](./docs/CALIDAD.md) - Coverage 100/80/0
- [📝 Memoria TFM](./docs/MemoriaTFM.md) - Documentación académica
- [🏗️ Diagramas](./docs/diagrams/) - Arquitectura, ER, secuencias
- [🌍 Sprint 20: Geolocalización](./docs/sprints/Sprint-20-Geolocalizacion-Topics.md) - Topics + Location
- [🎨 Sprint 22: UI Cleanup](./docs/sprints/Sprint-22-UI-Cleanup-Smart-Search.md) - Navegación + Keywords
- [🛡️ Sprint 27.1: Security Remediation](./docs/sprints/Sprint-27.1-Security-Remediation.md)
- [🎬 Sprint 27.2: Fix Entretenimiento](./docs/sprints/Sprint-27.2-Fix-Entretenimiento.md)
- [💎 Sprint 27: Freemium + Suscripciones](./Sprint-27-ENTREGABLES.md) - Modelo FREE/PREMIUM (MVP)

---

## 🧪 Testing

**Total: 328 tests (100% cobertura en código crítico)**

### Backend (206 tests - 99.5% passing)
```bash
cd backend

# Ejecutar todos los tests
npm test

# Modo watch
npm run test:watch

# Con coverage
npm run test:coverage
```

**Distribución:**
- Casos de uso: 58 tests
- API REST: 85 tests
- Database (Prisma): 42 tests
- Servicios externos: 21 tests

### Frontend (122 tests - 100% passing)
```bash
cd frontend

# Ejecutar todos los tests
npm test

# Modo watch
npm run test:watch

# Con coverage
npm run test:coverage
```

**Distribución:**
- Componentes: 71 tests
- Custom Hooks: 23 tests (Sprint 13.4)
- Utilidades: 28 tests

### Tests de Performance
```bash
cd tests/performance

# Test de carga con k6 (100 requests concurrentes)
k6 run stress-test.js

# Test de latencia
k6 run latency-test.js
```

---

## 📦 Deployment

> **Nota:** El proyecto está actualmente en desarrollo local. Deploy en producción planificado para Sprint 14.

### Frontend (Vercel) - Planificado
```bash
cd frontend
npm run build
vercel deploy --prod
```

**Variables de entorno requeridas en Vercel:**
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_CRON_SECRET`
- `NEXT_PUBLIC_ENABLE_ADSENSE`
- `NEXT_PUBLIC_ADSENSE_CLIENT_ID`
- `NEXT_PUBLIC_FIREBASE_*` (credenciales Firebase)

### Backend (Railway/Render) - Planificado
```bash
cd backend
npm run build
# Deploy automático vía Git push
```

**Variables de entorno requeridas:**
- `DATABASE_URL` (PostgreSQL connection)
- `GEMINI_API_KEY`
- `NEWS_API_KEY`
- `FIREBASE_PROJECT_ID`
- `CHROMA_URL`
- `CRON_SECRET`
- `PROMO_CODES`
- `NODE_ENV=production`

### Base de Datos
- **Desarrollo:** PostgreSQL local (Docker)
- **Producción:** Railway PostgreSQL / Supabase (planificado)

---

## 🤝 Contribución

Este es un proyecto académico (TFM), pero si quieres contribuir:

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📝 Licencia

Este proyecto es parte de un Trabajo Final de Máster y está bajo licencia MIT.

---

## 👤 Autor

**David López Sánchez** - Estudiante del Máster en Desarrollo con IA (BIG School)

- 🐙 GitHub: [@David-LS-Bilbao](https://github.com/David-LS-Bilbao)
- 📧 Proyecto: [PROYECTO-MASTER-IA](https://github.com/David-LS-Bilbao/PROYECTO-MASTER-IA)

---

## 🙏 Agradecimientos

- **BIG School** - Por el Máster en Desarrollo con IA
- **Comunidad Open Source** - shadcn/ui, Prisma, Next.js, React Query
- **GitHub Copilot** - Asistente IA utilizado durante el desarrollo
- **Proveedores de IA:** Google (Gemini 2.0 Flash)

---

## 🏆 Principios Aplicados

Este proyecto demuestra la aplicación práctica de:

- ✅ **Clean Architecture** (Arquitectura Hexagonal)
- ✅ **SOLID Principles** (Single Responsibility, Open/Closed, etc.)
- ✅ **TDD** (Test-Driven Development) - 328 tests
- ✅ **Mikado Method** (Refactorizaciones incrementales)
- ✅ **DRY** (Don't Repeat Yourself) - Componentes reutilizables
- ✅ **KISS** (Keep It Simple, Stupid) - Código legible
- ✅ **Conventional Commits** - Historial de commits semántico
- ✅ **Documentation as Code** - Docs versionadas con el código

---

**🚀 Proyecto activo - Sprint 27.2 completado - 97% de progreso**

## 📊 Estado del Proyecto

![Status](https://img.shields.io/badge/status-sprint%2027.2%20completado-success)
![Progress](https://img.shields.io/badge/progress-97%25-green)
![Tests](https://img.shields.io/badge/tests-328%20passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen)

**Inicio:** Enero 2026
**Último Sprint:** 27.2 - Fix Entretenimiento y Calidad de Ingesta
**Fecha:** 10 de febrero de 2026

### Métricas Actuales

| Métrica | Backend | Frontend | Total |
|---------|---------|----------|-------|
| **Tests** | 206 (99.5%) | 122 (100%) | 328 |
| **Cobertura** | 97% | 92% | 95% |
| **Archivos TS** | 147 | 89 | 236 |
| **Líneas de Código** | ~18,500 | ~12,300 | ~30,800 |

### Últimas Refactorizaciones

| Sprint | Archivo | Antes | Después | Reducción |
|--------|---------|-------|---------|-----------|
| 13.4 | profile/page.tsx | 468 LOC | 166 LOC | -64.5% |
| 13.3 | TokenTaximeter | 356 LOC | 89 LOC | -75% |
| 12.3 | news-card.tsx | 387 LOC | 230 LOC | -40.6% |

---

## 🗓️ Sprints Completados

### ✅ Fase 1: Cimientos (Sprints 1-6)
- [x] **Sprint 1:** Arquitectura Hexagonal + Docker + Pipeline de Ingesta
- [x] **Sprint 2:** Integración Gemini + Análisis de Sesgo Político
- [x] **Sprint 3:** Interfaz React + Autenticación Firebase
- [x] **Sprint 4:** ChromaDB + Embeddings Vectoriales
- [x] **Sprint 5:** Búsqueda Semántica + 8 Categorías RSS
- [x] **Sprint 6:** Página Detalle + Sistema de Favoritos

### ✅ Fase 2: Experiencia (Sprints 7-10)
- [x] **Sprint 7.1:** Chat RAG + Seguridad + Auditoría
- [x] **Sprint 7.2:** UX + Chat Híbrido + Auto-Favoritos
- [x] **Sprint 8:** Optimización de Costes Gemini
- [x] **Sprint 8.1:** Suite de Tests de Carga (k6)
- [x] **Sprint 8.2:** Token Taximeter Completo
- [x] **Sprint 9:** Gestor de Fuentes RSS con IA
- [x] **Sprint 10:** Usuarios + Perfiles + Motor Optimizado

### ✅ Fase 3: Refinamiento (Sprints 11-13)
- [x] **Sprint 11:** Suite de Testing Backend (206 tests)
- [x] **Sprint 12:** Testing Frontend + Auto-Logout 401 (122 tests)
- [x] **Sprint 13:** Resiliencia + Observabilidad + Health Probes
- [x] **Sprint 13.1:** Botón Refresh News Inteligente
- [x] **Sprint 13.2:** HealthController + Monitoring Probes
- [x] **Sprint 13.3:** Refactorización Backend (TDD + SOLID)
- [x] **Sprint 13.4:** Refactorización Frontend (Plan Mikado)

### ✅ Fase 4: Optimización (Sprints 14-19)
- [x] **Sprint 14:** Billing & Usage Limits (FREE, QUOTA, PAY-AS-YOU-GO)
- [x] **Sprint 15:** Monitoring con Sentry + Distributed Tracing
- [x] **Sprint 16:** UX Polish + Auto-refresh + Duplicados Fix
- [x] **Sprint 17:** Cost Optimization (Global Cache + Smart TTL)
- [x] **Sprint 18:** Privacy & Multi-user (Per-user favorites)
- [x] **Sprint 18.2:** Analysis Privacy (Unlocked Analysis per user)
- [x] **Sprint 18.3:** UX Enhancements (Artificial Reveal + Round Robin)
- [x] **Sprint 19:** Legal Pages + A11y (WCAG 2.1 AA)

### ✅ Fase 5: Geolocalización y UI Moderna (Sprints 20-22)
- [x] **Sprint 20:** Geolocalización + Topics Unificados
  - [x] Fase 1: Base de datos (User.location + Topic model)
  - [x] Fase 2: Backend API (TopicRepository + Smart routing)
  - [x] Fase 3: Frontend (Sidebar 8 categorías + Location field)
- [x] **Sprint 22:** UI Cleanup + Smart Search
  - [x] Eliminación de CategoryPills (navegación unificada)
  - [x] Títulos dinámicos por categoría
  - [x] Auto-fill de categorías vacías
  - [x] TOPIC_QUERIES con keywords optimizados

### ✅ Fase 6: Optimización de IA (Sprint 25)
- [x] **Sprint 25:** AI Prompt Improvements
  - [x] Evidence-Based Scoring (Analysis Prompt v5)
    - Restricción global: "ANALIZA SOLO EL TEXTO PROPORCIONADO"
    - Internal reasoning con 3 preguntas obligatorias
    - ReliabilityScore con reglas estrictas (< 40, 40-60, 60-80, > 80)
    - Verificación: Opinion (20) vs Fact (95)
  - [x] Zero Hallucination Strategy (RAG Chat v5)
    - System persona: "Analista de Inteligencia riguroso"
    - Incertidumbre radical: prohibición de conocimiento general
    - Trazabilidad forzada: cada frase debe citarse [x]
  - [x] Script de verificación: `verify-analysis-rules.ts`

### ✅ Fase 7: Freemium y Suscripciones (Sprint 27)
- [x] **Sprint 27.2:** Fix Entretenimiento y Calidad de Ingesta
- [x] **Sprint 27.1:** Security Remediation e Ingest Hardening
- [x] **Sprint 27:** Modelo Freemium + Suscripciones (MVP)
  - [x] `SubscriptionPlan` (FREE/PREMIUM) + migraciones
  - [x] Endpoints `/api/subscription/redeem` y `/api/subscription/cancel`
  - [x] PricingModal + gestión en perfil

### 🚀 Próximos Pasos
- [ ] **Sprint 26:** Optimización de caché y performance monitoring
- [ ] **Sprint 28:** Deploy final en producción (Vercel + Railway)
- [ ] **Sprint 29:** Documentación final del TFM + Presentación

---

**🚀 ¡Proyecto en desarrollo!**
