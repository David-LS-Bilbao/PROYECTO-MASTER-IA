# Sprint 19 - Waterfall Search Engine: E2E Tests

## Prerequisitos
- ✅ Backend corriendo en: `http://localhost:3000`
- ✅ Frontend corriendo en: `http://localhost:3001`
- ✅ Base de datos con artículos

## Test 1: Búsqueda LEVEL 1 (Quick DB Search)

**Objetivo**: Verificar que la búsqueda rápida funciona correctamente

**Pasos**:
1. Abrir navegador en `http://localhost:3001/search`
2. Escribir en la barra de búsqueda: **"Trump"**
3. Esperar 500ms (debounce)
4. Observar resultados

**Resultados Esperados**:
- ✅ Resultados aparecen en **menos de 500ms**
- ✅ Badge muestra: "⚡ Búsqueda rápida" (LEVEL 1)
- ✅ Se muestran artículos que contienen "Trump" en título/descripción
- ✅ Cards muestran información básica (título, fuente, descripción)

## Test 2: Búsqueda LEVEL 2 (Reactive Ingestion)

**Objetivo**: Verificar que la ingesta reactiva funciona cuando no hay resultados iniciales

**Setup**:
1. Buscar un término muy específico que NO esté en la BD

**Pasos**:
1. Escribir en la barra de búsqueda: **"criptocurrency blockchain 2026"**
2. Esperar 500ms (debounce)
3. Observar el comportamiento

**Resultados Esperados**:
- ✅ Loading spinner aparece inmediatamente
- ✅ Búsqueda toma entre **1-8 segundos** (LEVEL 2: ingesta reactiva)
- ✅ Uno de dos resultados:
  - Si se encuentran artículos después de ingesta: Badge "🔄 Búsqueda profunda" + Badge "✨ Artículos actualizados"
  - Si NO se encuentran: Avanza a LEVEL 3

## Test 3: Búsqueda LEVEL 3 (Google News Fallback)

**Objetivo**: Verificar que el fallback a Google News funciona correctamente

**Pasos**:
1. Escribir en la barra de búsqueda: **"noticiasuperespecificanoexiste12345xyz"**
2. Esperar 500ms (debounce)
3. Observar el fallback

**Resultados Esperados**:
- ✅ Loading spinner aparece
- ✅ Después de ~8-10 segundos, aparece Alert con:
  - Título: "No se encontraron resultados"
  - Mensaje: "No hemos encontrado noticias recientes sobre este tema en nuestras fuentes."
  - Botón: "Buscar en Google News"
- ✅ Al hacer clic en el botón, abre Google News en nueva pestaña con la búsqueda

## Test 4: Debounce del SearchBar

**Objetivo**: Verificar que el debounce funciona correctamente

**Pasos**:
1. Abrir `http://localhost:3001/search`
2. Escribir rápidamente en la barra: **"T-r-u-m-p"** (una letra por vez, rápido)
3. Parar de escribir

**Resultados Esperados**:
- ✅ NO se realizan búsquedas hasta que el usuario para de escribir
- ✅ Después de 500ms de inactividad, se ejecuta UNA sola búsqueda
- ✅ Network tab muestra solo 1 request a `/api/news/search`

## Test 5: Navegación desde Dashboard

**Objetivo**: Verificar integración con el resto de la app

**Pasos**:
1. Abrir `http://localhost:3001` (dashboard)
2. Buscar un icono o link de búsqueda en el navbar (si existe)
3. Navegar a `/search`
4. Realizar búsqueda

**Resultados Esperados**:
- ✅ Navegación fluida sin errores
- ✅ Búsqueda funciona correctamente
- ✅ Botón "Volver al inicio" funciona

## Test 6: Per-User Favorite Enrichment

**Objetivo**: Verificar que los favoritos del usuario se muestran en resultados

**Pasos**:
1. Login con cuenta de usuario
2. Desde dashboard, marcar como favorito un artículo sobre "Trump"
3. Ir a `/search`
4. Buscar "Trump"
5. Verificar que el artículo marcado muestra el estado de favorito

