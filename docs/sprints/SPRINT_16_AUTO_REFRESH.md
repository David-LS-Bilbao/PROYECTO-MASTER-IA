# Sprint 16 - Auto Refresh: Ingesta Automática al Cambiar Categoría

**Status**: ✅ COMPLETADO
**Date**: 2026-02-05
**Type**: Frontend Optimization - Auto-Refresh & Auto-Ingesta

---

## 📋 Objetivo

Eliminar la necesidad de pulsar manualmente el botón "**Últimas noticias**" para ver contenido actualizado. La aplicación debe actualizarse automáticamente al:

1. **Cambiar de categoría** → Ingesta RSS + Refetch automático
2. **Recargar la página** → Refetch de BD (sin ingesta)
3. **Primera carga** → Refetch de BD (sin ingesta)

---

## 🎯 Problema Resuelto

**ANTES** (Reporte del usuario):
```
❌ Al cambiar de categoría, NO se actualizan las noticias
❌ El usuario debe pulsar "Últimas noticias" manualmente
❌ Al recargar la página, muestra datos viejos cacheados
❌ No hay actualización automática en ningún escenario
```

**DESPUÉS**:
```
✅ Al cambiar de categoría → Auto-ingesta RSS + Refetch (noticias frescas)
✅ Al recargar la página → Refetch de BD (datos actuales)
✅ Favoritos → Solo refetch (sin ingesta RSS innecesaria)
✅ Debounce de 300ms → Evita ingestas múltiples al cambiar rápido
✅ Primera carga → Refetch de BD (sin ingesta para carga rápida)
```

---

## 🏗️ Arquitectura del Auto-Refresh

