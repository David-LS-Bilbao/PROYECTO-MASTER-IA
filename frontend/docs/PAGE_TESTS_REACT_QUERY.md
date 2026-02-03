# Tests de page.tsx - React Query Integration

**Sprint 13 - Fase C (Frontend Moderno)**  
**Archivo:** `frontend/tests/app/page.spec.tsx`  
**Status:** ✅ 17/17 tests pasando (100%)

---

## 📊 Resumen Ejecutivo

Se crearon **17 tests end-to-end** para validar la integración del componente `page.tsx` con los hooks de React Query (`useNews`, `useDashboardStats`). Todos los tests pasan correctamente y cubren los siguientes escenarios:

- ✅ Estados de carga (loading skeletons)
- ✅ Estados de error (mensajes de error)
- ✅ Renderizado de datos (NewsCards)
- ✅ Interacción con filtros de categoría
- ✅ Protección de ruta (auth guard)
- ✅ Integración con hooks personalizados

---

## 🎯 Cobertura de Tests

### 1. Estado de Carga (Loading State) - 2 tests

#### Test 1.1: `debe mostrar skeletons cuando useNews está cargando`
```typescript
// Verifica que aparecen 6 elementos skeleton (divs con clase animate-pulse)
// cuando useNews.isLoading = true
```

**Assertions:**
- ✅ Elementos con clase `animate-pulse` presentes
- ✅ CategoryPills deshabilitado durante loading (`data-disabled="true"`)

---

#### Test 1.2: `debe ocultar skeletons cuando los datos están listos`
```typescript
// Verifica transición loading → success state
// (skeletons desaparecen, noticias aparecen)
```

**Assertions:**
- ✅ Skeletons ya no presentes
- ✅ Títulos de noticias renderizados

---

### 2. Estado de Error (Error State) - 2 tests

#### Test 2.1: `debe mostrar mensaje de error cuando useNews falla`
```typescript
// Mock: useNews retorna { isError: true, error: new Error('Failed to fetch') }
```

**Assertions:**
- ✅ Mensaje "Error al cargar las noticias" visible
- ✅ Mensaje de error específico "Failed to fetch news from backend" visible
- ✅ Hint de backend URL "http://localhost:3000" visible

---

#### Test 2.2: `debe mostrar error genérico si no hay mensaje específico`
```typescript
// Mock: error es string en vez de Error instance
```

**Assertions:**
- ✅ Mensaje genérico "Error al cargar las noticias" presente

---

### 3. Renderizado de Datos (Success State) - 4 tests

#### Test 3.1: `debe renderizar 2 NewsCards cuando hay 2 artículos`
```typescript
// Mock: newsData con 2 artículos válidos
```

**Assertions:**
- ✅ 2 elementos con `data-testid="news-card"` presentes
- ✅ Título "Breaking News: AI Revolution" visible
- ✅ Título "Tech Giants Announce New Products" visible

---

#### Test 3.2: `debe mostrar contador de noticias en header`
```typescript
// Verifica que stats de useDashboardStats se muestran en header
```

**Assertions:**
- ✅ "100" (totalArticles) visible
- ✅ "80" (analyzedCount) visible 2+ veces (también en coverage%)
- ✅ Coverage% presente

---

#### Test 3.3: `debe mostrar "Empty State" cuando no hay noticias`
```typescript
// Mock: newsData.data = [] (array vacío)
```

**Assertions:**
- ✅ Mensaje "No hay noticias en general" presente
- ✅ Hint de acción visible

---

#### Test 3.4: `debe mostrar mensaje específico para favoritos vacíos`
```typescript
// Mock: category = 'favorites' + newsData.data = []
```

**Assertions:**
- ✅ Mensaje "No tienes favoritos todavía" presente
- ✅ Hint "Marca noticias como favoritas para verlas aquí" presente

---

### 4. Interacción con Filtros de Categoría - 4 tests

#### Test 4.1: `debe llamar a useNews con categoría "general" por defecto`
```typescript
// Verifica que al montar el componente, useNews recibe category='general'
```

**Assertions:**
- ✅ `mockUseNews` llamado con `{ category: 'general', limit: 50, offset: 0 }`

---

#### Test 4.2: `debe actualizar URL al cambiar de categoría`
```typescript
// Simula click en botón "Technology"
// Verifica que router.push se llama con nueva URL
```

**Assertions:**
- ✅ `mockPush` llamado con `'/?category=technology', { scroll: false }`

---

#### Test 4.3: `debe sincronizar categoría desde URL al montar`
```typescript
// Mock: URL search params contienen category=business
// Verifica que CategoryPills muestra "business" como seleccionado
```

**Assertions:**
- ✅ CategoryPills tiene `data-selected="business"`

---

#### Test 4.4: `debe usar "general" si la categoría de URL es inválida`
```typescript
// Mock: URL search params contienen category=invalid-category
// Verifica fallback a "general"
```

**Assertions:**
- ✅ `mockUseNews` llamado con `{ category: 'general', ... }`

---

### 5. Protección de Ruta (Auth Guard) - 3 tests

#### Test 5.1: `debe redirigir a /login si no hay usuario autenticado`
```typescript
// Mock: useAuth retorna { user: null, loading: false }
```

**Assertions:**
- ✅ `mockPush` llamado con `'/login'`

---

#### Test 5.2: `NO debe renderizar contenido si usuario no autenticado`
```typescript
// Mock: user = null
// Verifica que el componente devuelve null (no renderiza nada)
```

**Assertions:**
- ✅ NewsCard no presente en DOM

---

#### Test 5.3: `debe mostrar loading spinner mientras verifica auth`
```typescript
// Mock: useAuth retorna { user: null, loading: true }
```

