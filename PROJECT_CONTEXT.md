# Contexto del Proyecto: Verity News

## 1. Objetivo
Desarrollar una **Plataforma de Noticias Inteligente** que agrega, resume y analiza noticias utilizando IA Generativa y técnicas RAG (Retrieval-Augmented Generation). El objetivo es combatir la desinformación ofreciendo análisis de sesgos y un chat contextual verificado.

## 2. Stack Tecnológico

| Categoría | Tecnología | Detalles |
|-----------|------------|----------|
| **Frontend** | React 18 | Vite, TypeScript, Tailwind CSS, Zustand, React Query |
| **Backend** | Node.js 20+ | Express.js, TypeScript (Strict) |
| **Arquitectura** | Clean / Hexagonal | Domain, Application, Infrastructure |
| **IA Core** | Gemini 1.5 Flash | Vía Google AI Studio API (Free Tier) |
| **Orquestación** | LangChain.js | Gestión de prompts y cadenas RAG |
| **Vector Store** | ChromaDB | Dockerizado (Búsqueda semántica) |
| **Base de Datos** | PostgreSQL | Dockerizado (Usuarios, Metadatos noticias) |
| **ORM** | Prisma | Gestión de esquemas y migraciones |
| **Validación** | Zod | Validación de inputs en API y Frontend |

## 3. Infraestructura Local
- **Docker Compose:** Orquestación de PostgreSQL y ChromaDB.
- **Variables de Entorno:** Gestión mediante `.env` (Backend) y `.env.local` (Frontend).

## 4. Arquitectura Backend (Clean Architecture)
HTTP Request (Express) ↓ ┌─────────────────┐ │ Controller │ ← (Infrastructure) Recibe HTTP, valida con Zod └────────┬────────┘ ↓ ┌─────────────────┐ │ UseCase │ ← (Application) Lógica de negocio (ej: GetNewsWithBias) └────────┬────────┘ ↓ ┌─────────────────┐ │ Repository │ ← (Domain/Infra) Interfaz en Dominio, Impl en Infra └────────┬────────┘ ↓ ┌─────────────────┐ │ DB / AI API │ ← (External) Prisma / Gemini API / ChromaDB └─────────────────┘


## 5. Modelo de Dominio (Entidades Core)

1.  **User:** `id`, `email`, `preferences` (JSON).
2.  **NewsArticle:** `id`, `title`, `content`, `summary` (IA), `biasScore`, `embeddingStatus`.
3.  **NewsSource:** `id`, `name`, `reliabilityScore`.
4.  **ChatSession:** `id`, `userId`, `messages` (Historial).

## 6. Flujo de IA (RAG)
1.  **Ingesta:** NewsAPI -> Normalización -> Generación Embedding (Gemini) -> ChromaDB.
2.  **Consulta:** User Query -> Embedding -> Búsqueda Vectorial (Chroma) -> Contexto.
3.  **Generación:** Contexto + Query -> LLM (Gemini) -> Respuesta verificada.