```
┌─────────────────────────────────────────────────────────────┐
│                     USUARIO ACCIONES                         │
└─────────────────────────────────────────────────────────────┘
   │
   ├─ Primera Carga / Recarga de Página
   │  └─→ refetchOnMount: 'always' (QueryProvider)
   │      └─→ Refetch de BD (rápido, sin ingesta)
   │
   ├─ Cambiar de Categoría (General → Tecnología)
   │  └─→ handleCategoryChange()
   │      ├─→ setCategory(newCategory)
   │      └─→ router.push(url)
   │          └─→ useEffect detecta cambio de category
   │              ├─→ Debounce 300ms
   │              ├─→ Ingesta RSS (/api/ingest/news)
   │              └─→ invalidateNews(category)
   │                  └─→ Refetch de BD (con noticias nuevas)
   │
   └─ Volver a Pestaña (> 30s)
      └─→ refetchOnWindowFocus: true (QueryProvider)
          └─→ Refetch de BD si stale

┌─────────────────────────────────────────────────────────────┐
│                   FLUJO DE AUTO-INGESTA                      │
│                                                              │
│  TRIGGER: Cambio de categoría (category state change)       │
│                                                              │
│  1. isFirstMount.current === true?                          │
│     ├─→ SÍ:  Skip (no ingesta en primera carga)            │
│     └─→ NO:  Continuar ↓                                    │
│                                                              │
│  2. category === 'favorites'?                               │
│     ├─→ SÍ:  invalidateNews(category) → Solo refetch       │
│     └─→ NO:  Continuar ↓                                    │
│                                                              │
│  3. setTimeout(300ms) - Debounce                            │
│     └─→ Evita múltiples ingestas al cambiar rápido         │
│                                                              │
│  4. fetch('/api/ingest/news', { body: { category } })      │
│     ├─→ OK:  Nuevos artículos ingresados en BD             │
│     └─→ ERROR: Log warning, continuar con refetch          │
│                                                              │
│  5. invalidateNews(category)                                │
│     └─→ Marca query como stale → React Query refetchea     │
│                                                              │
│  RESULTADO: Noticias frescas de internet visibles en UI    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Archivos Modificados

### ✅ `frontend/app/page.tsx` (+60 LOC)

**Cambios Principales**:

1. **Añadido `useRef` para tracking de primera carga**:
   ```typescript
   // Sprint 16: Track si es la primera carga para evitar ingesta innecesaria
   const isFirstMount = useRef(true);
   ```

2. **Añadido `useInvalidateNews` hook**:
   ```typescript
   import { useNews, useInvalidateNews } from '@/hooks/useNews';

   // ===== Inside component =====
   const invalidateNews = useInvalidateNews();
   ```

3. **Añadido useEffect de Auto-Ingesta**:
   ```typescript
   useEffect(() => {
     // Skip primera carga
     if (isFirstMount.current) {
       isFirstMount.current = false;
       console.log(`🚀 [AUTO-INGESTA] Primera carga: ${category} (sin ingesta)`);
       return;
     }

     // Favoritos: solo refetch, sin ingesta RSS
     if (category === 'favorites') {
       console.log('⭐ [AUTO-INGESTA] FAVORITOS: invalidando para refetch');
       invalidateNews(category);
       return;
     }

     // Debounce de 300ms
     const timeoutId = setTimeout(async () => {
       console.log(`📥 [AUTO-INGESTA] Iniciando ingesta: ${category}`);

       try {
         const requestBody: any = { pageSize: 20 };
         if (category !== 'general') {
           requestBody.category = category;
         }

         const response = await fetch(`${API_BASE_URL}/api/ingest/news`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(requestBody),
         });

         if (response.ok) {
           const data = await response.json();
           console.log('✅ [AUTO-INGESTA] Completada:', data.message);
           console.log('📊 [AUTO-INGESTA] Nuevos artículos:', data.data?.newArticles || 0);
         }
       } catch (error) {
         console.error('❌ [AUTO-INGESTA] Error:', error);
       } finally {
         // Siempre invalidar para refetch, incluso si falla ingesta
         invalidateNews(category);
       }
     }, 300);

     return () => clearTimeout(timeoutId);
   }, [category, invalidateNews]);
   ```

4. **Simplificado `handleCategoryChange`**:
   ```typescript
   const handleCategoryChange = (newCategory: CategoryId) => {
     if (newCategory === category) return;

     console.log(`🔄 [CATEGORY CHANGE] ${category} → ${newCategory}`);

     // Cambiar categoría (dispara useEffect de auto-ingesta)
     setCategory(newCategory);

     // Navegar
     const url = newCategory === 'general' ? '/' : `/?category=${newCategory}`;
     router.push(url, { scroll: false });
   };
   ```

---

## 📊 Matriz de Comportamiento

| Acción del Usuario | Trigger | Ingesta RSS | Refetch BD | Tiempo |
|-------------------|---------|-------------|------------|--------|
| **Primera carga** | Mount componente | ❌ | ✅ (refetchOnMount) | Rápido (~100ms) |
| **Recargar página** | Mount componente | ❌ | ✅ (refetchOnMount) | Rápido (~100ms) |
| **Cambiar a General** | useEffect (category) | ✅ | ✅ (después) | Lento (~2-5s) |
| **Cambiar a Tecnología** | useEffect (category) | ✅ | ✅ (después) | Lento (~2-5s) |
| **Cambiar a Favoritos** | useEffect (category) | ❌ | ✅ (invalidate) | Rápido (~100ms) |
| **Volver a pestaña (> 30s)** | refetchOnWindowFocus | ❌ | ✅ | Rápido (~100ms) |
| **Navegación rápida (< 30s)** | Caché válido | ❌ | ❌ (usa caché) | Instantáneo |

---

## 🧪 Cómo Probar

### PASO 1: Verificar Primera Carga (Sin Ingesta)

1. **Abrir http://localhost:3001**
2. **Abrir DevTools** → Console
3. **Observar logs**:
   ```
   🚀 [AUTO-INGESTA] Primera carga de categoría: general (sin ingesta)
   📰 [useNews] Hook montado/actualizado. Category: general
   🌐 [useNews] ========== EJECUTANDO queryFn ==========
   ✅ [useNews] Fetch completado en 120ms. Artículos: 15
   ```

**Resultado esperado**: NO hay ingesta RSS en primera carga (carga rápida).

### PASO 2: Verificar Cambio de Categoría (Con Ingesta)

1. **Estar en "General"**
2. **Click en "Tecnología"**
3. **Observar logs**:
   ```
   🔄 [CATEGORY CHANGE] general → technology
   📰 [useNews] Hook montado/actualizado. Category: technology
   📥 [AUTO-INGESTA] Iniciando ingesta automática para: technology
   ✅ [AUTO-INGESTA] Completada: News ingestion completed successfully
   📊 [AUTO-INGESTA] Nuevos artículos: 8
   🌐 [useNews] ========== EJECUTANDO queryFn ==========
   ✅ [useNews] Fetch completado en 150ms. Artículos: 23
   ```

**Resultado esperado**: Se dispara ingesta RSS + refetch. Ves noticias frescas de internet.

### PASO 3: Verificar Cambio a Favoritos (Sin Ingesta)

1. **Estar en "Tecnología"**
2. **Click en "Favoritos"**
3. **Observar logs**:
   ```
   🔄 [CATEGORY CHANGE] technology → favorites
   ⭐ [AUTO-INGESTA] Categoría FAVORITOS: invalidando para refetch (sin ingesta RSS)
   🌐 [useNews] ========== EJECUTANDO queryFn ==========
   ✅ [useNews] Fetch completado en 80ms. Artículos: 5
   ```

**Resultado esperado**: NO hay ingesta RSS (favoritos no vienen de RSS), solo refetch de BD.

### PASO 4: Verificar Debounce (Cambios Rápidos)

1. **Cambiar rápidamente**: General → Tecnología → Deportes → Negocios (< 300ms cada uno)
2. **Observar logs**: Solo se dispara 1 ingesta (la última categoría)

**Resultado esperado**: El debounce de 300ms evita múltiples ingestas innecesarias.

### PASO 5: Verificar Recarga de Página

1. **Estar en "Tecnología"**
2. **Recargar página** (F5 o Ctrl+R)
3. **Observar logs**:
   ```
   🚀 [AUTO-INGESTA] Primera carga de categoría: technology (sin ingesta)
   🌐 [useNews] ========== EJECUTANDO queryFn ==========
   ✅ [useNews] Fetch completado en 100ms. Artículos: 23
   ```

**Resultado esperado**: Refetch rápido de BD (sin ingesta), muestra datos actuales.

---

## 📈 Comparativa: Antes vs Después

| Aspecto | ANTES | DESPUÉS |
|---------|-------|---------|
| **Actualización al cambiar categoría** | ❌ Manual (botón) | ✅ Automático (ingesta + refetch) |
| **Actualización al recargar** | ❌ Muestra caché viejo | ✅ Refetch automático |
| **Primera carga** | ⚠️ Podría ser lenta | ✅ Rápida (sin ingesta) |
| **Ingesta innecesaria (Favoritos)** | ❌ Se disparaba | ✅ Skip inteligente |
| **Cambios rápidos de categoría** | ❌ Múltiples ingestas | ✅ Debounce 300ms |
| **Experiencia de usuario** | ❌ Debe pulsar botón | ✅ "App viva" automática |

---

## 🚨 Consideraciones de Performance

### ¿Esto consume muchos tokens?

**NO**, porque:

1. **La ingesta RSS NO analiza con IA automáticamente** → Solo trae artículos de RSS feeds
2. **El análisis con Gemini** se hace solo cuando el usuario:
   - Abre un artículo individualmente
   - Usa el chat RAG/Grounding
   - Dispara análisis manual

**Coste por ingesta**:
- Ingesta RSS: ~0 tokens (solo HTTP requests a feeds RSS)
- Refetch BD: ~0 tokens (solo SQL query)

### ¿Y el tráfico al backend?

**Sí, aumenta**, pero es manejable:

**ANTES**:
- Cambiar categoría: 1 query SQL (refetch)
- Manual "Últimas noticias": 1 ingesta RSS + 1 query SQL

**DESPUÉS**:
- Cambiar categoría: 1 ingesta RSS + 1 query SQL (automático)
- Recarga página: 1 query SQL

**Incremento**: ~2x queries al backend en cambios de categoría.

**Mitigación**:
- Debounce de 300ms evita spam
- Primera carga sin ingesta → Carga rápida
- Favoritos sin ingesta → Solo BD

**Conclusión**: El incremento es aceptable dado el valor UX ganado.

---

## 🔧 Configuración Avanzada (Opcional)

### Aumentar Debounce Time

Si quieres más tiempo antes de disparar ingesta (por ejemplo, si el usuario cambia categorías muy rápido):

```typescript
// En frontend/app/page.tsx
const timeoutId = setTimeout(async () => {
  // ...
}, 500); // Cambiar de 300ms → 500ms
```

### Deshabilitar Auto-Ingesta (Solo Refetch)

Si prefieres solo refetch de BD (sin traer noticias nuevas de internet):

```typescript
useEffect(() => {
  if (isFirstMount.current) {
    isFirstMount.current = false;
    return;
  }

  // Siempre solo refetch, nunca ingesta
  invalidateNews(category);
}, [category, invalidateNews]);
```

**Ventaja**: Carga instantánea (usa BD actual).
**Desventaja**: Noticias pueden ser viejas si no hay ingesta reciente.

### Añadir Indicador Visual de Ingesta

Para mostrar al usuario que se están buscando noticias nuevas:

```tsx
const [isIngesting, setIsIngesting] = useState(false);

