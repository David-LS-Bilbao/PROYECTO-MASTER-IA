# 🔧 Sprint 16 - Fix Duplicados en Ingesta de Noticias

**Fecha:** 5 de febrero de 2026  
**Objetivo:** Resolver problema de duplicidad percibida en feeds al navegar entre categorías

---

## 🎯 Problema Identificado

### Síntomas
Usuario reporta que al navegar entre categorías (General → Economía → General), las noticias que comparten temática aparecen duplicadas en el feed principal.

### Causa Raíz
El sistema tenía una lógica de **deduplicación prematura** que impedía actualizar metadata de artículos ya existentes:

```typescript
// ❌ ANTES (INCORRECTO)
if (existingUrls.has(apiArticle.url)) {
  duplicates++;
  continue; // Salta el artículo, NO ejecuta upsert
}
```

**Consecuencia:**
- Si una noticia existía con `category="general"` y llegaba via RSS en `category="deportes"`
- Se detectaba como duplicado por URL
- Se OMITÍA del array `articlesToSave`
- ❌ NO se ejecutaba el UPSERT para actualizar la categoría
- La noticia seguía en "general", nunca aparecía en "deportes"

---

## ✅ Soluciones Implementadas

### 1. **Backend - UseCase Refactor** 
**Archivo:** [`backend/src/application/use-cases/ingest-news.usecase.ts`](backend/src/application/use-cases/ingest-news.usecase.ts)

**Cambios:**
- ✅ Eliminada la lógica de `continue` que omitía duplicados
- ✅ TODOS los artículos pasan ahora por upsert (actualiza si existe, crea si es nuevo)
- ✅ Logging mejorado para distinguir entre nuevas/actualizadas

```typescript
// ✅ DESPUÉS (CORRECTO)
const isExisting = existingUrls.has(apiArticle.url);
if (isExisting) {
  updatedArticles++;
  console.log(`♻️  URL existente (se actualizará): ${apiArticle.url}...`);
}
// NO hay continue, el artículo se añade a articlesToSave
articlesToSave.push(article);
```

**Resultado:**
- **Nuevas:** Artículos con URLs no vistas antes → INSERT
- **Actualizadas:** Artículos con URLs existentes → UPDATE (categoría, metadata)

---

### 2. **Backend - Mapper Update Strategy**
**Archivo:** [`backend/src/infrastructure/persistence/article-mapper.ts`](backend/src/infrastructure/persistence/article-mapper.ts)

**Cambios:**
- ✅ Update ahora es **selectivo** (solo actualiza metadata que puede cambiar)
- ✅ Preserva análisis IA existente (no re-analiza artículos solo por cambio de categoría)

```typescript
update: {
  // Actualizar metadata dinámica
  title: article.title,
  description: article.description,
  content: article.content,
  urlToImage: article.urlToImage,
  author: article.author,
  category: article.category, // ✅ CRÍTICO: Actualizar categoría
  // NO actualizar: embedding, summary, biasScore, analysis, analyzedAt
  updatedAt: new Date(),
},
```

**Beneficios:**
- ⚡ Más eficiente (no re-ejecuta análisis IA innecesarios)
- 🛡️ Preserva favoritos del usuario
- 📊 Mantiene trazabilidad (analyzedAt no se resetea)

---

### 3. **Backend - Repository Logging**
**Archivo:** [`backend/src/infrastructure/persistence/prisma-news-article.repository.ts`](backend/src/infrastructure/persistence/prisma-news-article.repository.ts)

**Cambios:**
- ✅ Logging detallado antes/después del upsert
- ✅ Muestra URLs y categorías procesadas

```typescript
console.log(`[Repository] 💾 Ejecutando UPSERT para ${articles.length} artículos`);
console.log(`[Repository] 📂 Categorías: ${categories.join(', ')}`);
console.log(`[Repository] ✅ UPSERT completado exitosamente`);
```

---

### 4. **Frontend - Cache Invalidation Global**
**Archivos:** 
- [`frontend/hooks/useNews.ts`](frontend/hooks/useNews.ts)
- [`frontend/app/page.tsx`](frontend/app/page.tsx)

**Problema previo:**
Después de auto-ingesta, solo se invalidaba la categoría actual. Si una noticia se actualizaba en otra categoría, el cache stale seguía mostrando datos antiguos.

**Solución:**
```typescript
// ❌ ANTES
invalidateNews(category); // Solo invalida categoría actual

// ✅ DESPUÉS
invalidateNews(category, true); // true = invalidate ALL categories
```

**Implementación en `useInvalidateNews`:**
```typescript
(category?: CategoryId, invalidateAll: boolean = false) => {
  if (invalidateAll) {
    console.log('🔄 Invalidando TODAS las categorías');
    queryClient.invalidateQueries({ queryKey: ['news'] });
  } else if (category) {
    queryClient.invalidateQueries({ queryKey: ['news', category] });
  }
}
```

