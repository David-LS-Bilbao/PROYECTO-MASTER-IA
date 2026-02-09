# Test Manual: Funcionalidad de Actualización

**Fecha:** 2026-02-09
**Contexto:** Verificación de botón "Noticias" y recarga de página
**Fix Aplicado:** Query key mismatch corregido en sidebar.tsx

---

## 🧪 Test 1: Botón "Noticias" Actualiza UI

### Objetivo
Verificar que el botón "Noticias" en el sidebar trae nuevas noticias del RSS y actualiza la UI.

### Pre-requisitos
- ✅ Backend corriendo (`http://localhost:3000`)
- ✅ Frontend corriendo (`http://localhost:3001`)
- ✅ Usuario autenticado
- ✅ Al menos 1 fuente RSS configurada

### Pasos

1. **Abrir consola del navegador**
   - Presionar F12
   - Ir a pestaña "Console"
   - Filtrar por "REFRESH" para ver logs relevantes

2. **Navegar a categoría específica**
   - Ir a `http://localhost:3001/?category=tecnologia`
   - Esperar a que carguen las noticias
   - **Anotar:** Título de la primera noticia visible

3. **Presionar botón "Noticias"**
   - Click en el botón "Noticias" del sidebar
   - **Esperar:** 3-5 segundos (ingesta RSS)

4. **Verificar logs en consola**
   - ✅ Debe aparecer: `🔄 [REFRESH] ========== INICIO REFRESH ==========`
   - ✅ Debe aparecer: `📥 [REFRESH] Iniciando ingesta RSS...`
   - ✅ Debe aparecer: `✅ [REFRESH] Ingesta completada`
   - ✅ Debe aparecer: `🗑️ [REFRESH] Invalidando queries...`
   - ✅ Debe aparecer: `🔍 [REFRESH] Evaluating query: ["news-infinite","tecnologia",20] → INVALIDATE`
   - ✅ Debe aparecer: `✅ [REFRESH] ========== FIN REFRESH ==========`

5. **Verificar UI se actualiza**
   - **Observar:** La lista de noticias se recarga automáticamente
   - **Verificar:** El spinner de carga aparece brevemente
   - **Verificar:** Nuevas noticias aparecen al inicio (si las hay)

### Resultado Esperado

✅ **ÉXITO si:**
- Logs muestran ingesta RSS completada
- Logs muestran `INVALIDATE` para `['news-infinite', category, 20]`
- UI se actualiza sin necesidad de recargar (F5)
- Nuevas noticias (si las hay) aparecen al inicio

❌ **FALLO si:**
- Logs muestran `SKIP` en lugar de `INVALIDATE`
- UI NO se actualiza automáticamente
- Se necesita recargar (F5) para ver cambios

---

## 🧪 Test 2: Recarga de Página (F5)

### Objetivo
Verificar que al recargar la página, los datos se cargan desde la BD correctamente.

### Pre-requisitos
- ✅ Backend corriendo
- ✅ Frontend corriendo
- ✅ Usuario autenticado
- ✅ Cache de React Query tiene datos previos

### Pasos

1. **Navegar a categoría específica**
   - Ir a `http://localhost:3001/?category=economia`
   - Esperar a que carguen las noticias
   - **Anotar:** Número de artículos visibles

2. **Abrir React Query Devtools**
   - Presionar botón flotante de React Query (esquina inferior)
   - Buscar query con key `['news-infinite', 'economia', 20]`
   - **Verificar:** Estado es "success" y tiene datos en cache

3. **Recargar la página**
   - Presionar F5 (recarga completa)
   - **Observar:** Spinner de carga inicial

4. **Verificar consola**
   - ✅ Debe aparecer: `[useNewsInfinite] 📄 Fetching page: offset=0, limit=20, category=economia`
   - ✅ Debe aparecer: `[useNewsInfinite] ✅ Page loaded: X articles`

5. **Verificar React Query Devtools**
   - **Verificar:** Query `['news-infinite', 'economia', 20]` tiene estado "success"
   - **Verificar:** Datos se cargaron desde el servidor (NOT from cache)

6. **Verificar UI**
   - **Verificar:** Noticias se muestran correctamente
   - **Verificar:** Número de artículos es similar al previo (±5)

### Resultado Esperado

✅ **ÉXITO si:**
- Página recarga y muestra datos de BD
- Logs muestran fetch exitoso
- React Query hace refetch (no usa cache viejo)
- UI muestra noticias correctamente

❌ **FALLO si:**
- Página muestra error de carga
- Cache viejo se mantiene (staleTime > esperado)
- UI no muestra noticias

### Nota Importante

⚠️ **Al recargar con F5, NO se hace ingesta RSS automática.**
- Solo se cargan datos de PostgreSQL
- Para traer noticias nuevas del RSS, usar botón "Noticias"

