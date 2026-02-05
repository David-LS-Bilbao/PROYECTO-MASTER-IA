# Sprint 16 - UX Polish: Estrategia de Freshness

**Status**: ✅ COMPLETADO
**Date**: 2026-02-05
**Type**: Frontend Optimization - News Freshness Strategy

---

## 📋 Objetivo

Optimizar la UX de lectura de noticias para que la aplicación se sienta **"viva"** y muestre siempre el contenido más reciente sin necesidad de recarga manual.

---

## 🎯 Problema Resuelto

**ANTES**:
```
❌ Usuario debe recargar manualmente para ver últimas noticias
❌ Al cambiar de categoría, muestra datos cacheados viejos (hasta 60s)
❌ Al volver a la pestaña, no actualiza automáticamente
❌ No hay diferencia entre favoritos (estáticos) y noticias (dinámicas)
❌ No hay forma de forzar refresh manual
```

**DESPUÉS**:
```
✅ Al cambiar de categoría → Refetch automático en background
✅ Al volver a la pestaña → Verificación automática de nuevas noticias
✅ Al reconectar internet → Actualización inmediata
✅ Favoritos con caché más larga (2 min) vs Noticias (30s)
✅ Hook useNewsRefresh() para refresh manual (botón "Actualizar")
✅ Logging detallado para debugging de freshness
```

---

## 🏗️ Arquitectura de Freshness