**Assertions:**
- ✅ Texto "Cargando Verity..." visible
- ✅ Texto "Verificando sesión" visible

---

### 6. Integración con useNews Hook - 2 tests

#### Test 6.1: `debe pasar los parámetros correctos a useNews`
```typescript
// Verifica que la firma del hook es correcta
```

**Assertions:**
- ✅ `mockUseNews` llamado 1 vez
- ✅ Params contienen `{ category: string, limit: 50, offset: 0 }`

---

#### Test 6.2: `debe refetchear automáticamente cuando cambia category (queryKey dinámico)`
```typescript
// Simula cambio de categoría (general → technology)
// Verifica que useNews se llama con nueva categoría
```

**Assertions:**
- ✅ `mockUseNews` llamado con `{ category: 'technology', limit: 50, offset: 0 }`

---

## 🛠️ Configuración de Mocks

### Mocks Implementados

```typescript
// 1. Next.js Navigation
const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => ({ get: (key) => mockSearchParams.get(key) }),
}));

// 2. Auth Context
const mockUseAuth = vi.fn();
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// 3. React Query Hooks
const mockUseNews = vi.fn();
const mockUseDashboardStats = vi.fn();

vi.mock('@/hooks/useNews', () => ({
  useNews: (params) => mockUseNews(params),
}));

vi.mock('@/hooks/useDashboardStats', () => ({
  useDashboardStats: () => mockUseDashboardStats(),
}));

// 4. Componentes Pesados (simplificados)
vi.mock('@/components/news-card', () => ({ ... }));
vi.mock('@/components/layout', () => ({ ... }));
vi.mock('@/components/category-pills', () => ({ ... }));
```

---

## 📦 Data de Test

### Mock NewsArticle

```typescript
const createMockArticle = (id: string, overrides?: Partial<NewsArticle>) => ({
  id,
  title: `Mock Article ${id}`,
  description: `Description for article ${id}`,
  source: 'Mock News Source',
  url: `https://example.com/article-${id}`,
  publishedAt: '2026-02-03T10:00:00.000Z',
  category: 'general',
  imageUrl: `https://example.com/image-${id}.jpg`,
  biasScore: 0.5,
  reliabilityScore: 0.8,
  embedding: null,
  isFavorite: false,
  ...overrides,
});
```

### Mock NewsResponse

```typescript
const mockNewsResponse: NewsResponse = {
  data: [
    createMockArticle('1', { title: 'Breaking News: AI Revolution' }),
    createMockArticle('2', { title: 'Tech Giants Announce New Products' }),
  ],
  pagination: { total: 2, limit: 50, offset: 0, hasMore: false },
};
```

---

## 🎓 Lecciones Aprendidas

### 1. **Mocks con Vitest Factory Functions**

❌ **INCORRECTO (causa "Cannot access before initialization"):**
```typescript
const mockUseNews = vi.fn();
vi.mock('@/hooks/useNews', () => ({
  useNews: mockUseNews, // ❌ mockUseNews no está disponible en tiempo de hoisting
}));
```

✅ **CORRECTO (usar factory function):**
```typescript
const mockUseNews = vi.fn();
vi.mock('@/hooks/useNews', () => ({
  useNews: (params: any) => mockUseNews(params), // ✅ Factory function
}));
```

---

### 2. **Testing Library - Elementos Duplicados**

❌ **INCORRECTO (falla si el texto aparece múltiples veces):**
```typescript
expect(screen.getByText(/80/i)).toBeInTheDocument();
```

✅ **CORRECTO (usar getAllByText o ser más específico):**
```typescript
const statsTexts = screen.getAllByText(/80/i);
expect(statsTexts.length).toBeGreaterThanOrEqual(2);
```

---

### 3. **Buscar Skeletons por Clase CSS**

❌ **INCORRECTO (testid no existe en código legacy):**
```typescript
const skeletons = screen.getAllByTestId('loading-spinner');
```

✅ **CORRECTO (filtrar por clase CSS):**
```typescript
const skeletons = screen.getAllByRole('generic').filter(el => 
  el.className.includes('animate-pulse')
);
```

---

## 🚀 Comandos de Ejecución

```bash
# Ejecutar solo tests de page.tsx
npm test -- page.spec.tsx --run

# Ejecutar todos los tests del frontend
npm test -- --run

# Ejecutar en watch mode (desarrollo)
npm test -- page.spec.tsx
```

---

## 📊 Métricas de Tests

| Métrica | Valor |
|---------|-------|
| **Total Tests** | 17 |
| **Tests Pasando** | 17 (100%) |
| **Tests Fallando** | 0 |
| **Duración** | ~450ms |
| **Cobertura** | Estados de carga, error, success, interacción, auth |
| **Suites** | 6 (Loading, Error, Success, Filters, Auth, Integration) |

---

## 🔜 Mejoras Futuras (Sprint 14)

1. **Tests de Mutation Hooks:**
   - `useFavoriteMutation` tests
   - `useAnalyzeMutation` tests
   - Optimistic UI validation

2. **Tests de Paginación:**
   - Load more functionality
   - Infinite scroll (si se implementa)

3. **Tests de DevTools:**
   - Query cache inspection
   - Stale time validation
   - GC time validation

4. **MSW Integration:**
   - Mock Service Worker para API mocking
   - Respuestas HTTP realistas
   - Error scenarios (network failures, timeouts)

---

**Autor:** GitHub Copilot (Claude Sonnet 4.5)  
**Fecha:** 2026-02-03  
**Estado:** ✅ 17/17 tests pasando - Suite completa
