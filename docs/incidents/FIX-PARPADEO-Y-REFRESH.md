# Fix: Parpadeo al Cambiar Categorías + Auto-Ingesta al Recargar

**Fecha:** 2026-02-09
**Contexto:** Mejora de UX en navegación entre categorías y recarga de página

---

## 🐛 Problemas Identificados y Solucionados

### 1. Parpadeo Visual al Cambiar de Categoría

**Síntoma:**
- Al cambiar de categoría (ej: General → Deportes)
- Se muestran brevemente las noticias de la categoría anterior
- Luego "flash" rápido cuando llegan los datos nuevos
- Da sensación de aplicación "rota"

**Causa:**
- React Query mantiene datos en cache
- Muestra datos viejos mientras hace refetch
- `isFetching` solo muestra pequeño spinner, no oculta contenido viejo

**Solución Implementada:**

**Archivo:** `frontend/app/page.tsx`

1. **Estado de transición:**
   ```typescript
   const [isChangingCategory, setIsChangingCategory] = useState(false);
   const previousCategoryRef = useRef<CategoryId>(category);
   ```

2. **Handler mejorado:**
   ```typescript
   const handleCategoryChange = (newCategory: CategoryId) => {
     if (newCategory === category) return;

     // Activar loading state
     setIsChangingCategory(true);

     // Actualizar URL y categoría
     router.replace(url, { scroll: false });
     setCategory(newCategory);
   };
   ```

3. **Detectar fin de carga:**
   ```typescript
   useEffect(() => {
     if (isChangingCategory && !isLoading && !isFetching) {
       setIsChangingCategory(false);
       previousCategoryRef.current = category;
     }
   }, [isChangingCategory, isLoading, isFetching, category]);
   ```

4. **Renderizado condicional:**
   ```typescript
   // Mostrar skeleton durante cambio
   {(isLoading || isChangingCategory) && (
     <div>
       <p>Cargando noticias frescas...</p>
       {/* Skeleton cards */}
     </div>
   )}

   // Solo mostrar noticias cuando NO estamos cambiando
   {!isChangingCategory && newsData && (
     <NewsGrid />
   )}
   ```

**Resultado:**
- ✅ Sin parpadeo visual
- ✅ Transición suave con skeleton
- ✅ Mensaje claro "Cargando noticias frescas..."
- ✅ No se ven datos de categoría anterior

---

### 2. Warnings de Imágenes en Consola

**Síntoma:**
```
⨯ The requested resource isn't a valid image for https://www.youtube.com/embed/...
⨯ The requested resource isn't a valid image for ...video_1800.mp4
```

**Causa:**
- Feeds RSS incluyen URLs de videos (YouTube, .mp4)
- Next.js `<Image>` intenta optimizarlos
- Falla porque no son imágenes

**Solución Implementada:**

**Archivo:** `frontend/components/news-card.tsx`

```typescript
/**
 * Check if URL is a video (not an image)
 */
function isVideoUrl(url: string): boolean {
  const videoPatterns = [
    'youtube.com/embed',
    'youtu.be/',
    '.mp4',
    '.webm',
    '.ogg',
    '.mov',
    'vimeo.com',
    'dailymotion.com',
  ];
  return videoPatterns.some(pattern => url.includes(pattern));
}

// En el render:
{article.urlToImage && !isVideoUrl(article.urlToImage) && (
  <Image src={article.urlToImage} ... />
)}
```

**Resultado:**
- ✅ Sin warnings en consola
- ✅ Videos simplemente no se muestran (correcto)
- ✅ Solo imágenes válidas se optimizan

---

### 3. No Actualización al Recargar Página (F5)

**Síntoma:**
- Usuario recarga página (F5)
- Se cargan datos de BD
- NO se traen noticias nuevas del RSS
- Usuario ve noticias antiguas

**Causa:**
- Auto-ingesta solo se ejecutaba al cambiar categoría
- Primera carga (`isFirstMount`) se saltaba la ingesta
- Solo se usaban datos existentes en PostgreSQL

**Solución Implementada:**

**Archivo:** `frontend/app/page.tsx`