```
┌─────────────────────────────────────────────────────────────┐
│                    REACT QUERY PROVIDER                      │
│                  (Global Configuration)                      │
│                                                              │
│  Defaults para toda la app:                                 │
│  • staleTime: 30s (reducido de 60s)                         │
│  • refetchOnMount: 'always' (antes: true)                   │
│  • refetchOnWindowFocus: true (antes: false)                │
│  • refetchOnReconnect: true                                 │
│  • gcTime: 5 min                                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                      useNews HOOK                            │
│               (Query-level Overrides)                        │
│                                                              │
│  FAVORITOS:                  NOTICIAS:                       │
│  • staleTime: 2 min          • staleTime: 30s (global)      │
│  • Solo cambian por          • Contenido dinámico           │
│    acciones del usuario      • Alta frecuencia de updates   │
│                                                              │
│  OPCIONAL:                                                  │
│  • refetchInterval: 60000ms (1 min)                         │
│  • Solo si el componente está visible y activo              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                   TRIGGERS DE REFETCH                        │
│                                                              │
│  AUTOMÁTICOS:                                               │
│  1. Cambio de categoría      → queryKey cambia → refetch    │
│  2. Componente remonta       → refetchOnMount='always'      │
│  3. Volver a pestaña         → refetchOnWindowFocus=true    │
│  4. Reconectar internet      → refetchOnReconnect=true      │
│  5. Datos stale + interact   → Auto-refetch en background   │
│                                                              │
│  MANUALES:                                                  │
│  6. useNewsRefresh().refresh() → Botón "Actualizar"         │
│  7. useInvalidateNews()      → Después de mutaciones        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Archivos Modificados

### ✅ `frontend/components/providers/query-provider.tsx` (+20 LOC)

**Cambios Principales**:

1. **staleTime: 60s → 30s**:
   ```typescript
   // ANTES
   staleTime: 60 * 1000, // 60s

   // DESPUÉS
   staleTime: 30 * 1000, // 30s
   ```

2. **refetchOnWindowFocus: false → true**:
   ```typescript
   // ANTES
   refetchOnWindowFocus: false,

   // DESPUÉS
   refetchOnWindowFocus: true,  // Al volver a la pestaña, verificar updates
   ```

3. **refetchOnMount: true → 'always'**:
   ```typescript
   // ANTES
   refetchOnMount: true,

   // DESPUÉS
   refetchOnMount: 'always',  // Siempre refetch al cambiar de categoría
   ```

**Resultado**: Configuración global más agresiva para freshness, optimizada para news app.

---

### ✅ `frontend/hooks/useNews.ts` (+60 LOC)

**Cambios Principales**:

1. **staleTime diferenciado por tipo de contenido**:
   ```typescript
   export function useNews(params: UseNewsParams = {}) {
     const { category = 'general', limit = 50, offset = 0, refetchInterval } = params;

     // Favoritos: 2 min (estático, solo cambia con acciones del usuario)
     // Noticias: 30s (dinámico, heredado del global)
     const staleTime = category === 'favorites' ? 2 * 60 * 1000 : undefined;

     return useQuery<NewsResponse>({
       queryKey: ['news', category, limit, offset],
       queryFn: async () => { /* ... */ },
       staleTime,
       refetchInterval,
       refetchIntervalInBackground: false, // Solo si pestaña activa
       // ...
     });
   }
   ```

2. **Parámetro refetchInterval opcional**:
   ```typescript
   export interface UseNewsParams {
     category?: CategoryId;
     limit?: number;
     offset?: number;
     refetchInterval?: number; // NEW: Para polling en background
   }
   ```

3. **Nuevo hook: useNewsRefresh()**:
   ```typescript
   export function useNewsRefresh() {
     const queryClient = useQueryClient();

     return {
       refresh: async (category?: CategoryId) => {
         if (category) {
           await queryClient.refetchQueries({
             queryKey: ['news', category],
             type: 'active',
           });
         } else {
           await queryClient.refetchQueries({
             queryKey: ['news'],
             type: 'active',
           });
         }
       },
       isRefreshing: queryClient.isFetching({ queryKey: ['news'] }) > 0,
     };
   }
   ```

4. **Logging mejorado**:
   ```typescript
   console.log('🌐 [useNews] staleTime:', staleTime ? `${staleTime / 1000}s` : 'global (30s)');
   ```

---

## 📊 Matriz de Freshness por Escenario

| Escenario | Trigger | Comportamiento | staleTime | Resultado |
|-----------|---------|----------------|-----------|-----------|
| **Cambiar de categoría** | queryKey cambia | Refetch automático | 30s (noticias) / 2min (favoritos) | ✅ Datos frescos inmediatos |
| **Volver a pestaña** | refetchOnWindowFocus | Verificar si stale → refetch | 30s / 2min | ✅ Actualización silenciosa |
| **Remontar componente** | refetchOnMount='always' | Refetch siempre | N/A | ✅ Siempre verifica BD |
| **Reconectar internet** | refetchOnReconnect | Refetch automático | N/A | ✅ Sincronización inmediata |
| **Navegación interna** | Caché válido | Usar caché (sin refetch) | < 30s | ⚡ Velocidad SPA |
| **Botón "Actualizar"** | useNewsRefresh() | Refetch forzado | N/A | ✅ Control manual del usuario |

---

## 🎯 Estrategia de Caché: 3 Niveles

### Nivel 1: Favoritos (Estático)
```typescript
{
  category: 'favorites',
  staleTime: 2 * 60 * 1000,  // 2 minutos
  refetchOnMount: 'always',   // Verificar al entrar
}
```

**Razón**: Los favoritos solo cambian con acciones del usuario (toggle fav), no por ingesta de noticias. Podemos permitir un caché más largo sin sacrificar UX.

### Nivel 2: Noticias Dinámicas (General, Categorías)
```typescript
{
  category: 'technology',
  staleTime: 30 * 1000,       // 30 segundos (global)
  refetchOnMount: 'always',   // Verificar al entrar
  refetchOnWindowFocus: true, // Verificar al volver a pestaña
}
```

**Razón**: Contenido dinámico que cambia con cada ingesta. El usuario espera ver lo más reciente.

### Nivel 3: Polling Activo (Opcional)
```typescript
{
  category: 'technology',
  refetchInterval: 60 * 1000, // Refetch cada 1 minuto
  refetchIntervalInBackground: false, // Solo si visible
}
```

**Razón**: Para vistas principales donde el usuario pasa mucho tiempo (dashboard principal). No usar en modales/detalles.

---

## 🧪 Cómo Probar

### PASO 1: Verificar Refetch al Cambiar Categoría

1. **Abrir DevTools** → Console
2. **Navegar**: General → Tecnología → Deportes
3. **Observar logs**:
   ```
   📰 [useNews] Hook montado/actualizado. Category: technology
   🌐 [useNews] ========== EJECUTANDO queryFn ==========
   🌐 [useNews] staleTime: global (30s)
   ✅ [useNews] Fetch completado en 120ms. Artículos: 15
   ```

**Resultado esperado**: Cada cambio de categoría ejecuta un fetch, incluso si los datos están en caché.

### PASO 2: Verificar Refetch al Volver a Pestaña

1. **Entrar a la app** → Navegar a una categoría
2. **Cambiar a otra pestaña** (esperar > 30s para que sea stale)
3. **Volver a la pestaña** de Verity News
4. **Observar**: Si los datos son stale, verás un refetch automático

**Resultado esperado**: Al volver, si los datos tienen > 30s, se refetchean automáticamente.

### PASO 3: Verificar Caché Válido

1. **Entrar a General** → Esperar que cargue
2. **Ir a Tecnología** → Esperar que cargue
3. **Volver a General inmediatamente** (< 30s)
4. **Observar**: No hay fetch nuevo, usa caché

**Resultado esperado**: Si vuelves rápido (< 30s), no refetchea (velocidad SPA).

### PASO 4: Probar useNewsRefresh() (Opcional)

1. **Añadir botón temporal** en un componente:
   ```tsx
   import { useNewsRefresh } from '@/hooks/useNews';

   function NewsHeader() {
     const { refresh, isRefreshing } = useNewsRefresh();

     return (
       <button
         onClick={() => refresh('technology')}
         disabled={isRefreshing}
       >
         {isRefreshing ? 'Actualizando...' : '🔄 Actualizar'}
       </button>
     );
   }
   ```

2. **Hacer clic** en el botón
3. **Observar**: Refetch forzado inmediato

---

## 📈 Comparativa: Antes vs Después

| Aspecto | ANTES (Sprint 13) | DESPUÉS (Sprint 16) |
|---------|-------------------|---------------------|
| **staleTime** | 60s (global) | 30s (noticias) / 2min (favoritos) |
| **Refetch al cambiar categoría** | Solo si stale (> 60s) | ✅ Siempre (`refetchOnMount: 'always'`) |
| **Refetch al volver a pestaña** | ❌ Deshabilitado | ✅ Si stale (`refetchOnWindowFocus: true`) |
| **Refetch al reconectar** | ✅ Habilitado | ✅ Habilitado |
| **Refresh manual** | ❌ No disponible | ✅ `useNewsRefresh()` |
| **Diferencia por tipo** | ❌ Mismo staleTime | ✅ Favoritos vs Noticias |
| **Logging de freshness** | Básico | ✅ Detallado (staleTime, timings) |
| **Polling opcional** | ❌ | ✅ `refetchInterval` param |

---

## 🚨 Consideraciones de Performance

### ¿Esto generará demasiados fetches?

**NO**, porque:

1. **placeholderData: keepPreviousData** → Evita parpadeos, muestra datos anteriores mientras refetchea
2. **gcTime: 5 min** → Los datos en caché se reutilizan si el usuario vuelve rápido
3. **refetchOnMount: 'always'** → Solo refetchea queries **activas** (montadas), no todas
4. **refetchOnWindowFocus** → Solo si los datos son **stale** (> 30s)
5. **refetchIntervalInBackground: false** → Polling solo si la pestaña está activa

### Impacto en la BD

- **Antes**: ~1 query cada 60s por usuario
- **Después**: ~1 query cada 30s por usuario (peor caso)
- **Incremento**: ~2x queries, pero la UX mejora significativamente

**Mitigación**: Si el tráfico aumenta mucho, podemos:
- Aumentar staleTime a 45s (balance entre 30s y 60s)
- Implementar rate limiting por IP en el backend
- Añadir Redis para caché de queries frecuentes

---

## 🔧 Configuración Avanzada (Opcional)

### Añadir Polling a Vista Principal

Si queremos que la vista principal de noticias se actualice automáticamente cada 1 minuto:

```tsx
// En NewsListPage.tsx
function NewsListPage() {
  const { data, isLoading } = useNews({
    category: 'general',
    limit: 50,
    refetchInterval: 60 * 1000, // Refetch cada 1 min
  });

  // ...
}
```

**IMPORTANTE**: Solo usar en la vista principal, NO en modales o detalles.

### Añadir Botón de Refresh Manual

```tsx
import { useNewsRefresh } from '@/hooks/useNews';

