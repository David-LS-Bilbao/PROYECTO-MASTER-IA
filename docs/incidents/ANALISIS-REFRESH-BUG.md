# Análisis: Problema de Actualización en Botón "Noticias" y Recarga de Página

**Fecha:** 2026-02-09
**Autor:** Claude Sonnet 4.5
**Contexto:** Revisión de comportamientos de actualización

---

## 🔍 Problema Identificado

### Síntoma
El botón "Noticias" en el sidebar NO actualiza correctamente los datos visibles en la página principal.

### Causa Raíz
**MISMATCH de Query Keys entre invalidación y consulta:**

- **Página principal** usa: `['news-infinite', category, limit]` (useNewsInfinite)
- **Botón "Noticias"** invalida: `['news', category]` (sidebar.tsx línea 92-96)

```typescript
// ❌ CÓDIGO ACTUAL (sidebar.tsx - línea 92)
await queryClient.invalidateQueries({
  queryKey: ['news', currentCategory],  // ⚠️ Query key INCORRECTO
  exact: false,
  refetchType: 'active',
});
```

```typescript
// ✅ CÓDIGO CORRECTO (debería ser)
await queryClient.invalidateQueries({
  queryKey: ['news-infinite', currentCategory],  // ✅ Coincide con useNewsInfinite
  exact: false,
  refetchType: 'active',
});
```

---

## 📊 Análisis de Flujos

### 1. Flujo al Recargar la Página (F5)

**Estado Actual:**
```
Usuario presiona F5
  ↓
Browser recarga página completa
  ↓
React Query reinicializa (cache limpio)
  ↓
useNewsInfinite ejecuta queryFn
  ↓
fetchNews/fetchNewsByCategory (API)
  ↓
Devuelve datos de PostgreSQL (NO hace ingesta RSS)
  ↓
✅ Muestra datos (pero NO nuevos del RSS)
```

**Configuración React Query:**
- `refetchOnMount: 'always'` → ✅ Hace fetch al montar
- `staleTime: 30s` → ✅ Considera datos frescos 30s
- **PERO:** No llama a `/api/ingest/news` automáticamente

**Resultado:**
- ✅ Datos se recargan desde la BD
- ❌ NO trae noticias nuevas del RSS
- ⚠️ Usuario solo ve noticias ya ingresadas

---

### 2. Flujo al Presionar Botón "Noticias"

**Estado Actual:**
```
Usuario presiona botón "Noticias"
  ↓
handleRefreshNews() se ejecuta
  ↓
POST /api/ingest/news (trae noticias RSS)
  ↓
Nuevas noticias guardadas en PostgreSQL
  ↓
invalidateQueries({ queryKey: ['news', category] })  ❌ KEY INCORRECTA
  ↓
React Query busca queries con key ['news', ...]
  ↓
NO encuentra ['news-infinite', category, 20]
  ↓
❌ Cache NO se invalida
  ↓
❌ Usuario sigue viendo datos viejos
```

**Resultado:**
- ✅ Ingesta RSS funciona correctamente (noticias guardadas en BD)
- ❌ Cache NO se invalida (query key mismatch)
- ❌ UI NO se actualiza (usuario no ve cambios)

---

### 3. Flujo Esperado (Después del Fix)

**Flujo Correcto:**
```
Usuario presiona botón "Noticias"
  ↓
handleRefreshNews() se ejecuta
  ↓
POST /api/ingest/news (trae noticias RSS)
  ↓
Nuevas noticias guardadas en PostgreSQL
  ↓
invalidateQueries({ queryKey: ['news-infinite', category] })  ✅ KEY CORRECTA
  ↓
React Query encuentra ['news-infinite', category, 20]
  ↓
Cache se marca como "stale"
  ↓
Refetch automático se dispara (refetchType: 'active')
  ↓
useNewsInfinite ejecuta queryFn
  ↓
fetchNews/fetchNewsByCategory (API)
  ↓
Devuelve datos actualizados (incluye noticias nuevas)
  ↓
✅ UI se actualiza automáticamente
```

---

## 🧪 Evidencia del Problema

### Query Keys Actuales

**useNewsInfinite.ts (línea 44):**
```typescript
queryKey: ['news-infinite', category, limit],
```

**sidebar.tsx (línea 92):**
```typescript
queryKey: ['news', currentCategory],  // ❌ MISMATCH
```

**useNews.ts (línea 45) - No usado en página principal:**
```typescript
queryKey: ['news', category, limit, offset],
```

---

