# Auditoría de Código - Verity News

**Fecha:** 31 Enero 2026
**Versión:** Sprint 7.1
**Estado:** Auditoría Completa

---

## Resumen Ejecutivo

El proyecto Verity News sigue una arquitectura Clean Architecture bien estructurada con separación clara de capas. Se identificaron algunos problemas de seguridad críticos y áreas de mejora.

### Puntuación General (Actualizado)

| Área | Puntuación | Estado |
|------|------------|--------|
| Arquitectura | 8/10 | Buena |
| Seguridad | 8/10 | ✅ Corregido |
| Tipos/TypeScript | 8/10 | ✅ Mejorado |
| Manejo de errores | 8/10 | ✅ Mejorado |
| Código limpio | 8/10 | Buena |

---

## 1. Arquitectura

### Estructura del Proyecto

```
backend/
├── src/
│   ├── domain/           # Entidades y contratos (interfaces)
│   │   ├── entities/     # NewsArticle, etc.
│   │   ├── services/     # IGeminiClient, IChromaClient, etc.
│   │   └── errors/       # Errores de dominio e infraestructura
│   ├── application/      # Casos de uso
│   │   └── use-cases/    # AnalyzeArticle, ChatArticle, IngestNews, etc.
│   ├── infrastructure/   # Implementaciones concretas
│   │   ├── external/     # GeminiClient, ChromaClient, JinaReader
│   │   ├── persistence/  # PrismaNewsRepository
│   │   └── config/       # DependencyContainer
│   └── presentation/     # Controladores HTTP (Express)
│       └── routes/       # news.routes.ts, analyze.routes.ts, etc.

frontend/
├── app/                  # Next.js 16 App Router
│   ├── news/[id]/        # Página de detalle de noticia
│   └── page.tsx          # Dashboard principal
├── components/           # Componentes React
│   ├── ui/               # Componentes base (shadcn/ui)
│   └── *.tsx             # Componentes específicos
└── lib/
    └── api.ts            # Cliente API tipado
```

### Evaluación de Clean Architecture

**Positivo:**
- Separación clara entre Domain, Application, Infrastructure y Presentation
- Interfaces en capa Domain para inversión de dependencias
- Use cases aislados con responsabilidades únicas
- Inyección de dependencias via DependencyContainer

**Áreas de mejora:**
- Algunos use cases tienen lógica de logging que podría abstraerse
- El DependencyContainer no usa un contenedor IoC formal (aceptable para el tamaño del proyecto)

---

## 2. Problemas de Seguridad (✅ CORREGIDOS)

### ~~CRÍTICO~~: Exposición de Credenciales ✅

**Archivo:** `backend/.env`

```env
# Estas claves NO deben estar en el repositorio
GEMINI_API_KEY=AIzaSy...
DATABASE_URL=postgresql://...
```

**Riesgo:** Las API keys de Gemini y credenciales de base de datos están expuestas si el .env se commitea accidentalmente.

**Recomendación:**
1. Verificar que `.env` está en `.gitignore`
2. Usar variables de entorno del sistema en producción
3. Considerar un servicio de secrets (AWS Secrets Manager, HashiCorp Vault)

### CRÍTICO: XSS Potencial

**Archivo:** `frontend/app/news/[id]/page.tsx:250`

```tsx
<div dangerouslySetInnerHTML={{ __html: article.content }} />
```

**Riesgo:** Si el contenido scrapeado contiene scripts maliciosos, se ejecutarán en el navegador del usuario.

**Recomendación:**
1. Sanitizar el HTML con una librería como `DOMPurify` antes de renderizar
2. O usar `react-markdown` para parsear el contenido como markdown

```tsx
// Ejemplo con DOMPurify
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content) }} />
```

### MEDIA: Sin Rate Limiting en API

**Archivo:** `backend/src/presentation/routes/*.ts`

Los endpoints de la API no tienen rate limiting implementado.

**Recomendación:**
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP
});