function NewsHeader({ currentCategory }: { currentCategory: CategoryId }) {
  const { refresh, isRefreshing } = useNewsRefresh();

  return (
    <div className="flex items-center gap-2">
      <h1>Noticias de {currentCategory}</h1>
      <button
        onClick={() => refresh(currentCategory)}
        disabled={isRefreshing}
        className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
      >
        {isRefreshing ? (
          <span className="animate-spin">⟳</span>
        ) : (
          <span>🔄</span>
        )}
      </button>
    </div>
  );
}
```

### Indicador de "Actualizando en Background"

```tsx
function NewsListPage() {
  const { data, isLoading, isFetching } = useNews({ category: 'general' });

  return (
    <div>
      {isFetching && !isLoading && (
        <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow">
          Actualizando noticias...
        </div>
      )}

      {/* Lista de noticias */}
    </div>
  );
}
```

**Diferencia**:
- `isLoading`: Primer fetch (pantalla de carga completa)
- `isFetching`: Cualquier fetch (incluyendo background refetch)

---

## 🎓 Conceptos Clave

### ¿Qué es staleTime?

**staleTime** es el tiempo (en ms) que React Query considera que los datos son "frescos" antes de marcarlos como "stale" (obsoletos).

- **Datos frescos**: No se refetchean, se usan de caché inmediatamente
- **Datos stale**: Se usan de caché primero, pero se refetchean en background

**Ejemplo**:
```
staleTime: 30000 (30s)

