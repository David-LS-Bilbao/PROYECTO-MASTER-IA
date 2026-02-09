# Sprint 19.6 - Refinamiento de Navegación y Usabilidad

## Objetivo
Mejorar la experiencia de usuario (UX) refinando la navegación de la aplicación con mejoras específicas que faciliten el uso del Infinite Scroll y el acceso a funcionalidades clave.

---

## TAREA 1: Botón "Volver Arriba" (Scroll To Top) ✅

### Problema
Con el Infinite Scroll implementado en Sprint 20, los usuarios pueden desplazarse hacia abajo durante mucho tiempo. Sin embargo, no existe una forma rápida de volver al inicio de la página.

### Solución Implementada

#### Componente ScrollToTop
**Archivo**: `frontend/components/ui/scroll-to-top.tsx` (NUEVO)

**Características**:
- ✅ Detecta scroll en **contenedor interno** (`main .overflow-y-auto`)
- ✅ Aparece cuando `scrollTop > 300px`
- ✅ Scroll suave animado al hacer click
- ✅ Transiciones fade-in/fade-out elegantes
- ✅ Posición fixed en esquina inferior derecha
- ✅ Accesibilidad completa (aria-label, title)

#### Integración
**Archivo**: `frontend/app/page.tsx`

```typescript
import { ScrollToTop } from '@/components/ui/scroll-to-top';

// Renderizado dentro de <main>
<main className="flex-1 flex flex-col overflow-hidden lg:ml-0">
  {/* ... contenido ... */}

  {/* Scroll to Top Button (Sprint 19.6) */}
  <ScrollToTop />
</main>
```

**IMPORTANTE**: El botón se renderiza dentro de `<main>` porque la página usa un contenedor con scroll interno (`overflow-y-auto`), no `window.scroll`.

#### Tests
**Archivo**: `frontend/__tests__/components/ui/scroll-to-top.test.tsx` (NUEVO)

- ✅ 8 tests unitarios con Vitest + Testing Library
- ✅ Cubre: visibilidad, scroll, accesibilidad, clases CSS

---

## TAREA 2: Header Limpio ✅

### Estado Actual
El header ya está limpio (Sprint 19.3-20) con diseño estilo Google News:
- ✅ Logo/Brand (izquierda)
- ✅ Search Bar waterfall (centro)
- ✅ Stats badge (derecha, opcional)

**Sin cambios necesarios** - Ya cumple con el diseño minimalista requerido.

---

## TAREA 3: Chat General con IA ✅

### Problema Original
El botón "Chat IA" en el sidebar daba error 404 porque no existía la ruta `/chat`. Se necesitaba implementar un chat general que permitiera consultas sobre **toda la base de datos de noticias**.

### Solución Implementada: RAG General con Fallback

#### Backend (Clean Architecture)

##### 1. Use Case - Chat General
**Archivo**: `backend/src/application/use-cases/chat-general.usecase.ts` (NUEVO)

**Características**:
- ✅ RAG sobre **toda la base de datos** (no filtrado por artículo)
- ✅ Consulta ChromaDB con embedding de la pregunta
- ✅ Recupera hasta **5 artículos relevantes** (más contexto que chat individual)
- ✅ **FALLBACK ROBUSTO**: Si ChromaDB falla, usa artículos recientes de PostgreSQL
- ✅ Optimización de costes: Máx 1500 chars por documento

**Flujo con Fallback**:
```
Pregunta → ChromaDB (embeddings)
           ↓ ❌ Falla
           → Prisma (últimos 5 artículos con análisis)
           ↓ ✅ Éxito
           → Gemini (genera respuesta con contexto)
```

##### 2. Controller
**Archivo**: `backend/src/infrastructure/http/controllers/chat.controller.ts`

```typescript
async chatGeneral(req: Request, res: Response): Promise<void> {
  const validatedInput = chatGeneralSchema.parse(req.body);
  const result = await this.chatGeneralUseCase.execute(validatedInput);

  res.status(200).json({
    success: true,
    data: {
      response: result.response,
      sourcesCount: result.sourcesCount, // Número de artículos consultados
    },
  });
}
```

##### 3. Routes
**Archivo**: `backend/src/infrastructure/http/routes/chat.routes.ts`

```typescript
router.post('/general', (req, res) => chatController.chatGeneral(req, res));
```

**Endpoint**: `POST /api/chat/general`
**Body**: `{ messages: Array<{ role: 'user' | 'assistant', content: string }> }`

##### 4. Schema Validation
**Archivo**: `backend/src/infrastructure/http/schemas/chat.schema.ts`

```typescript
export const chatGeneralSchema = z.object({
  messages: z
    .array(chatMessageSchema)
    .min(1, 'at least one message is required')
    .max(50, 'cannot exceed 50 messages in conversation'),
});
```

##### 5. Dependency Injection
**Archivo**: `backend/src/infrastructure/config/dependencies.ts`

```typescript
const chatGeneralUseCase = new ChatGeneralUseCase(
  this.geminiClient,
  this.chromaClient,
  this.newsRepository // ✅ Fallback cuando ChromaDB no disponible
);
```

