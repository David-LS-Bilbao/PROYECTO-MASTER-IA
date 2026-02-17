# Smart Ingestion - Optimización de Costes (Sprint 16)

## 🎯 Objetivo
Reducir costes de API de IA evitando ingestas automáticas innecesarias cuando la base de datos ya tiene contenido reciente.

## 📊 Regla de Negocio

**Auto-ingesta se dispara SOLO si:**
1. ❌ No hay noticias en la base de datos para la categoría
2. ⏰ O la noticia más reciente tiene **más de 1 HORA** de antigüedad

**Si los datos son frescos (< 1 hora):**
- ✅ NO se hace ingesta automática (ahorro de ~50 artículos × análisis IA)
- ✅ Se hace refetch de base de datos (muestra datos existentes)
- ✅ Usuario puede forzar ingesta manual con el botón si lo desea

## 🔧 Implementación

### Archivo Modificado
**`frontend/app/page.tsx`** (líneas 160-185)

### Lógica Implementada

```typescript
// Verificar TTL de 1 hora antes de disparar ingesta
const latestArticle = newsData?.data?.[0]; // Artículo más reciente (ordenado por fecha desc)
const lastUpdate = latestArticle?.publishedAt
  ? new Date(latestArticle.publishedAt).getTime()
  : 0;
const now = Date.now();
const oneHour = 60 * 60 * 1000; // 1 hora en milisegundos
const ageInMinutes = Math.round((now - lastUpdate) / (60 * 1000));

const shouldAutoRefresh = !latestArticle || (now - lastUpdate > oneHour);

if (!shouldAutoRefresh) {
  console.log(`💰 [SMART INGESTION] Datos frescos en BD (${ageInMinutes} min) - SALTANDO ingesta automática`);
  console.log(`   → Ahorro: ~50 artículos × análisis IA no procesados innecesariamente`);
  console.log(`   → Última noticia: "${latestArticle?.title?.substring(0, 60)}..."`);
  // Solo invalidar caché para refetch de BD, sin ingesta RSS
  invalidateNews(category);
  return;
}
```

## 📈 Impacto Esperado

### Escenario de Usuario Típico
Usuario cambia entre categorías cada 5 minutos:
- **Deportes** → **Economía** → **Portada** → **Tecnología** → **Deportes** (ciclo)

#### Antes (Sin Smart Ingestion)
- 4 cambios de categoría = 4 ingestas automáticas
- 4 × 50 artículos = **200 artículos procesados**
- Costo: 200 × análisis IA (sentimiento, bias, etc.)

#### Ahora (Con Smart Ingestion)
- 1er ciclo (datos vacíos): 4 ingestas (200 artículos) ✅
- 2do ciclo (< 1h): 0 ingestas **→ AHORRO de 200 artículos** 💰
- 3er ciclo (< 1h): 0 ingestas **→ AHORRO de 200 artículos** 💰
- 4to ciclo (> 1h): 4 ingestas (200 artículos) ✅

**Ahorro estimado: 66% de ingestas innecesarias**

### Cálculo de Ahorro Mensual

Asumiendo:
- 100 usuarios activos/mes
- Cada usuario cambia de categoría 20 veces al día
- Días activos: 20 días/mes

**Sin Smart Ingestion:**
- 100 usuarios × 20 cambios/día × 20 días × 50 artículos = **2,000,000 artículos/mes**

**Con Smart Ingestion (66% ahorro):**
- 2,000,000 × 0.66 = **1,320,000 artículos ahorrados/mes** 💰

## 🔍 Logging y Monitoreo

### Consola del Navegador (DevTools)

**Cuando se salta la ingesta (datos frescos):**
```
💰 [SMART INGESTION] Datos frescos en BD (25 min) - SALTANDO ingesta automática
   → Ahorro: ~50 artículos × análisis IA no procesados innecesariamente
   → Última noticia: "Sánchez anuncia nuevas medidas económicas..."
```

**Cuando se ejecuta la ingesta (datos antiguos):**
```
📥 [AUTO-INGESTA] Iniciando ingesta (datos > 1h o vacíos)
   → Antigüedad: 2h
✅ [AUTO-INGESTA] Completada: Successfully ingested 17 new articles
📊 [AUTO-INGESTA] Nuevos artículos: 17
♻️  [AUTO-INGESTA] Artículos actualizados: 3
🔄 [SMART INGESTION] Artículos frescos ingresados - BD actualizada
```