```typescript
// Nuevo useEffect para auto-ingesta al recargar
useEffect(() => {
  // Solo primera carga
  if (!isFirstMount.current) return;

  // Skip favoritos y backend no disponible
  if (category === 'favorites' || !isBackendAvailable) return;

  const autoIngestWithTTL = async () => {
    const storageKey = `last-ingest-${category}`;
    const lastIngestStr = localStorage.getItem(storageKey);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    // Verificar TTL
    if (lastIngestStr) {
      const lastIngest = parseInt(lastIngestStr, 10);
      const timeSinceIngest = now - lastIngest;
      const minutesSince = Math.round(timeSinceIngest / (60 * 1000));

      if (timeSinceIngest < oneHour) {
        console.log(`💰 [AUTO-RELOAD] Última ingesta hace ${minutesSince}min - SALTANDO`);
        return;
      }
    }

    // Hacer ingesta RSS
    const response = await fetch(`${API_BASE_URL}/api/ingest/news`, {
      method: 'POST',
      body: JSON.stringify({ pageSize: 50, category }),
    });

    if (response.ok) {
      // Guardar timestamp
      localStorage.setItem(storageKey, now.toString());
      // Invalidar cache
      invalidateNews(category);
    }
  };

  setTimeout(autoIngestWithTTL, 500);
}, [category, isBackendAvailable, invalidateNews]);
```

**Características:**
- ✅ TTL de 1 hora con localStorage
- ✅ Máximo 1 ingesta/hora por categoría
- ✅ Logs claros para debugging
- ✅ Skip automático si backend no disponible

**Resultado:**
- ✅ F5 trae noticias frescas (si TTL > 1h)
- ✅ Sin duplicar ingestas innecesarias
- ✅ Optimización de costes (TTL inteligente)

---

### 4. Fix: Query Key Mismatch (Botón "Noticias")

**Síntoma:**
- Botón "Noticias" en sidebar no actualizaba UI
- Ingesta RSS funcionaba, pero datos no se mostraban
- Necesitaba F5 manual para ver cambios

**Causa:**
- Botón invalidaba: `['news', category]`
- Página usaba: `['news-infinite', category]`
- Mismatch → cache no se invalidaba

**Solución Implementada:**

**Archivo:** `frontend/components/layout/sidebar.tsx`

```typescript
await queryClient.invalidateQueries({
  predicate: (query) => {
    const [base, cat] = query.queryKey;
    const isNewsQuery = base === 'news' || base === 'news-infinite';
    const matchesCategory = cat === currentCategory;

    console.log(`🔍 [REFRESH] Evaluating query: ${JSON.stringify(query.queryKey)} → ${isNewsQuery && matchesCategory ? 'INVALIDATE' : 'SKIP'}`);

    return isNewsQuery && matchesCategory;
  },
  refetchType: 'active',
});
```

**Resultado:**
- ✅ Botón "Noticias" actualiza UI automáticamente
- ✅ Compatible con ambos hooks (useNews y useNewsInfinite)
- ✅ Logs detallados para debugging

---

## 📊 Flujo Completo Final

### Flujo 1: Recarga de Página (F5)

```
Usuario → F5
  ↓
React reinicia → useNewsInfinite fetch BD
  ↓
useEffect auto-reload verifica localStorage TTL
  ↓ TTL < 1h
  💰 SKIP ingesta (datos frescos)
  ✅ Muestra datos de BD

  ↓ TTL > 1h
  📡 POST /api/ingest/news (RSS)
  ↓
  Guardar timestamp en localStorage
  ↓
  Invalidar cache → Refetch
  ↓
  ✅ Muestra datos actualizados con RSS nuevos
```

### Flujo 2: Cambio de Categoría

```
Usuario → Click "Deportes"
  ↓
setIsChangingCategory(true)
  ↓
🔄 Ocultar noticias viejas
🎨 Mostrar skeleton + "Cargando noticias frescas..."
  ↓
setCategory('deportes') → useEffect auto-ingesta
  ↓
Verificar TTL último artículo en BD
  ↓ Artículo < 1h
  💰 SKIP ingesta → Solo refetch BD
  ✅ Mostrar datos

  ↓ Artículo > 1h o no hay datos
  📡 POST /api/ingest/news (RSS deportes)
  ↓
  Invalidar cache → Refetch
  ↓
  ✅ Mostrar datos actualizados
  ↓
setIsChangingCategory(false)
  ↓
✨ Transición suave sin parpadeo
```