#### Frontend (React + Next.js)

##### 1. API Client
**Archivo**: `frontend/lib/api.ts`

```typescript
export interface ChatGeneralResponse {
  success: boolean;
  data: {
    response: string;
    sourcesCount: number;
  };
  message: string;
}

export async function chatGeneral(
  messages: ChatMessage[]
): Promise<ChatGeneralResponse> {
  const res = await fetch(`${API_BASE_URL}/api/chat/general`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) throw new Error('Chat failed');
  return res.json();
}
```

##### 2. Component - General Chat Drawer
**Archivo**: `frontend/components/general-chat-drawer.tsx` (NUEVO)

**Características**:
- ✅ Sheet/Drawer deslizante desde la derecha
- ✅ Muestra **número de artículos consultados** (`sourcesCount`)
- ✅ Ejemplos de preguntas sugeridas en estado vacío
- ✅ Auto-scroll al enviar mensajes
- ✅ **Auto-reset**: Limpia el chat al cerrar (300ms delay)
- ✅ Loading state: "Analizando noticias..."

**Ejemplos de preguntas**:
- "¿Cuáles son las noticias más importantes de hoy?"
- "¿Qué se dice sobre tecnología?"
- "Resume las noticias de política"

##### 3. Integration - Page Layout
**Archivo**: `frontend/app/page.tsx`

```typescript
const [isChatOpen, setIsChatOpen] = useState(false);

// Sidebar con callback
<Sidebar
  onOpenDashboard={() => setIsDashboardOpen(true)}
  onOpenSources={() => setIsSourcesOpen(true)}
  onOpenChat={() => setIsChatOpen(true)} // ✅ NUEVO
/>

// General Chat Drawer
<GeneralChatDrawer
  isOpen={isChatOpen}
  onOpenChange={setIsChatOpen}
/>
```

##### 4. Sidebar - Chat IA Button
**Archivo**: `frontend/components/layout/sidebar.tsx`

```typescript
const navItems = [
  {
    label: 'Últimas noticias',
    icon: Newspaper,
    onClick: handleRefreshNews,
  },
  {
    label: 'Favoritos',
    href: '/?category=favorites',
    icon: Heart,
  },
  {
    label: 'Chat IA', // ✅ RESTAURADO con funcionalidad
    icon: MessageSquare,
    onClick: () => {
      onOpenChat?.();
      setIsOpen(false);
    },
  },
  // ... más items
];
```

**Posición**: Entre "Favoritos" e "Inteligencia de Medios"

---

## Arquitectura del Chat General

### Diferencias: Chat General vs Chat de Artículo

| Característica | Chat General | Chat de Artículo |
|----------------|--------------|------------------|
| **Contexto** | Toda la BD (5 docs max) | Solo 1 artículo (3 docs max) |
| **Endpoint** | `/api/chat/general` | `/api/chat/article` |
| **Parámetros** | `messages` | `articleId` + `messages` |
| **RAG Docs** | 5 artículos relevantes | 3 fragmentos del artículo |
| **Chars/Doc** | 1500 | 2000 |
| **Fallback** | ✅ BD reciente (Prisma) | ✅ Contenido del artículo |
| **Acceso** | Sidebar → "Chat IA" | Botón flotante en detalle |

### Fallback Strategy

#### Cuando ChromaDB falla:
```typescript
// 1. Intenta ChromaDB con embeddings
try {
  const results = await chromaClient.querySimilarWithDocuments(embedding, 5);
  // Usa documentos similares semánticamente
} catch (error) {
  // 2. FALLBACK: Usa artículos recientes de BD
  const recentArticles = await newsRepository.findAll({ limit: 5 });
  // Formatea como contexto con summary/description
}
```

**Ventajas del Fallback**:
- ✅ **Disponibilidad**: Funciona sin ChromaDB
- ✅ **Datos reales**: Usa artículos analizados de PostgreSQL
- ✅ **Sin costes adicionales**: No genera embeddings innecesarios
- ✅ **Degradación elegante**: Usuario no nota el cambio

---

## UX Features

### Chat General

- 📰 **Indicador de contexto**: "📰 Consultando 5 artículos relevantes"
- 💡 **Sugerencias**: Ejemplos de preguntas en estado vacío
- ⚡ **Loading state**: "Analizando noticias..." con spinner
- 🔄 **Auto-reset**: Limpia conversación al cerrar drawer
- ♿ **Accesibilidad**: Auto-focus en input, botón de cerrar
- 🎨 **Diseño consistente**: Misma UI que chat de artículos

### Scroll To Top

- ⚡ **Transiciones suaves**: 300ms fade + slide
- 🎯 **Umbral inteligente**: Solo aparece tras 300px de scroll
- 🎨 **Estilo moderno**: Circular azul con sombra
- ♿ **Accesible**: aria-label y title para lectores de pantalla

---

## Testing

### Tests Creados

1. **`frontend/__tests__/components/ui/scroll-to-top.test.tsx`**
   - 8 tests unitarios
   - Cubre visibilidad, scroll, accesibilidad, estilos

2. **`frontend/__tests__/components/date-separator.test.tsx`**
   - 11 tests (Sprint 19.5)

