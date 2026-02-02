# Contexto del Proyecto: Verity News

> Última actualización: Sprint 8.2 - Token Taximeter (2026-02-02)

## 1. Objetivo
Desarrollar una **Plataforma de Noticias Inteligente** que agrega, resume y analiza noticias utilizando IA Generativa y técnicas RAG (Retrieval-Augmented Generation). El objetivo es combatir la desinformación ofreciendo análisis de sesgos, detector de bulos y un chat contextual verificado.

## 2. Stack Tecnológico

| Categoría | Tecnología | Detalles |
|-----------|------------|----------|
| **Frontend** | Next.js 16 + React 19 | TypeScript, Tailwind CSS v4, App Router |
| **Backend** | Node.js 22 | Express.js, TypeScript (Strict), Clean Architecture |
| **Arquitectura** | Hexagonal | Domain, Application, Infrastructure |
| **IA - Análisis** | Gemini 2.5 Flash | Pay-As-You-Go con Token Taximeter |
| **IA - Embeddings** | text-embedding-004 | 768 dimensiones |
| **IA - Chat** | Gemini 2.5 Flash | RAG + Google Search Grounding |
| **Vector Store** | ChromaDB | Búsqueda semántica |
| **Base de Datos** | PostgreSQL 16 | Prisma 7 ORM |
| **Validación** | Zod | Validación de inputs en API |
| **Scraping** | Jina Reader API | Extracción de contenido |
| **Ingesta** | RSS Directo | 9 medios españoles, 8 categorías |
| **Sanitización** | DOMPurify | Protección XSS |
| **Rate Limiting** | express-rate-limit | 100 req/15min |
| **Load Testing** | k6 | Suite de stress test |

## 3. Arquitectura Backend (Clean Architecture)

```
HTTP Request (Express)
        ↓
┌─────────────────┐
│   Controller    │ ← (Infrastructure) HTTP + Zod validation
└────────┬────────┘
         ↓
┌─────────────────┐
│    UseCase      │ ← (Application) Lógica de negocio
└────────┬────────┘
         ↓
┌─────────────────┐
│   Repository    │ ← (Domain/Infra) Interfaces + Implementaciones
└────────┬────────┘
         ↓
┌─────────────────┐
│  External APIs  │ ← Prisma / Gemini / ChromaDB / Jina
└─────────────────┘
```

## 4. Modelo de Dominio

### NewsArticle
```typescript
interface NewsArticleProps {
  id: string;
  title: string;
  content: string | null;
  url: string;
  source: string;
  category: string | null;
  embedding: string | null;
  summary: string | null;
  biasScore: number | null;
  analysis: string | null;  // JSON ArticleAnalysis
  analyzedAt: Date | null;
  isFavorite: boolean;
}
```

### ArticleAnalysis (Sprint 8.2)
```typescript
interface ArticleAnalysis {
  summary: string;
  biasScore: number;      // 0-1 normalizado
  biasRaw: number;        // -10 a +10
  biasIndicators: string[];
  clickbaitScore: number; // 0-100
  reliabilityScore: number; // 0-100 (detector de bulos)
  sentiment: 'positive' | 'negative' | 'neutral';
  mainTopics: string[];
  factCheck: FactCheck;
  // Token Taximeter (Sprint 8.2)
  usage?: TokenUsage;
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEstimated: number; // En Euros
}
```

## 5. Flujo de IA (RAG)

1. **Ingesta:** RSS → Jina Reader → Normalización → Embedding (Gemini) → ChromaDB + PostgreSQL
2. **Análisis:** Artículo → Gemini 2.5 Flash → ArticleAnalysis (con Token Taximeter)
3. **Búsqueda:** Query → Embedding → ChromaDB → Resultados semánticos
4. **Chat RAG:** Pregunta → ChromaDB Context → Gemini → Respuesta verificada
5. **Chat Grounding:** Pregunta → Gemini + Google Search → Respuesta con fuentes web

## 6. Token Taximeter (Sprint 8.2)

Sistema de auditoría de costes en tiempo real para llamadas a Gemini API.