**Resultados Esperados**:
- ✅ Artículos favoritos muestran icono de corazón lleno/activado
- ✅ Otros artículos muestran corazón vacío
- ✅ Estado de favorito es específico del usuario

## Test 7: Responsive Design

**Objetivo**: Verificar que la UI funciona en diferentes tamaños de pantalla

**Pasos**:
1. Abrir `/search` en diferentes resoluciones:
   - Desktop (1920x1080)
   - Tablet (768x1024)
   - Mobile (375x667)

**Resultados Esperados**:
- ✅ SearchBar se adapta correctamente
- ✅ Grid de resultados cambia a 3 columnas → 2 columnas → 1 columna
- ✅ Badges de nivel se muestran correctamente
- ✅ Botón de Google News se adapta al ancho disponible

## Test 8: Error Handling

**Objetivo**: Verificar manejo de errores

**Pasos**:
1. Detener el backend: `Ctrl+C` en la terminal del backend
2. Intentar realizar búsqueda en frontend
3. Observar comportamiento

**Resultados Esperados**:
- ✅ Alert de error aparece con mensaje descriptivo
- ✅ No hay crashes del frontend
- ✅ UI permanece funcional
- ✅ Usuario puede intentar búsqueda de nuevo

## Test 9: Empty Query State

**Objetivo**: Verificar estado inicial sin búsqueda

**Pasos**:
1. Abrir `http://localhost:3001/search` sin query params
2. Observar UI inicial

**Resultados Esperados**:
- ✅ Muestra icono de búsqueda grande
- ✅ Título: "Busca noticias"
- ✅ Descripción explicativa del sistema de 3 niveles
- ✅ 3 badges explicativos (Nivel 1, 2, 3)
- ✅ No se muestra mensaje de error ni loading

## Test 10: URL Parameters

**Objetivo**: Verificar que los query params en URL funcionan

**Pasos**:
1. Navegar directamente a: `http://localhost:3001/search?q=Trump`
2. Observar comportamiento

**Resultados Esperados**:
- ✅ Búsqueda se ejecuta automáticamente al cargar la página
- ✅ SearchBar muestra "Trump" pre-cargado
- ✅ Resultados aparecen sin interacción adicional
- ✅ URL se mantiene sincronizada con el estado

---

## Resumen de Success Criteria

Sprint 19 se considera **COMPLETADO** si:

### Backend
- [x] Endpoint `/api/news/search` implementado
- [x] LEVEL 1: Quick DB search con Full-Text Search / LIKE fallback
- [x] LEVEL 2: Reactive ingestion con timeout de 8s
- [x] LEVEL 3: Google News suggestion fallback
- [x] Per-user favorite enrichment con `optionalAuthenticate`

### Frontend
- [x] Hook `useDebounce` implementado (500ms)
- [x] Hook `useNewsSearch` implementado con React Query
- [x] Componente `SearchBar` reutilizable
- [x] Página `/search` con resultados y badges de nivel
- [x] UI responsive con loading states
- [x] Error handling apropiado
- [x] Botón de Google News en LEVEL 3

### UX
- [x] Búsquedas rápidas (<500ms) en LEVEL 1
- [x] Visual feedback del nivel de búsqueda alcanzado
- [x] Debounce evita búsquedas excesivas
- [x] Fallback útil cuando no hay resultados
- [x] Navegación fluida entre páginas

---

## Quick Verification Script

Para una verificación rápida de funcionalidad básica:

```bash
# 1. Verificar que ambos servidores están corriendo
curl http://localhost:3000/health
curl http://localhost:3001

# 2. Test backend search endpoint
curl "http://localhost:3000/api/news/search?q=Trump&limit=5"

# 3. Test con término no existente (LEVEL 3)
curl "http://localhost:3000/api/news/search?q=noexiste123456&limit=5"
```

Ambas respuestas deben ser JSON válidos con:
- Primera: `{"success": true, "data": [...], "level": 1}`
- Segunda: `{"success": true, "data": [], "suggestion": {...}}`