3. **`frontend/__tests__/lib/date-utils.test.ts`**
   - 13 tests (Sprint 19.5)

### Testing Manual

#### Scroll To Top
1. Abrir [http://localhost:3001](http://localhost:3001)
2. Hacer scroll hacia abajo >300px
3. ✅ Verificar botón flotante aparece (esquina inferior derecha)
4. Click en botón → Scroll suave al top
5. ✅ Verificar botón desaparece al llegar arriba

#### Chat General
1. Click en **"Chat IA"** en sidebar
2. ✅ Se abre drawer desde la derecha
3. Hacer pregunta: "¿Cuáles son las noticias más recientes?"
4. ✅ Muestra "📰 Consultando X artículos relevantes"
5. ✅ Respuesta generada con contexto de noticias reales
6. Cerrar drawer → ✅ Conversación se limpia automáticamente

---

## Archivos Creados

### Backend
1. `backend/src/application/use-cases/chat-general.usecase.ts` - Use case con RAG + fallback
2. `backend/src/infrastructure/http/schemas/chat.schema.ts` - Agregado `chatGeneralSchema`

### Frontend
1. `frontend/components/ui/scroll-to-top.tsx` - Botón flotante scroll to top
2. `frontend/components/general-chat-drawer.tsx` - Drawer de chat general
3. `frontend/__tests__/components/ui/scroll-to-top.test.tsx` - Tests del botón

### Documentación
1. `docs/Sprint-19.6.md` - Este archivo

---

## Archivos Modificados

### Backend
1. `backend/src/infrastructure/http/controllers/chat.controller.ts` - Agregado `chatGeneral()`
2. `backend/src/infrastructure/http/routes/chat.routes.ts` - Agregado `POST /api/chat/general`
3. `backend/src/infrastructure/config/dependencies.ts` - Inyección de `ChatGeneralUseCase`

### Frontend
1. `frontend/app/page.tsx` - Agregados imports, estado y render de `ScrollToTop` + `GeneralChatDrawer`
2. `frontend/components/layout/sidebar.tsx` - Agregado botón "Chat IA" en `navItems`
3. `frontend/lib/api.ts` - Agregadas interfaces y función `chatGeneral()`

---

## Mejoras de ChromaDB (Nota Técnica)

### Estado Actual
- ChromaDB configurado para `localhost:8000`
- **No está corriendo** por defecto
- Fallback funciona perfectamente sin ChromaDB

### Opciones de Deployment

**Opción A: Sin ChromaDB (Recomendado para desarrollo)**
- ✅ Fallback usa datos reales de PostgreSQL
- ✅ Sin dependencias adicionales
- ✅ Sin costes de embeddings
- ⚠️ Búsqueda por fecha (no semántica)

**Opción B: Con ChromaDB (Producción)**
```bash
# Iniciar ChromaDB
chroma run --path ./chroma_data --port 8000
```
- ✅ Búsqueda semántica inteligente
- ✅ Mejor relevancia de resultados
- ⚠️ Requiere servidor adicional
- ⚠️ Costes de embeddings (Gemini)

---

## Métricas de Éxito

### Cuantitativas (Esperadas)

- **Scroll To Top**:
  - % usuarios que hacen scroll >300px: ~80%
  - % usuarios que usan el botón: ~40%
  - Tiempo para volver arriba: -95% (de ~10s a ~0.5s)

- **Chat General**:
  - Clicks en "Chat IA": +∞ (antes 0, ahora funcional)
  - Tasa de éxito de queries: 100% (fallback garantiza disponibilidad)
  - Tiempo respuesta: ~3-5s con fallback, ~2-3s con ChromaDB

### Cualitativas

- ✅ **Disponibilidad**: Chat funciona sin ChromaDB
- ✅ **UX mejorada**: Scroll to top reduce fricción
- ✅ **Descubribilidad**: Chat visible en navegación
- ✅ **Robustez**: Fallback elimina puntos de fallo

---

## Conclusión

Sprint 19.6 implementa tres mejoras críticas de UX:

1. **Scroll To Top** ✅ - Facilita navegación en Infinite Scroll
2. **Header Limpio** ✅ - Ya estaba implementado (sin cambios)
3. **Chat General** ✅ - RAG sobre toda la BD con fallback robusto

**Resultado**: Aplicación más usable, resiliente y profesional.

### Highlights Técnicos

- 🚀 **Fallback Strategy**: Degradación elegante cuando ChromaDB falla
- 🎯 **Clean Architecture**: Use cases, repositories, DI container
- 🧪 **Testing**: 8 tests para ScrollToTop, 24 tests totales (Sprint 19.5+19.6)
- 📊 **Métricas**: Muestra número de artículos consultados

---

## Referencias

- [Nielsen Norman Group - Back to Top](https://www.nngroup.com/articles/back-to-top/)
- [Material Design - FAB](https://m3.material.io/components/floating-action-button)
- [Gemini API - Embeddings](https://ai.google.dev/gemini-api/docs/embeddings)
- [ChromaDB - Getting Started](https://docs.trychroma.com/getting-started)
