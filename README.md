# 🗞️ Verity News - Plataforma Inteligente de Análisis de Credibilidad

> **Trabajo Final de Máster** - Máster en Desarrollo con Inteligencia Artificial
> **Autor**: David López Sánchez | **Institución**: BIG School | **Fecha**: Febrero 2026

<div align="center">

[![Status](https://img.shields.io/badge/status-en%20producci%C3%B3n-success)](https://verity-news.vercel.app)
[![Tests](https://img.shields.io/badge/tests-328%20passing-brightgreen)](#testing)
[![Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen)](#testing)
[![Architecture](https://img.shields.io/badge/architecture-clean%20hexagonal-blue)](#arquitectura)

[🚀 Demo en Vivo](https://verity-news.vercel.app) | [📚 Documentación Completa](docs/MemoriaTFM.md) | [🏗️ Arquitectura](docs/architecture/ARCHITECTURE.md)

</div>

---

## 📖 ¿Qué es Verity News?

**Verity News** es una plataforma web full-stack que combina **IA generativa** (Gemini 2.0), **búsqueda semántica** (pgvector) y **análisis de credibilidad** para democratizar la verificación periodística en español.

### 🎯 Problema que Resuelve

En la era de la desinformación digital, los ciudadanos necesitan herramientas para evaluar críticamente la información que consumen. Verity News aplica técnicas de IA para:

- ✅ **Detectar sesgos políticos** en noticias (escala -100 a +100)
- ✅ **Evaluar fiabilidad** basándose en citas y fuentes verificables (0-100)
- ✅ **Identificar clickbait** con análisis de titulares sensacionalistas
- ✅ **Búsqueda semántica** que entiende el significado, no solo palabras clave
- ✅ **Chat conversacional** para verificar claims de noticias (RAG)

### 💡 Valor Añadido Académico

Este TFM demuestra la aplicación práctica de conceptos avanzados de IA:

1. **Prompt Engineering Avanzado**: Prompts optimizados para análisis explicable (XAI) con citaciones y razonamiento interno
2. **RAG (Retrieval-Augmented Generation)**: Sistema de chat con recuperación de contexto mediante búsqueda vectorial
3. **Clean Architecture**: Implementación enterprise de arquitectura hexagonal con SOLID, TDD y DI
4. **Vector Search**: Búsqueda semántica con embeddings de 768 dimensiones (pgvector + HNSW index)
5. **Modelo Freemium**: Sistema de cuotas de uso con upgrade a plan PREMIUM y periodo de prueba

---

## 🛠️ Stack Tecnológico

<table>
<tr>
<td valign="top" width="50%">

### Frontend
- **Next.js 16** (App Router + SSR)
- **React 19** (Server Components)
- **TypeScript 5** (Strict mode)
- **Tailwind CSS + shadcn/ui**
- **React Query 5** (Server state)
- **Vitest + RTL** (122 tests)

</td>
<td valign="top" width="50%">

### Backend
- **Node.js 20 LTS + Express 5**
- **TypeScript 5** (Clean Architecture)
- **Prisma ORM + PostgreSQL 17**
- **pgvector** (Búsqueda vectorial)
- **Firebase Auth** (JWT)
- **Vitest** (206 tests)

</td>
</tr>
<tr>
<td valign="top" width="50%">

### Inteligencia Artificial
- **Gemini 2.0 Flash** (Análisis + Chat)
- **Gemini Embeddings** (768-dim)
- **pgvector** (HNSW index)
- **RAG Architecture** (Zero hallucination)

</td>
<td valign="top" width="50%">

### DevOps & Observabilidad
- **Vercel** (Frontend hosting)
- **Render** (Backend hosting)
- **Neon PostgreSQL** (Serverless)
- **Sentry** (Error tracking)
- **GitHub Actions** (CI/CD)

</td>
</tr>
</table>

---

## ⚡ Funcionalidades Principales

### 1. Ingesta Automática Multi-Fuente
- 📡 **58+ fuentes españolas** (El País, El Mundo, 20 Minutos, Europa Press, Xataka, etc.)
- 🎯 **8 categorías unificadas** (España, Internacional, Local, Economía, Ciencia-Tecnología, Entretenimiento, Deportes, Salud)
- ⏱️ **Smart TTL**: Chequeo de 1 hora antes de re-ingestar (ahorro de cuota API)
- 🌍 **Geolocalización**: Noticias locales basadas en GPS + ubicación del usuario

### 2. Análisis de Credibilidad con IA

**Métricas Generadas por Gemini 2.0 Flash:**

| Métrica | Rango | Descripción |
|---------|-------|-------------|
| **Reliability Score** | 0-100 | Fiabilidad basada en citas a fuentes verificables |
| **Bias Score** | -100 a +100 | Sesgo político (-100: izquierda, +100: derecha) |
| **Clickbait Detection** | Boolean | Detección de titulares sensacionalistas |
| **Summary** | String | Resumen objetivo de 2-3 frases |
| **Internal Reasoning** | String | Razonamiento interno del LLM (XAI) |

**Prompt Engineering (Evidence-Based Scoring v5)**:
```typescript
// Reglas estrictas para ReliabilityScore (Sprint 25):
// < 40: Clickbait, opinión sin datos
// 40-60: Noticia estándar sin citas externas claras
// 60-80: Fuentes genéricas ('según expertos')
// > 80: SOLO con citas directas a organismos oficiales
```

### 3. Búsqueda Semántica con pgvector

**Arquitectura Waterfall (3 niveles)**:
```
LEVEL 1: Full-Text Search (PostgreSQL nativo)
  ↓ (si 0 resultados)
LEVEL 2: Semantic Search (pgvector + embeddings)
  ↓ (si 0 resultados)
LEVEL 3: Reactive Ingestion (trigger ingesta + re-query)
```

**Ejemplo**: Query "fraude electoral" → Encuentra "manipulación de votos", "irregularidades en urnas"

### 4. Chat Conversacional con RAG

**Dos Modos de Chat:**

- **Chat de Artículo (RAG Estricto)**: Preguntas sobre UN artículo específico con citaciones `[1][2]` para trazabilidad
- **Chat General (Knowledge-First)**: Preguntas abiertas con acceso completo al conocimiento de Gemini

**🔒 Restricción PREMIUM (Sprint 30):**
- **FREE**: 7 días de prueba desde el registro → Bloqueado después
- **PREMIUM**: Acceso completo ilimitado (9.99€/mes)

### 5. Modelo Freemium con Suscripciones

| Plan | Análisis/mes | Chat (Trial) | Búsquedas/mes | Precio |
|------|--------------|--------------|---------------|--------|
| **FREE** | 500 | ✅ 7 días | 20 | Gratis |
| **PREMIUM** | ∞ | ✅ Ilimitado | ∞ | 9.99€/mes |

**Features**: Códigos promo, auto-reset diario, Token Taximeter, Billing Dashboard

---

## 🚀 Instalación Rápida

### Prerrequisitos
```bash
Node.js 20+ | Docker | Git
```

### Cuentas API (Gratis)
1. **Firebase**: [Firebase Console](https://console.firebase.google.com/) → Descargar `serviceAccountKey.json`
2. **Gemini**: [Google AI Studio](https://aistudio.google.com/app/apikey) → Obtener API key

### Setup en 5 Pasos

```bash
# 1. Clonar repositorio
git clone https://github.com/David-LS-Bilbao/PROYECTO-MASTER-IA.git
cd PROYECTO-MASTER-IA/Verity-News

# 2. Levantar PostgreSQL con Docker
docker-compose up -d

# 3. Configurar variables de entorno
cd backend && cp .env.example .env
cd ../frontend && cp .env.local.example .env.local
# Editar .env con tus credenciales (ver guía abajo)

# 4. Instalar dependencias y migrar DB
cd backend
npm install && npx prisma migrate deploy && npx prisma generate

cd ../frontend
npm install

# 5. Iniciar aplicación (2 terminales)
# Terminal 1: cd backend && npm run dev
# Terminal 2: cd frontend && npm run dev
```

**Acceder a**: `http://localhost:3001`

<details>
<summary><b>📋 Variables de Entorno (Click para expandir)</b></summary>

### Backend (.env)
```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://verity:verity_password_dev@localhost:5432/verity_news
GEMINI_API_KEY=tu_api_key_de_gemini
FIREBASE_PROJECT_ID=tu-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
CORS_ORIGIN=http://localhost:3001
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
NEXT_PUBLIC_FIREBASE_API_KEY=tu_firebase_api_key
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu-project-id
```

</details>

---

## 🏗️ Arquitectura

### Clean Architecture (Hexagonal)

```
┌─────────────────────────────────────────────┐
│         INFRASTRUCTURE LAYER                │
│  Controllers → Routes → Middlewares         │
│  Prisma Repos → External Services (Gemini)  │
└──────────────────┬──────────────────────────┘
                   ↓ (Dependency)
┌─────────────────────────────────────────────┐
│         APPLICATION LAYER                   │
│  Use Cases: IngestNews, AnalyzeArticle,     │
│             SearchNews, ChatArticle         │
└──────────────────┬──────────────────────────┘
                   ↓ (Dependency)
┌─────────────────────────────────────────────┐
│         DOMAIN LAYER (Core)                 │
│  Entities: NewsArticle, User, Analysis      │
│  Repository Interfaces (Ports)              │
│  PURE TypeScript (No dependencies)          │
└─────────────────────────────────────────────┘
```

**Patrones de Diseño Aplicados**:
- Dependency Injection (Container singleton)
- Repository Pattern (abstracción de persistencia)
- Factory Pattern (`NewsArticle.reconstitute()`)
- Strategy Pattern (múltiples clientes RSS intercambiables)

### Base de Datos (PostgreSQL + Prisma)

**Modelos Principales**:
```prisma
model User {
  id               String  @id @default(cuid())
  email            String  @unique
  location         String? // GPS geolocalización
  subscriptionPlan SubscriptionPlan @default(FREE)
  favorites        Favorite[]
}

model Article {
  id               String   @id
  title            String
  content          String   @db.Text
  source           String
  category         String

  // Análisis IA
  isAnalyzed       Boolean  @default(false)
  analysis         Json?
  biasScore        Float?
  reliabilityScore Float?

  // Vector search
  embedding        Unsupported("vector(768)")?
}

model Favorite {
  userId           String
  articleId        String
  unlockedAnalysis Boolean  @default(false) // Privacy

  @@id([userId, articleId])
}
```

---

## 🧪 Testing

### Distribución de Tests (328 total, 95% coverage)

| Tipo | Backend | Frontend | Total |
|------|---------|----------|-------|
| **Unit Tests** | 154 | 98 | 252 |
| **Integration Tests** | 52 | 24 | 76 |
| **Coverage** | 97% | 92% | **95%** |

### Comandos de Testing
```bash
# Backend (206 tests)
cd backend && npm test

# Frontend (122 tests)
cd frontend && npm test

# Coverage report
npm run test:coverage

# Tests específicos
npm test -- <path-pattern>
```

### Estándares de Calidad (según [CALIDAD.md](docs/CALIDAD.md))
- **Coverage mínimo**: 95% en código crítico
- **Coverage objetivo**: 100% en casos de uso
- **TDD**: Red-Green-Refactor workflow

---

## 🚀 Deployment

### Producción Actual

| Componente | Plataforma | URL | Estado |
|------------|------------|-----|--------|
| **Frontend** | Vercel | https://verity-news.vercel.app | ✅ En vivo |
| **Backend** | Render | https://verity-news-api.onrender.com | ✅ En vivo |
| **Database** | Neon PostgreSQL | (Serverless) | ✅ Operativo |

### CI/CD Pipeline
- **GitHub Actions**: Tests automáticos en cada push
- **Auto-deploy**: Merge a `main` → Deploy automático
- **Health Checks**: `/api/health/check` cada 5 minutos

---

## 📚 Documentación Técnica

### Documentos Principales

📋 **[Memoria del TFM](docs/MemoriaTFM.md)** - Memoria académica completa del proyecto
🗺️ **[Estructura del Proyecto](docs/ESTRUCTURA_PROYECTO.md)** - Mapa completo de archivos y módulos
✅ **[Estándares de Calidad](docs/CALIDAD.md)** - Reglas de coverage y guías de testing
📊 **[Estado Actual](docs/ESTADO_PROYECTO.md)** - Estado del proyecto (Sprint 33)
🏗️ **[Arquitectura](docs/architecture/ARCHITECTURE.md)** - Diseño técnico e integraciones

### Diagramas Arquitecturales
- [Arquitectura Hexagonal](docs/diagrams/architecture_hexagonal.md)
- [Diagrama ER](docs/diagrams/database_er.md)
- [Secuencia de Análisis](docs/diagrams/sequence_analysis.md)

### Documentación de Sprints (33 sprints documentados)
- [Sprint 33 - Scoring vNext](docs/sprints/verification_report_sprint33.md)
- [Sprint 32 - Local Source Discovery](docs/sprints/Sprint-32-Local-Source-Discovery.md)
- [Sprint 31 - Offline-First Cache](docs/sprints/Sprint-31-Scoring-vNext-OSINT.md)
- [Sprint 30 - Chat Premium Gate](docs/sprints/Sprint-30-Chat-Premium-Gate.md)
- [Sprint 27 - Freemium Model](docs/sprints/Sprint-27-ENTREGABLES.md)
- [Sprint 25 - AI Prompt Improvements](docs/sprints/Sprint-25-AI-Prompt-Improvements.md)
- [20+ documentos adicionales en docs/sprints/](docs/sprints/)

---

## 🎓 Reflexión Académica

### Aprendizajes Clave del TFM

**1. IA en Producción es Complejo**
- ✅ Los LLMs pueden alucinar → Necesidad de prompts estrictos (Zero Hallucination Strategy)
- ✅ Los costes escalan rápidamente → Importance de caching y cuotas (Token Taximeter)
- ✅ La latencia afecta UX → Loading states y artificial delays (1.8s)

**2. Clean Architecture Vale la Pena**
- ✅ Testing trivial con interfaces (95% coverage)
- ✅ Cambiar de ChromaDB a pgvector fue un cambio de 3 líneas gracias a `IVectorClient`
- ✅ DI Container simplificó gestión de dependencias

**3. TDD No es Opcional**
- ✅ 328 tests detectaron 47 bugs antes de producción
- ✅ Refactorizar con confianza (Mikado Method)
- ✅ Tests como documentación viva

### Uso de IA Durante el Desarrollo

**GitHub Copilot**:
- ✅ Autocompletado de código repetitivo (reducción del 40% de tiempo)
- ✅ Generación de tests boilerplate
- ⚠️ Necesita supervisión humana constante

**Claude**:
- ✅ Diseño de arquitectura (diagramas en Mermaid)
- ✅ Refactorizaciones complejas (Mikado Method)
- ❌ No puede diseñar soluciones complejas de forma autónoma

### Métricas Finales del Proyecto

| Métrica | Valor |
|---------|-------|
| **Líneas de código** | ~35,000 (sin node_modules) |
| **Tests** | 328 (95% coverage) |
| **Commits** | 600+ |
| **Sprints** | 33 documentados |
| **Tiempo de desarrollo** | 8 semanas |
| **Archivos TypeScript** | 280+ |

---

## 🏆 Principios SOLID Aplicados

✅ **Single Responsibility**: Cada clase una responsabilidad (ej: `AnalyzeArticleUseCase` solo analiza)
✅ **Open/Closed**: Extensible sin modificar código (ej: nuevos clientes RSS sin tocar `DirectRSSClient`)
✅ **Liskov Substitution**: Interfaces intercambiables (ej: `IGeminiClient` mockeable en tests)
✅ **Interface Segregation**: Interfaces específicas (ej: `INewsArticleRepository` vs `IUserRepository`)
✅ **Dependency Inversion**: Abstracciones sobre implementaciones (ej: Use Cases dependen de interfaces)

---

## 📝 Licencia

Este proyecto es parte de un Trabajo Final de Máster con fines educativos.

**Licencia**: MIT

**Atribución**:
```
Verity News - TFM Máster en Desarrollo con IA
Autor: David López Sánchez (BIG School, 2026)
```

---

## 👤 Autor

**David López Sánchez**

- 🎓 Máster en Desarrollo con Inteligencia Artificial
- 🏫 BIG School
- 📅 2026
- 🐙 GitHub: [@David-LS-Bilbao](https://github.com/David-LS-Bilbao)
- 📧 Repositorio: [PROYECTO-MASTER-IA](https://github.com/David-LS-Bilbao/PROYECTO-MASTER-IA)

---

## 🙏 Agradecimientos

- **BIG School** - Por el programa de Máster en Desarrollo con IA
- **Comunidad Open Source**: shadcn/ui, Prisma, Next.js, Vercel
- **Proveedores de IA**: Google (Gemini 2.0), Anthropic (Claude)
- **Herramientas**: GitHub Copilot, VSCode, Cursor

---

<div align="center">

**🚀 Proyecto completado - Sprint 33**

**Estado**: En producción y funcional
**Última actualización**: 16 de febrero de 2026

*Desarrollado con ❤️ y ☕ como Trabajo Final de Máster*

*"La desinformación es el mayor desafío de nuestra era digital.
Verity News es mi contribución para enfrentarlo con tecnología."*
— David López

</div>