### Flujo 3: Botón "Noticias"

```
Usuario → Click botón "Noticias" en sidebar
  ↓
📡 POST /api/ingest/news (categoría actual)
  ↓
Guardar nuevos artículos en BD
  ↓
Invalidar queries con predicate:
  ['news-infinite', category] → INVALIDATE ✅
  ['news', category] → INVALIDATE ✅
  ↓
React Query refetch automático
  ↓
✅ UI actualizada sin F5
```

---

## 🧪 Testing

### Test 1: Sin Parpadeo al Cambiar Categoría

**Pasos:**
1. Navegar a General
2. Click en "Deportes"
3. **Verificar:**
   - ✅ Skeleton aparece inmediatamente
   - ✅ NO se ven noticias de "General"
   - ✅ Mensaje "Cargando noticias frescas..."
   - ✅ Transición suave a "Deportes"

### Test 2: Sin Warnings de Imágenes

**Pasos:**
1. Abrir consola frontend
2. Recargar página
3. **Verificar:**
   - ✅ NO aparece: `⨯ The requested resource isn't a valid image`
   - ✅ Solo logs normales

### Test 3: Auto-Reload con TTL

**Primera recarga:**
```
F5 → Consola:
📥 [AUTO-RELOAD] Primera ingesta para categoría: general
✅ [AUTO-RELOAD] Ingesta completada: 5 nuevos artículos
```

**Segunda recarga (< 1h):**
```
F5 → Consola:
💰 [AUTO-RELOAD] Última ingesta hace 15min - SALTANDO (TTL: 60min)
```

**Tercera recarga (> 1h):**
```
F5 → Consola:
🔄 [AUTO-RELOAD] Última ingesta hace 62min - Actualizando...
✅ [AUTO-RELOAD] Ingesta completada: 3 nuevos artículos
```

### Test 4: Botón "Noticias"

**Pasos:**
1. Navegar a Tecnología
2. Esperar 5 segundos
3. Click botón "Noticias"
4. **Verificar consola:**
   ```
   🔍 [REFRESH] Evaluating query: ["news-infinite","tecnologia",20] → INVALIDATE
   ```
5. **Verificar UI:**
   - ✅ Pequeño spinner "Actualizando..."
   - ✅ Lista se actualiza automáticamente
   - ✅ Sin necesidad de F5

---

## 📁 Archivos Modificados

1. **frontend/app/page.tsx**
   - Agregado estado `isChangingCategory`
   - Mejorado `handleCategoryChange`
   - Agregado useEffect para detectar fin de carga
   - Modificado renderizado condicional
   - Agregado useEffect para auto-reload con TTL

2. **frontend/components/news-card.tsx**
   - Agregada función `isVideoUrl()`
   - Filtrado condicional de `<Image>`

3. **frontend/components/layout/sidebar.tsx**
   - Cambiado `queryClient.invalidateQueries` a predicate
   - Logs mejorados

---

## ✅ Resumen de Mejoras

| Problema | Estado | Solución |
|----------|--------|----------|
| Parpadeo al cambiar categoría | ✅ FIJADO | Loading state + ocultar datos viejos |
| Warnings de imágenes | ✅ FIJADO | Filtrar videos con `isVideoUrl()` |
| No actualización al recargar | ✅ FIJADO | Auto-ingesta con TTL localStorage |
| Botón "Noticias" no funciona | ✅ FIJADO | Query key predicate |

---

## 🎯 Comportamiento Esperado Logrado

- ✅ **Al acceder:** Muestra noticias < 1h, si no hay → fetch RSS (con TTL)
- ✅ **Al navegar:** Mismo comportamiento, noticias frescas automáticamente
- ✅ **NO muestra datos viejos:** Skeleton suave durante carga
- ✅ **Sin parpadeos:** Transición limpia y profesional
- ✅ **Optimización:** Máximo 1 ingesta/hora por categoría

---

## 🚀 Próximos Pasos Opcionales

1. **Animación de entrada:** Fade-in para las cards al cargar
2. **Pre-carga:** Prefetch de categorías adyacentes
3. **Toast notifications:** Avisar cuando hay noticias nuevas
4. **Pull-to-refresh:** Gesto táctil en móviles

---

**Status:** Todos los fixes aplicados y funcionando ✅