**Beneficios:**
- ✅ Cualquier cambio en BD se refleja en TODAS las vistas
- ✅ Evita inconsistencias entre categorías
- ✅ Cache siempre sincronizado después de ingesta

---

## 🧪 Testing Recomendado

### Test Manual
```bash
# 1. Ejecutar backend
cd backend
npm run dev

# 2. Ejecutar frontend
cd frontend
npm run dev

# 3. Probar flujo:
# - Ir a "General" → Observar noticias A, B, C
# - Ir a "Economía" → Auto-ingesta trae noticia B (compartida)
# - Volver a "General" → Noticia B debe aparecer actualizada
# - NO debe haber duplicados
```

### Verificar BD
```bash
# Ejecutar script SQL de verificación
cd backend
npx prisma studio

# O ejecutar check-duplicates.sql
npm run db:check-duplicates
```

Script SQL: [`backend/scripts/check-duplicates.sql`](backend/scripts/check-duplicates.sql)

---

## 📊 Logs Esperados

### Backend - Ingesta Exitosa
```
📥 Ingesta: Recibidos 30 artículos, procesando 30 (límite: 30)
🔍 Pre-ingesta: 12 URLs ya existen, 18 son nuevas
📝 Estrategia: Usar UPSERT para TODAS las URLs
♻️  URL existente (se actualizará): https://example.com/noticia1...
[Repository] 💾 Ejecutando UPSERT para 30 artículos
[Repository] 📂 Categorías: deportes
[Repository] ✅ UPSERT completado exitosamente para 30 artículos
✅ Ingesta completada:
   📝 Nuevas: 18 | ♻️  Actualizadas: 12 | ❌ Errores: 0
   📂 Categoría aplicada: "deportes"
```

### Frontend - Auto-Ingesta
```
📥 [AUTO-INGESTA] Iniciando ingesta automática para: deportes
✅ [AUTO-INGESTA] Completada: Ingested 30 articles successfully
📊 [AUTO-INGESTA] Nuevos artículos: 18
♻️  [AUTO-INGESTA] Artículos actualizados: 12
🔄 [useInvalidateNews] Invalidando TODAS las categorías
🌐 [useNews] ========== EJECUTANDO queryFn ==========
✅ [useNews] Fetch completado en 234ms. Artículos: 50
```

---

## 🔍 Comandos de Verificación

### Verificar duplicados en BD
```bash
# SQL directo
SELECT url, COUNT(*) as count
FROM articles
GROUP BY url
HAVING COUNT(*) > 1;

# Resultado esperado: 0 filas (sin duplicados)
```

### Verificar distribución de categorías
```bash
SELECT 
  category,
  COUNT(*) as total_articles,
  COUNT(DISTINCT url) as unique_urls
FROM articles
GROUP BY category
ORDER BY total_articles DESC;
```

### Limpiar cache frontend (si necesario)
```javascript
// En DevTools Console
localStorage.clear();
location.reload();
```

---

## 📝 Decisiones Arquitectónicas

### ¿Por qué NO usar array de categorías?
**Opción evaluada:** Cambiar `category: String?` → `categories: String[]`

**Decisión:** NO implementado en Sprint 16  
**Razón:**
- Mayor complejidad (migración, queries, UI)
- El problema se resuelve con upsert + invalidación correcta
- Política actual: "Última categoría ingested gana" es aceptable para MVP

**Futuro (opcional):** Si el PM requiere multi-categorización:
- Crear tabla `ArticleCategory` (N:N)
- Actualizar queries para JOIN
- UI con badges de múltiples categorías

---

## ✅ Checklist de Implementación

- [x] Refactor UseCase para remover skip de duplicados
- [x] Actualizar mapper con update strategy selectiva
- [x] Mejorar logging en repository
- [x] Fix frontend cache invalidation (invalidateAll)
- [x] Crear script SQL de verificación
- [x] Documentar cambios (este archivo)
- [ ] Test manual del flujo completo
- [ ] Verificar en Sentry que no hay errores nuevos
- [ ] Actualizar ESTADO_PROYECTO.md

---

## 🚀 Próximos Pasos

1. **Ejecutar test manual** del flujo descrito arriba
2. **Monitorear Sentry** por 24h para detectar regresiones
3. **Recopilar feedback** del usuario final
4. Si persisten duplicados visuales, investigar:
   - Race conditions en React Query
   - Stale closure en useEffect
   - Problemas de rendering en CategoryPills

---

## 📚 Referencias

- [ESTADO_PROYECTO.md](ESTADO_PROYECTO.md) - Estado general del proyecto
- [SPRINT_16_UX_POLISH_FRESHNESS.md](SPRINT_16_UX_POLISH_FRESHNESS.md) - Sprint anterior
- [Prisma Upsert Documentation](https://www.prisma.io/docs/orm/prisma-client/queries/crud#update-or-create-records)
- [React Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation)

---

**Estado:** ✅ Implementado | 🧪 Pendiente Testing Manual  
**Autor:** GitHub Copilot (Senior Backend Architect)  
**Aprobación PM:** Pendiente