### Constantes de Precio (Gemini 2.5 Flash)
```typescript
PRICE_INPUT_1M = 0.075   // USD por 1M tokens entrada
PRICE_OUTPUT_1M = 0.30   // USD por 1M tokens salida
EUR_USD_RATE = 0.95      // Ratio conversión
```

### Log de Consola
```
🧾 ═══════════════════════════════════════════════════════════
🧾 TOKEN TAXIMETER - Análisis de Noticia
🧾 ═══════════════════════════════════════════════════════════
📰 Título: "El Gobierno anuncia nuevas medidas..."
🧠 Tokens entrada:  1,234
🧠 Tokens salida:   456
🧠 Tokens TOTAL:    1,690
💰 Coste estimado:  €0.000223
🧾 ═══════════════════════════════════════════════════════════
```

## 7. Optimizaciones de Coste (Sprint 8)

| Optimización | Impacto |
|--------------|---------|
| Prompts compactados | -65% tokens instrucciones |
| Ventana deslizante chat (6 msgs) | -70% en conversaciones largas |
| Límites de contenido (8000 chars) | Control de entrada |
| Caché de análisis en PostgreSQL | Evita llamadas redundantes |
| Token Taximeter | Visibilidad de costes en tiempo real |

## 8. API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/news` | Listar noticias (paginado) |
| GET | `/api/news/:id` | Detalle de noticia |
| PATCH | `/api/news/:id/favorite` | Toggle favorito |
| POST | `/api/ingest/news` | Ingestar por categoría |
| POST | `/api/analyze/article` | Analizar artículo |
| POST | `/api/analyze/batch` | Análisis en batch |
| GET | `/api/analyze/stats` | Estadísticas |
| POST | `/api/chat/article` | Chat RAG |
| GET | `/api/search?q=...` | Búsqueda semántica |
| GET | `/health` | Estado de servicios |

## 9. Categorías RSS

| Categoría | Medios |
|-----------|--------|
| general | El País, El Mundo, 20 Minutos |
| internacional | El País, El Mundo |
| deportes | AS, Marca, Mundo Deportivo |
| economia | 20 Minutos, El País, El Economista |
| politica | Europa Press, El País |
| ciencia | El País, 20 Minutos |
| tecnologia | 20 Minutos, El Mundo, Xataka |
| cultura | El País, 20 Minutos |

## 10. Capacidades del Sistema

1. ✅ Ingesta Multi-fuente (9 medios, 8 categorías)
2. ✅ Análisis de Sesgo IA (-10 a +10)
3. ✅ Detector de Bulos (reliabilityScore + factCheck)
4. ✅ Clickbait Score (0-100)
5. ✅ Búsqueda Semántica (embeddings 768d)
6. ✅ Chat RAG Híbrido
7. ✅ Chat con Google Search Grounding
8. ✅ Dashboard Analítico
9. ✅ Sistema de Favoritos
10. ✅ Seguridad (XSS, CORS, Rate Limit)
11. ✅ Optimización de Costes (-64%)
12. ✅ Token Taximeter (auditoría en tiempo real)
13. ✅ Testing de Carga (k6)

## 11. Sprints Completados

| Sprint | Descripción | Fecha |
|--------|-------------|-------|
| 1 | Cimientos y Arquitectura | 2026-01-28 |
| 2 | El Cerebro de la IA (Gemini) | 2026-01-29 |
| 3 | La Capa de Experiencia (UI) | 2026-01-29 |
| 4 | La Memoria Vectorial (ChromaDB) | 2026-01-30 |
| 5 | Búsqueda Semántica (UI) | 2026-01-30 |
| 5.2 | Categorías RSS (8 categorías) | 2026-01-30 |
| 6 | Página de Detalle + Análisis IA | 2026-01-30 |
| 6.3 | Sistema de Favoritos | 2026-01-30 |
| 7.1 | Chat RAG + Seguridad + Auditoría | 2026-01-31 |
| 7.2 | UX + Chat Híbrido + Auto-Favoritos | 2026-01-31 |
| 8 | Optimización de Costes Gemini (-64%) | 2026-02-02 |
| 8.1 | Suite de Tests de Carga (k6) | 2026-02-02 |
| **8.2** | **Token Taximeter** | **2026-02-02** |

---

**Repositorio:** https://github.com/David-LS-Bilbao/PROYECTO-MASTER-IA
