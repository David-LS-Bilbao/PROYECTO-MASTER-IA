# ✅ Sprint 16 - Fix Duplicados: Resumen Ejecutivo

**Fecha:** 5 de febrero de 2026  
**Estado:** ✅ Implementado - Pendiente Testing Manual  
**Impacto:** 🔴 Alto (UX crítico)

---

## 🎯 Problema Resuelto

**Síntoma Original:**
Usuario reportaba noticias "duplicadas" al navegar entre categorías (General → Economía → General).

**Causa Raíz Identificada:**
El sistema omitía artículos duplicados ANTES del upsert, impidiendo actualizar la categoría cuando una misma URL aparecía en múltiples feeds RSS.

```typescript
// ❌ ANTES: Omitía duplicados, no ejecutaba upsert
if (existingUrls.has(url)) {
  duplicates++;
  continue; // ← Problema: No actualiza metadata
}

// ✅ DESPUÉS: Permite upsert de todos los artículos
const isExisting = existingUrls.has(url);
if (isExisting) updatedArticles++;
// No hay continue, se ejecuta upsert que actualiza o inserta
```

---

## 🔧 Cambios Implementados

### 1. Backend - UseCase (Core Logic)
**Archivo:** `backend/src/application/use-cases/ingest-news.usecase.ts`

- ✅ Eliminado el `continue` que omitía duplicados
- ✅ Todos los artículos pasan por upsert (update si existe, insert si es nuevo)
- ✅ Logging mejorado: Distingue entre nuevas (INSERT) y actualizadas (UPDATE)

**Impacto:** Ahora si una noticia existe con `category="general"` y llega con `category="deportes"`, se ACTUALIZA la categoría.

---

### 2. Backend - Mapper (Update Strategy)
**Archivo:** `backend/src/infrastructure/persistence/article-mapper.ts`

- ✅ Update selectivo: Solo actualiza metadata (title, description, content, category, urlToImage, author)
- ✅ Preserva análisis IA: No resetea summary, biasScore, analysis, analyzedAt
- ✅ Preserva favoritos del usuario: No toca isFavorite

**Beneficio:** Eficiencia - No re-analiza artículos solo por cambio de categoría.

---

### 3. Backend - Repository (Observability)
**Archivo:** `backend/src/infrastructure/persistence/prisma-news-article.repository.ts`

- ✅ Logging detallado antes/después de transaction
- ✅ Muestra URLs, categorías y cantidad procesada

**Beneficio:** Debugging más fácil, visibilidad en producción.

---

### 4. Frontend - Cache Invalidation
**Archivos:** 
- `frontend/hooks/useNews.ts`
- `frontend/app/page.tsx`

**Cambio Crítico:**
```typescript
// ❌ ANTES: Solo invalidaba categoría actual
invalidateNews(category);

// ✅ DESPUÉS: Invalida TODAS las categorías
invalidateNews(category, true); // true = invalidate ALL
```

**Razón:** Si un artículo cambia de categoría, TODAS las vistas deben refrescar el cache.

**Impacto:** Elimina inconsistencias entre categorías después de auto-ingesta.

---

## 📊 Resultados Esperados

### BD (PostgreSQL)
```sql
-- NO debe retornar filas (0 duplicados)
SELECT url, COUNT(*) FROM articles GROUP BY url HAVING COUNT(*) > 1;
```

### Logs Backend
```
🔍 Pre-ingesta: 12 URLs ya existen, 18 son nuevas
♻️  URL existente (se actualizará): https://...
[Repository] 💾 Ejecutando UPSERT para 30 artículos
✅ Ingesta completada:
   📝 Nuevas: 18 | ♻️  Actualizadas: 12 | ❌ Errores: 0
```

### Logs Frontend
```
🔄 [useInvalidateNews] Invalidando TODAS las categorías
✅ [useNews] Fetch completado en 234ms. Artículos: 50
```

---

## 🧪 Testing