---

## 🧪 Test 3: Cambio de Categoría

### Objetivo
Verificar que cambiar de categoría actualiza los datos correctamente.

### Pre-requisitos
- ✅ Backend corriendo
- ✅ Frontend corriendo
- ✅ Usuario autenticado

### Pasos

1. **Navegar a categoría "General"**
   - Ir a `http://localhost:3001/`
   - Esperar a que carguen las noticias
   - **Anotar:** Títulos visibles

2. **Cambiar a categoría "Deportes"**
   - Click en pill "Deportes" en el header
   - **Observar:** URL cambia a `/?category=deportes`

3. **Verificar consola**
   - ✅ Debe aparecer: `🔗 [URL SYNC] URL cambió: Actualizando category de "general" a "deportes"`
   - ✅ Debe aparecer: `[useNewsInfinite] 📄 Fetching page: offset=0, limit=20, category=deportes`

4. **Verificar React Query Devtools**
   - **Verificar:** Nueva query `['news-infinite', 'deportes', 20]` se creó
   - **Verificar:** Query anterior `['news-infinite', 'general', 20]` sigue en cache (GC después de 5min)

5. **Verificar UI**
   - **Verificar:** Noticias cambiaron completamente
   - **Verificar:** Títulos corresponden a deportes
   - **Verificar:** Pill "Deportes" está activa

### Resultado Esperado

✅ **ÉXITO si:**
- URL se actualiza con `?category=deportes`
- React Query crea nueva query
- UI muestra noticias de la categoría correcta
- Transición es suave (sin parpadeos)

❌ **FALLO si:**
- UI no cambia al cambiar categoría
- Categoría incorrecta se muestra
- Error en la consola

---

## 🧪 Test 4: Invalidación Cross-Category

### Objetivo
Verificar que invalidar una categoría NO afecta otras categorías.

### Pre-requisitos
- ✅ Backend corriendo
- ✅ Frontend corriendo
- ✅ Usuario autenticado

### Pasos

1. **Navegar a "General"**
   - Ir a `http://localhost:3001/`
   - Esperar a que carguen noticias

2. **Navegar a "Tecnología"**
   - Click en pill "Tecnología"
   - Esperar a que carguen noticias

3. **Presionar botón "Noticias"** (estando en Tecnología)
   - Click en botón "Noticias" del sidebar
   - Esperar 3-5 segundos

4. **Verificar logs**
   - ✅ Debe aparecer: `🔍 [REFRESH] Evaluating query: ["news-infinite","tecnologia",20] → INVALIDATE`
   - ✅ Debe aparecer: `🔍 [REFRESH] Evaluating query: ["news-infinite","general",20] → SKIP`

5. **Navegar de vuelta a "General"**
   - Click en pill "Todas"
   - **Verificar:** Cache de "general" sigue intacto (no hizo refetch)

### Resultado Esperado

✅ **ÉXITO si:**
- Solo la categoría activa se invalida
- Otras categorías NO se refetchean
- Cache de categorías no activas se mantiene

❌ **FALLO si:**
- Todas las categorías se invalidan
- Navegación lenta por refetch innecesarios

---

## 📊 Resumen de Resultados

| Test | Descripción | Estado | Notas |
|------|-------------|--------|-------|
| 1 | Botón "Noticias" actualiza UI | ⏳ Pendiente | - |
| 2 | Recarga de página (F5) | ⏳ Pendiente | - |
| 3 | Cambio de categoría | ⏳ Pendiente | - |
| 4 | Invalidación cross-category | ⏳ Pendiente | - |

---

## 🐛 Problemas Conocidos

### 1. Auto-Ingesta al Recargar

**Estado:** No implementado
**Impacto:** Al hacer F5, no se traen noticias nuevas del RSS

**Workaround:**
1. Recargar página (F5)
2. Presionar botón "Noticias" manualmente

**Fix Futuro:**
Implementar auto-ingesta con TTL de 1 hora (ver ANALISIS-REFRESH-BUG.md)

---

## 📝 Checklist de Verificación

Antes de dar el fix por completado:

- [ ] Test 1 pasa (botón "Noticias")
- [ ] Test 2 pasa (recarga F5)
- [ ] Test 3 pasa (cambio categoría)
- [ ] Test 4 pasa (invalidación selectiva)
- [ ] Logs de consola son claros y útiles
- [ ] No hay errores en consola del navegador
- [ ] No hay errores en consola del backend
- [ ] UI es responsive (no hay delays perceptibles)

---

## 🔗 Referencias

- ANALISIS-REFRESH-BUG.md - Diagnóstico completo
- frontend/components/layout/sidebar.tsx - Código del botón
- frontend/hooks/useNewsInfinite.ts - Hook de datos
- frontend/components/providers/query-provider.tsx - Config React Query