// En useEffect de auto-ingesta:
setIsIngesting(true);
try {
  // ... fetch ingesta ...
} finally {
  setIsIngesting(false);
}

// En UI:
{isIngesting && (
  <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow">
    🔄 Buscando noticias nuevas...
  </div>
)}
```

---

## 🎓 Conceptos Clave

### ¿Por qué Debounce?

**Debounce** es una técnica para evitar ejecutar una función múltiples veces en rápida sucesión.

**Ejemplo sin debounce**:
```
Usuario cambia rápido: General → Tech → Sports → Business
  ↓
Dispara 4 ingestas RSS simultáneas (costoso, innecesario)
```

**Ejemplo con debounce (300ms)**:
```
Usuario cambia rápido: General → Tech → Sports → Business
  ↓
Espera 300ms desde el último cambio
  ↓
Dispara solo 1 ingesta RSS para "Business" (eficiente)
```

### ¿Por qué Skip Primera Carga?

**Razón 1 - Performance**: La ingesta RSS puede tardar 2-5 segundos. No queremos que el usuario espere tanto en la primera carga.

**Razón 2 - Datos ya disponibles**: La BD ya tiene noticias. Es mejor mostrar esas inmediatamente y actualizar en background.

**Razón 3 - UX**: Primera impresión rápida > Primera impresión lenta pero con datos nuevos.

### ¿Por qué invalidateNews en lugar de refetch?

**invalidateNews** marca la query como "stale" (obsoleta), lo que hace que React Query:
1. Use datos de caché primero (evita pantalla en blanco)
2. Refetchee en background
3. Actualice UI cuando llegan nuevos datos

**refetch** directamente dispara un fetch, lo que puede causar:
- Pantalla de loading innecesaria
- Parpadeo en UI
- Peor UX

---

## 📚 Recursos

- [TanStack Query - Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation)
- [React useRef Hook](https://react.dev/reference/react/useRef)
- [Debounce Pattern](https://www.freecodecamp.org/news/javascript-debounce-example/)

---

## 🚀 Próximos Pasos (Opcional)

1. **Indicador Visual de Ingesta**:
   - Toast: "Buscando noticias nuevas..."
   - Progress bar en header
   - Badge con número de nuevas noticias

2. **Smart Ingesta Condicional**:
   - Detectar si BD está "vieja" (última actualización > 1 hora)
   - Si BD es reciente, skip ingesta y solo refetch
   - Reducir tráfico al backend en 50%

3. **Configuración de Usuario**:
   - Ajustes → "Auto-actualizar al cambiar categoría" (On/Off)
   - Personalizar debounce time
   - Elegir entre "Rápido (solo BD)" o "Fresco (ingesta + BD)"

4. **Offline Support**:
   - Detectar si el usuario está offline
   - Skip ingesta si offline
   - Mostrar banner: "Sin conexión - Mostrando noticias cacheadas"

---

**Completado por**: Senior Frontend Architect
**Fecha**: 2026-02-05
**Próximo**: Sprint 16 - Paso 3 - Indicadores Visuales & Smart Conditional Ingestion