app.use('/api/', limiter);
```

### MEDIA: CORS Permisivo

**Archivo:** `backend/src/index.ts`

```typescript
app.use(cors()); // Permite todas las origenes
```

**Recomendación:**
```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}));
```

---

## 3. Problemas de Tipos

### Uso de `as any`

Se encontraron algunos usos de `as any` que reducen la seguridad de tipos:

**Archivo:** `backend/src/infrastructure/external/chroma.client.ts:218-221`

```typescript
title: (metadatas[index] as any)?.title || '',
source: (metadatas[index] as any)?.source || '',
```

**Recomendación:** Crear una interfaz para el tipo de metadata de ChromaDB:

```typescript
interface ChromaMetadata {
  title?: string;
  source?: string;
  publishedAt?: string;
  biasScore?: number;
}
```

### Tipos Faltantes para Grounding Metadata

**Archivo:** `backend/src/infrastructure/external/gemini.client.ts:253`

```typescript
const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
```

El SDK de Gemini no tiene tipos exportados para `groundingMetadata`.

**Recomendación:** Aceptable usar type assertion temporal mientras el SDK actualiza los tipos.

---

## 4. Bugs Potenciales

### Rate Limit sin Retry Automático

**Archivo:** `backend/src/infrastructure/external/gemini.client.ts:142-144`

Cuando Gemini devuelve 429 (rate limit), se lanza error pero no hay retry automático.

**Recomendación:** Implementar exponential backoff como en `generateEmbedding`:

```typescript
// Ya implementado en generateEmbedding - replicar en analyzeArticle
for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    // ... llamada API
  } catch (error) {
    if (attempt < maxRetries && isRetryableError(error)) {
      await delay(Math.pow(2, attempt) * 1000);
      continue;
    }
    throw error;
  }
}
```

### ChromaDB Fallback Silencioso

**Archivo:** `backend/src/index.ts:58-60`

```typescript
} catch (chromaError) {
  console.warn('ChromaDB initialization failed (search may not work):', (chromaError as Error).message);
}
```

Si ChromaDB falla al iniciar, la búsqueda semántica no funcionará pero el servidor sigue corriendo sin indicación clara al usuario.

**Recomendación:** Agregar un endpoint `/health` que muestre el estado de todos los servicios:

```typescript
app.get('/health', (req, res) => {
  res.json({
    api: 'healthy',
    database: prismaConnected,
    chromadb: chromaConnected,
    gemini: geminiAvailable,
  });
});
```

---

## 5. Mejoras Sugeridas

### Performance

1. **Caché de Análisis:** Implementar caché Redis para análisis de artículos frecuentes
2. **Batch Embeddings:** Procesar múltiples embeddings en una sola llamada cuando sea posible
3. **Connection Pooling:** Verificar configuración de pool de PostgreSQL en Prisma

### Arquitectura

1. **Event-Driven:** Considerar usar eventos para análisis asíncrono en lugar de análisis síncrono
2. **Queue System:** Implementar cola (Bull/BullMQ) para procesar análisis en background
3. **Logging Estructurado:** Reemplazar `console.log` con Winston o Pino para logs estructurados

### Testing

1. **Unit Tests:** Agregar tests unitarios para use cases
2. **Integration Tests:** Tests de integración para rutas API
3. **E2E Tests:** Playwright para el frontend

### Monitoreo

1. **APM:** Integrar New Relic, DataDog o Sentry
2. **Métricas:** Prometheus + Grafana para métricas de rendimiento
3. **Alertas:** Configurar alertas para errores críticos

---

## 6. Archivos Clave Revisados

| Archivo | Estado | Notas |
|---------|--------|-------|
| `backend/src/domain/entities/news-article.entity.ts` | OK | ArticleAnalysis bien definido |
| `backend/src/domain/services/gemini-client.interface.ts` | OK | Interfaces completas |
| `backend/src/domain/services/chroma-client.interface.ts` | OK | QueryResult para RAG |
| `backend/src/infrastructure/external/gemini.client.ts` | OK | RAG + análisis implementados |
| `backend/src/infrastructure/external/chroma.client.ts` | OK | querySimilarWithDocuments OK |
| `backend/src/application/use-cases/chat-article.usecase.ts` | OK | Pipeline RAG completo |
| `frontend/lib/api.ts` | OK | Tipos sincronizados |
| `frontend/app/news/[id]/page.tsx` | WARN | XSS potencial |
| `frontend/components/reliability-badge.tsx` | OK | Componente limpio |

---

## 7. Checklist de Acciones

### Urgentes (Seguridad) - ✅ COMPLETADOS

- [x] Verificar `.env` en `.gitignore` ✅ (ya incluido)
- [x] Sanitizar HTML con DOMPurify en frontend ✅ (`frontend/app/news/[id]/page.tsx`)
- [x] Configurar CORS restrictivo ✅ (`backend/src/infrastructure/http/server.ts`)
- [x] Implementar rate limiting ✅ (100 req/15min por IP)

### Importantes (Calidad) - ✅ COMPLETADOS

- [x] Reemplazar `as any` con tipos apropiados ✅ (interfaz `ChromaMetadata`)
- [x] Agregar retry automático en analyzeArticle ✅ (exponential backoff, 3 intentos)
- [x] Mejorar endpoint /health ✅ (muestra estado de database, chromadb, gemini)

### Deseables (Futuro)

- [ ] Agregar tests unitarios
- [ ] Implementar logging estructurado
- [ ] Configurar monitoreo APM

---

## Conclusión

El código está **bien estructurado** y sigue principios de Clean Architecture correctamente. Los problemas principales son de **seguridad** (XSS, credenciales, CORS) que deben abordarse antes de ir a producción.

La implementación del Sprint 7.1 (Chat RAG) está completa y funcional:
- `generateChatResponse` en GeminiClient
- `querySimilarWithDocuments` en ChromaClient
- Pipeline RAG en ChatArticleUseCase
- ReliabilityBadge en frontend

**Recomendación final:** Priorizar las correcciones de seguridad antes del despliegue.