**Cuando no hay artículos nuevos (feeds sin cambios):**
```
📥 [AUTO-INGESTA] Iniciando ingesta (datos > 1h o vacíos)
   → Antigüedad: 1.5h
✅ [AUTO-INGESTA] Completada: Successfully ingested 0 new articles
📊 [AUTO-INGESTA] Nuevos artículos: 0
♻️  [AUTO-INGESTA] Artículos actualizados: 50
💰 [SMART INGESTION] Sin artículos nuevos - próxima vez se saltará por TTL
```

## ⚙️ Configuración

### Ajustar el TTL (Time To Live)

**Actual: 1 hora**
```typescript
const oneHour = 60 * 60 * 1000; // 1 hora en milisegundos
```

**Para cambiar a 30 minutos:**
```typescript
const thirtyMinutes = 30 * 60 * 1000; // 30 minutos
```

**Para cambiar a 2 horas:**
```typescript
const twoHours = 2 * 60 * 60 * 1000; // 2 horas
```

### Deshabilitar Smart Ingestion (volver al comportamiento anterior)

Si necesitas temporalmente deshabilitar esta optimización:

```typescript
const shouldAutoRefresh = true; // Forzar siempre ingesta
```

## 🧪 Testing

### Test Manual

1. **Primera carga (BD vacía):**
   - Cambiar a "Deportes" → Debe hacer ingesta (datos vacíos)
   - Consola: `📥 [AUTO-INGESTA] Iniciando ingesta (datos > 1h o vacíos)`

2. **Cambio rápido (< 1h):**
   - Cambiar a "Economía" → Debe saltar ingesta (datos frescos)
   - Consola: `💰 [SMART INGESTION] Datos frescos en BD (X min) - SALTANDO ingesta automática`

3. **Volver a Deportes (< 1h):**
   - Cambiar a "Deportes" → Debe saltar ingesta (datos frescos)
   - Consola: `💰 [SMART INGESTION] Datos frescos en BD...`

4. **Esperar 1 hora y cambiar:**
   - Esperar > 1h
   - Cambiar a cualquier categoría → Debe hacer ingesta (datos antiguos)
   - Consola: `📥 [AUTO-INGESTA] Iniciando ingesta...`

### Test de Regresión

Verificar que estos flujos sigan funcionando:
- ✅ Botón "Últimas noticias" siempre hace ingesta (no afectado por TTL)
- ✅ Primera carga de la app siempre muestra datos (sin ingesta inicial)
- ✅ Categoría "Favoritos" no hace ingesta RSS (solo refetch de BD)
- ✅ Backend no disponible: refetch de BD sin ingesta

## 📝 Notas Técnicas

### ¿Por qué `publishedAt` y no `createdAt`?

Usamos `publishedAt` porque:
- Refleja cuándo se publicó el artículo en el medio original
- Es más relevante para determinar la "frescura" de las noticias
- `createdAt` podría ser cuando se ingresó en nuestra BD (menos útil para TTL)

### ¿Por qué 1 hora?

Balance entre:
- **Frescura**: Categorías dinámicas (deportes) tienen noticias cada 30-60 min
- **Costes**: Evitar ingestas excesivas para usuarios que navegan rápido
- **UX**: Usuario no nota diferencia si datos tienen < 1h (son "recientes")

### Dependencias del useEffect

El useEffect depende de:
- `category`: Para detectar cambios de categoría
- `invalidateNews`: Función de invalidación de caché
- `isBackendAvailable`: Estado de disponibilidad del backend

**NO depende de `newsData`** para evitar loops infinitos. El valor de `newsData` se lee dentro del setTimeout, capturando el valor actual en el momento de ejecución.

## 🚀 Próximas Mejoras

1. **TTL Dinámico por Categoría:**
   ```typescript
   const ttlByCategory = {
     deportes: 30 * 60 * 1000,  // 30 min (muy dinámico)
     general: 60 * 60 * 1000,    // 1 hora
     cultura: 2 * 60 * 60 * 1000 // 2 horas (menos dinámico)
   };
   ```

2. **Métricas de Ahorro:**
   - Trackear cuántas ingestas se saltan
   - Calcular ahorro mensual real
   - Dashboard de costes optimizados

3. **Backend-Side TTL:**
   - Endpoint `/api/ingest/should-refresh/:category`
   - Backend decide si hace falta ingesta basado en metadata
   - Evita lógica duplicada en frontend