## 🔧 Solución Propuesta

### Opción 1: Corregir Query Key en Sidebar (RECOMENDADO)

**Archivo:** `frontend/components/layout/sidebar.tsx`
**Líneas:** 92-96

**Antes:**
```typescript
await queryClient.invalidateQueries({
  queryKey: ['news', currentCategory],
  exact: false,
  refetchType: 'active',
});
```

**Después:**
```typescript
// Invalidar AMBOS tipos de queries (por si acaso)
await queryClient.invalidateQueries({
  queryKey: ['news-infinite', currentCategory],
  exact: false,
  refetchType: 'active',
});
```

**Ventajas:**
- ✅ Solución mínima (1 línea)
- ✅ No rompe nada
- ✅ Compatible con infinite scroll

---

### Opción 2: Usar Patrón Más Flexible (MEJOR)

**Invalidar TODO el prefijo `['news']` con wildcard:**

```typescript
// Invalida TODAS las queries que empiecen con ['news', ...]
await queryClient.invalidateQueries({
  predicate: (query) => {
    const [base, cat] = query.queryKey;
    return (
      (base === 'news' || base === 'news-infinite') &&
      cat === currentCategory
    );
  },
  refetchType: 'active',
});
```

**Ventajas:**
- ✅ Funciona con ambos hooks (useNews y useNewsInfinite)
- ✅ Más robusto ante futuros cambios
- ✅ No depende de query keys exactos

---

### Opción 3: Auto-Ingesta al Recargar (ADICIONAL)

**Agregar lógica de auto-ingesta en page.tsx:**

```typescript
// Sprint 16: Auto-ingesta inteligente (solo si han pasado >1 hora)
useEffect(() => {
  const shouldAutoIngest = async () => {
    const lastIngestKey = `last-ingest-${category}`;
    const lastIngest = localStorage.getItem(lastIngestKey);
    const now = Date.now();

    if (!lastIngest || (now - parseInt(lastIngest)) > 60 * 60 * 1000) {
      console.log(`🔄 [AUTO-INGEST] Última ingesta hace >1h, actualizando...`);

      try {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
        await fetch(`${API_BASE_URL}/api/ingest/news`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: category === 'general' ? undefined : category,
            pageSize: 20,
          }),
        });

        localStorage.setItem(lastIngestKey, now.toString());
        invalidateNews(category);
      } catch (error) {
        console.error('[AUTO-INGEST] Error:', error);
      }
    }
  };

  shouldAutoIngest();
}, [category]);
```

**Ventajas:**
- ✅ Recarga de página trae noticias nuevas automáticamente
- ✅ TTL de 1 hora evita llamadas innecesarias
- ✅ No depende del botón "Noticias"

---

## 📋 Plan de Acción

### Paso 1: Fix Inmediato (Opción 1)
1. Cambiar query key en `sidebar.tsx` línea 92
2. Probar botón "Noticias" → ✅ Debe actualizar UI

### Paso 2: Test de Regresión
1. Crear test E2E para verificar actualización
2. Cubrir casos:
   - Presionar botón "Noticias"
   - Recargar página (F5)
   - Cambiar categoría

### Paso 3: Mejora Opcional (Opción 3)
1. Implementar auto-ingesta con TTL
2. Agregar indicador visual de "Actualizando..."

---

## ✅ Criterios de Éxito

- ✅ Botón "Noticias" actualiza UI inmediatamente
- ✅ Recarga de página (F5) muestra datos de BD
- ✅ Auto-ingesta (opcional) trae noticias nuevas cada 1h
- ✅ Logs de consola muestran invalidación correcta

---

## 📝 Notas Adicionales

### Query Key Naming Conventions

**Actual:**
- `['news', category, limit, offset]` → useNews (paginación estática)
- `['news-infinite', category, limit]` → useNewsInfinite (infinite scroll)

**Recomendación Futura:**
Unificar bajo un solo patrón:
```typescript
['news', { type: 'paginated' | 'infinite', category, limit, offset? }]
```

Esto permitiría:
- Invalidar todo con `['news']`
- Filtrar por tipo con predicates
- Evitar mismatch de keys

---

## 🔗 Referencias

- React Query Docs: [Query Keys](https://tanstack.com/query/latest/docs/react/guides/query-keys)
- React Query Docs: [Query Invalidation](https://tanstack.com/query/latest/docs/react/guides/query-invalidation)
- Sprint 20: Infinite Scroll Implementation
- Sprint 16: Auto-Refresh Strategy