0s  → Usuario entra a General     → Fetch (no hay caché)
5s  → Usuario va a Tecnología     → Fetch (nueva categoría)
10s → Usuario vuelve a General    → Caché (datos frescos, < 30s)
40s → Usuario vuelve a General    → Caché + Refetch bg (stale, > 30s)
```

### ¿Qué es refetchOnMount?

Controla si React Query debe refetchear cuando un componente se monta:

- `refetchOnMount: true` → Refetch solo si los datos son **stale**
- `refetchOnMount: 'always'` → Refetch **siempre**, incluso si los datos son frescos
- `refetchOnMount: false` → Nunca refetch al montar

**Elegimos `'always'`** porque queremos que cambiar de categoría siempre verifique la BD, incluso si acabas de visitar esa categoría hace 10s.

### ¿Qué es gcTime (antes cacheTime)?

**gcTime** (Garbage Collection Time) es el tiempo que React Query mantiene los datos en memoria **después** de que la query se vuelva inactiva (sin componentes montados).

- Si vuelves a una query dentro del gcTime, se usa de caché inmediatamente
- Después del gcTime, los datos se eliminan de memoria → fetch nuevo

**Ejemplo**:
```
gcTime: 5 * 60 * 1000 (5 min)

Usuario en General (query activa)
  ↓
Usuario va a Tecnología (General inactiva, pero en memoria)
  ↓
Usuario vuelve a General en < 5 min → Usa caché
  ↓
Usuario vuelve a General en > 5 min → Fetch nuevo (caché eliminado)
```

---

## 📚 Recursos

- [TanStack Query - Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)
- [TanStack Query - Window Focus Refetching](https://tanstack.com/query/latest/docs/framework/react/guides/window-focus-refetching)
- [TanStack Query - Stale Time vs Cache Time](https://tkdodo.eu/blog/practical-react-query#the-defaults-explained)

---

## 🚀 Próximos Pasos (Opcional)

1. **Ingesta Inteligente Condicional**:
   - Detectar si la BD está "vieja" (última actualización > 1 hora)
   - Disparar ingesta silenciosa en background
   - Mostrar toast: "Buscando nuevas noticias..."

2. **Pull to Refresh (Mobile)**:
   - Gesto de pull-to-refresh en mobile
   - Usar `useNewsRefresh()` internamente

3. **Optimistic Updates**:
   - Al marcar como favorito, actualizar UI inmediatamente
   - Rollback si el servidor falla

4. **Offline Support**:
   - Persistir caché en localStorage/IndexedDB
   - Funcionar offline con datos cacheados

---

**Completado por**: Senior Frontend Architect
**Fecha**: 2026-02-05
**Próximo**: Sprint 16 - Paso 2 - Pull to Refresh & Optimistic Updates
