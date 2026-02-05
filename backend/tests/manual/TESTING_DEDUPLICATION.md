# 🧪 Instrucciones de Prueba - Fix Duplicados

## Pre-requisitos
1. Backend corriendo: `cd backend && npm run dev`
2. Frontend corriendo: `cd frontend && npm run dev`
3. Base de datos PostgreSQL activa
4. Variable de entorno `NEWS_API_KEY` configurada

---

## 🎯 Test Automático (Recomendado)

### Paso 1: Ejecutar suite de tests
```bash
cd backend
npm run test:dedup
```

**Tests incluidos:**
- ✅ Verificar que no hay duplicados por URL en BD
- ✅ Mostrar distribución de artículos por categoría
- ✅ Simular update de categoría en artículo existente
- ✅ Verificar que análisis IA se preserva en updates

**Resultado esperado:**
```
✅ TEST 1 PASSED: No hay duplicados por URL
✅ TEST 2 PASSED: Distribución correcta
✅ TEST 3 PASSED: Categoría actualizada correctamente
✅ TEST 4 PASSED: Análisis IA preservado en update
```

---

## 🖱️ Test Manual (UX Flow)

### Escenario 1: Navegación entre categorías

1. **Abrir frontend:** http://localhost:3001
2. **Ir a "General":**
   - Observar noticias cargadas
   - Anotar mentalmente títulos de las primeras 5 noticias
3. **Cambiar a "Economía":**
   - Esperar auto-ingesta (300ms debounce)
   - Observar spinner/loading
   - Verificar que noticias económicas aparecen
4. **Volver a "General":**
   - Verificar que las noticias originales siguen ahí
   - ❌ NO debe haber duplicados visuales
   - ✅ Noticias que comparten temas pueden aparecer en ambas categorías (esperado)

### Escenario 2: Auto-ingesta con updates

1. **Abrir DevTools Console** (F12)
2. **Ir a "Deportes":**
   - Observar logs de auto-ingesta:
     ```
     📥 [AUTO-INGESTA] Iniciando ingesta automática para: deportes
     ✅ [AUTO-INGESTA] Completada
     📊 [AUTO-INGESTA] Nuevos artículos: X
     ♻️  [AUTO-INGESTA] Artículos actualizados: Y
     🔄 [useInvalidateNews] Invalidando TODAS las categorías
     ```
3. **Cambiar a otra categoría:**
   - Verificar que cache se invalidó (refetch automático)
   - No debe haber datos stale

### Escenario 3: Artículos compartidos entre categorías

**Objetivo:** Verificar que una noticia puede aparecer en múltiples categorías sin duplicarse en BD

1. **Limpiar BD (opcional):**
   ```bash
   cd backend
   npx prisma migrate reset --force
   ```

2. **Ejecutar ingesta manual en "General":**
   ```bash
   curl -X POST http://localhost:3000/api/ingest/news \
     -H "Content-Type: application/json" \
     -d '{"pageSize": 20}'
   ```

3. **Verificar BD:**
   ```bash
   npm run db:check-duplicates
   ```
   **Resultado esperado:** 0 duplicados

4. **Ejecutar ingesta manual en "Deportes":**
   ```bash
   curl -X POST http://localhost:3000/api/ingest/news \
     -H "Content-Type: application/json" \
     -d '{"category": "deportes", "pageSize": 20}'
   ```

5. **Volver a verificar BD:**
   ```bash
   npm run db:check-duplicates
   ```
   **Resultado esperado:** Sigue 0 duplicados

6. **Revisar logs del backend:**
   - Buscar líneas con `♻️  URL existente (se actualizará)`
   - Estas son URLs que ya existían y se actualizaron con nueva categoría

---

## 🔍 Verificación en Base de Datos

### Opción 1: Prisma Studio (GUI)
```bash
cd backend
npx prisma studio
```
- Abrir tabla `Article`
- Filtrar por `url` para buscar duplicados manualmente

### Opción 2: SQL directo
```bash
cd backend
npm run db:check-duplicates
```

### Opción 3: psql (PostgreSQL CLI)
```bash
psql -U postgres -d verity_news

-- Verificar duplicados
SELECT url, COUNT(*) as count
FROM articles
GROUP BY url
HAVING COUNT(*) > 1;

-- Ver distribución de categorías
SELECT category, COUNT(*) FROM articles GROUP BY category;
```

---

## 📊 Métricas de Éxito

### ✅ Tests Pasaron Si:

1. **No hay duplicados en BD:**
   - Consulta SQL retorna 0 filas
   - Cada URL aparece EXACTAMENTE 1 vez

2. **Upsert funciona correctamente:**
   - Logs muestran "Actualizadas: N" cuando re-ingesta URLs existentes
   - Categoría se actualiza correctamente
   - ID del artículo NO cambia (mismo registro)

3. **Análisis IA se preserva:**
   - `summary`, `biasScore`, `analysis` NO se resetean a null
   - Solo `category`, `title`, `description` se actualizan

4. **Frontend muestra datos frescos:**
   - Después de auto-ingesta, cache se invalida
   - NO hay noticias stale de categorías anteriores
   - NO hay duplicados visuales (mismo artículo 2 veces en lista)

### ❌ Tests Fallaron Si:

- Aparecen URLs duplicadas en BD (mismo URL, diferente ID)
- Frontend muestra la misma noticia 2 veces en la misma vista
- Logs muestran errores de unique constraint
- Cache no se invalida después de auto-ingesta

---

## 🐛 Debugging

### Si hay duplicados en BD:
```bash
# Limpiar duplicados manualmente
cd backend
npx tsx scripts/cleanup-duplicates.ts  # Crear este script si es necesario
```

### Si frontend muestra duplicados visuales:
1. Abrir DevTools → Application → Storage → Clear all
2. Recargar página (Ctrl+Shift+R)
3. Revisar logs de React Query

### Si auto-ingesta no actualiza categorías:
1. Verificar logs del backend: Buscar `♻️  URL existente`
2. Revisar `article-mapper.ts`: Asegurar que `category` está en `update`
3. Revisar `ingest-news.usecase.ts`: Asegurar que NO hay `continue` que omita artículos

---

## 📝 Checklist Final

- [ ] `npm run test:dedup` pasa todos los tests
- [ ] `npm run db:check-duplicates` retorna 0 filas
- [ ] Test manual: Navegación General → Economía → General sin duplicados
- [ ] DevTools Console: Logs muestran invalidación de TODAS las categorías
- [ ] Prisma Studio: Verificar que URLs son únicas
- [ ] Sentry: No hay errores nuevos relacionados con upsert
- [ ] Performance: Auto-ingesta completa en <5s

---

## 🚀 Comandos Rápidos

```bash
# Backend tests
cd backend
npm run test:dedup              # Suite completa de tests
npm run db:check-duplicates     # Solo verificar duplicados SQL
npx prisma studio               # GUI para inspeccionar BD

# Frontend debugging
cd frontend
npm run dev                     # Iniciar con hot-reload
# En browser: localStorage.clear() + F5

# Logs en tiempo real
cd backend
npm run dev | grep "INGESTA\|Repository\|UPSERT"  # Filtrar logs relevantes
```

---

**Última actualización:** 5 de febrero de 2026  
**Responsable:** GitHub Copilot (Senior Backend Architect)