### Ejecución Rápida
```bash
# Test automático completo
cd backend
npm run test:dedup

# Verificar duplicados en BD
npm run db:check-duplicates

# Inspección visual
npx prisma studio
```

### Test Manual (UX)
1. Frontend en http://localhost:3001
2. Navegar: General → Economía → General
3. Verificar: NO hay duplicados visuales
4. DevTools Console: Validar logs de invalidación

**Documentación completa:** `backend/tests/manual/TESTING_DEDUPLICATION.md`

---

## 📁 Archivos Modificados

| Archivo | Cambios | LOC |
|---------|---------|-----|
| `backend/src/application/use-cases/ingest-news.usecase.ts` | Remover skip de duplicados, logging mejorado | ~30 |
| `backend/src/infrastructure/persistence/article-mapper.ts` | Update selectivo (preservar IA) | ~10 |
| `backend/src/infrastructure/persistence/prisma-news-article.repository.ts` | Logging detallado | ~5 |
| `frontend/hooks/useNews.ts` | Parámetro invalidateAll | ~15 |
| `frontend/app/page.tsx` | Usar invalidateAll después de ingesta | ~6 |

**Total:** ~66 líneas modificadas/añadidas

---

## 📁 Archivos Creados

| Archivo | Propósito |
|---------|-----------|
| `backend/scripts/check-duplicates.sql` | Queries SQL para verificar duplicados |
| `backend/tests/manual/test-deduplication.ts` | Suite de tests automatizados |
| `backend/tests/manual/TESTING_DEDUPLICATION.md` | Instrucciones paso a paso |
| `SPRINT_16_FIX_DUPLICADOS.md` | Documentación técnica completa |

---

## ⚠️ Decisiones Arquitectónicas

### ¿Por qué NO implementar array de categorías?

**Opción evaluada:** `category: String?` → `categories: String[]`

**Decisión:** Rechazado para Sprint 16  
**Motivos:**
1. Mayor complejidad (migración, queries, JOIN N:N)
2. El problema se resuelve con upsert + invalidación correcta
3. Política "última categoría gana" es aceptable para MVP
4. Puede implementarse en Sprint futuro si PM lo requiere

---

## ✅ Checklist de Implementación

- [x] Código refactorizado (UseCase, Mapper, Repository)
- [x] Frontend cache invalidation arreglado
- [x] Logging mejorado en todo el flujo
- [x] TypeScript compila sin errores
- [x] Tests automatizados creados
- [x] Documentación completa generada
- [x] Scripts npm añadidos
- [ ] **Testing manual ejecutado** ← PRÓXIMO PASO
- [ ] **Validación en Sentry** (monitorear 24h)
- [ ] **Feedback del usuario final**
- [ ] **Actualizar ESTADO_PROYECTO.md**

---

## 🚀 Próximos Pasos

1. **INMEDIATO:**
   ```bash
   cd backend
   npm run test:dedup  # Ejecutar suite de tests
   ```

2. **Validación UX:**
   - Test manual siguiendo `TESTING_DEDUPLICATION.md`
   - Revisar DevTools Console para logs

3. **Monitoreo (24-48h):**
   - Sentry: Detectar errores de upsert
   - Logs producción: Verificar ratio Nuevas/Actualizadas
   - Feedback usuario: Confirmar que duplicados desaparecieron

4. **Si todo OK:**
   - Actualizar `ESTADO_PROYECTO.md` con resumen
   - Cerrar issue/ticket relacionado
   - Planning Sprint 17 (próximas features)

---

## 📞 Contacto

**Implementado por:** GitHub Copilot (Senior Backend Architect)  
**Revisión requerida por:** PM / Tech Lead  
**Documentación:** Ver `SPRINT_16_FIX_DUPLICADOS.md` para detalles técnicos

---

**TL;DR:**  
El sistema ahora ACTUALIZA categorías en lugar de omitir duplicados. Cache del frontend se invalida globalmente después de ingesta. Testing pendiente.
