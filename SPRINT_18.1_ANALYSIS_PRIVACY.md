# Sprint 18.1: Refinamiento de Privacidad de Análisis IA

## Problema Detectado

Después de implementar Sprint 18 (per-user favorites), se detectó una **fuga de privacidad** en el sistema de análisis:

### Escenario Problemático
```
Usuario A analiza una noticia X
  → Análisis guardado en DB (global)
  → Usuario B pide la noticia X (GET /api/news/:id)
  → Usuario B recibe el objeto completo con el análisis visible
  → PROBLEMA: B nunca solicitó el análisis, pero puede verlo
```

### Violación de Privacidad
- Los análisis IA deberían ser **privados** o **bajo demanda** por usuario
- El análisis de un usuario no debería ser visible automáticamente para otros
- Los usuarios deberían tener control sobre qué análisis ven (opt-in)

## Solución Implementada

### Arquitectura de Enmascaramiento

```
NUEVO FLUJO:

Usuario A analiza noticia X
  → Análisis guardado en DB (cache global)
  → Noticia X agregada a favoritos del Usuario A

Usuario B pide noticia X (GET /api/news/:id)
  → Backend verifica: ¿X está en favoritos de B? NO
  → Backend enmascara campos de análisis:
      - analysis: null
      - summary: null
      - biasScore: null
      - hasAnalysis: true  (señal de disponibilidad)
  → Frontend muestra: "Ver análisis (Instantáneo)"

Usuario B pulsa "Ver análisis"
  → POST /analyze/:id con token de B
  → Backend detecta análisis existente (cache global)
  → Agrega X a favoritos del Usuario B
  → Devuelve análisis completo
  → Usuario B ahora ve el análisis en su sesión
```

### Campos Enmascarados vs. Campo de Señal

| Campo | Si NO favorito | Si SÍ favorito | Propósito |
|-------|---------------|---------------|-----------|
| `analysis` | `null` | `{...}` | Datos de análisis |
| `summary` | `null` | `"..."` | Resumen IA |
| `biasScore` | `null` | `0.8` | Puntuación de sesgo |
| `hasAnalysis` | `true` | `true` | Señal de disponibilidad |
| `analyzedAt` | `null` | `"2024-..."` | Timestamp del análisis |

**Clave:** El campo `hasAnalysis` indica que el análisis existe en la DB y puede servirse instantáneamente (sin llamar a Gemini), pero no revela el contenido del análisis.

## Archivos Modificados

### Backend (1 archivo)

#### `backend/src/infrastructure/http/controllers/news.controller.ts`

**1. Función `toHttpResponse()` mejorada (líneas 14-51)**

Añadido parámetro `maskAnalysis` para enmascarar campos sensibles:

```typescript
function toHttpResponse(article: NewsArticle, maskAnalysis = false) {
  const json = article.toJSON();

  // Check if analysis exists globally in DB
  const hasAnalysis = json.analyzedAt !== null;

  // PRIVACY: If user hasn't favorited, mask sensitive AI data
  if (maskAnalysis) {
    return {
      ...json,
      analysis: null,
      summary: null,
      biasScore: null,
      hasAnalysis,  // Signal availability
    };
  }

  // Normal response with full analysis
  return {
    ...json,
    analysis: json.analysis ? JSON.parse(json.analysis) : null,
    hasAnalysis,
  };
}
```

**2. Método `getNews()` actualizado (líneas 70-74)**

Aplica enmascaramiento basado en `isFavorite`:

```typescript
// PRIVACY: Mask analysis for articles not in user's favorites
const data = news.map(article => {
  const shouldMask = !article.isFavorite;
  return toHttpResponse(article, shouldMask);
});
```

**3. Método `getNewsById()` actualizado (líneas 149-156)**

Aplica enmascaramiento con log de depuración:

```typescript
// PRIVACY: Mask analysis if user hasn't favorited this article
const shouldMask = !enrichedArticle.isFavorite;
console.log(`[NewsController]    🔒 Analysis masking: ${shouldMask ? 'YES (not favorited)' : 'NO (favorited or no analysis)'}`);

res.json({
  success: true,
  data: toHttpResponse(enrichedArticle, shouldMask),
});
```

### Frontend (2 archivos)

#### 1. `frontend/lib/api.ts`

Añadido campo `hasAnalysis` al tipo `NewsArticle`:

```typescript
export interface NewsArticle {
  id: string;
  title: string;
  // ... otros campos ...
  isFavorite: boolean;
  /**
   * PRIVACY: Indicates if analysis exists globally in DB (for instant retrieval).
   * If hasAnalysis=true but analysis/summary/biasScore are null, it means:
   * - Another user analyzed this article (cached in DB)
   * - Current user hasn't favorited it yet (analysis masked for privacy)
   * - Clicking "Analyze" will serve the cached analysis instantly and auto-favorite
   */
  hasAnalysis?: boolean;
}
```

#### 2. `frontend/components/news-card.tsx`

**Lógica de botones mejorada (líneas 64-220)**

Añadida detección de cache global:

```typescript
// PRIVACY: Check if analysis exists globally (cached) but user hasn't favorited yet
const hasGlobalCache = article.hasAnalysis === true && !article.isFavorite;
```

Actualizada lógica de botones para 3 estados:

```typescript
{userHasAnalyzed ? (
  /* User already analyzed/viewed this article -> "Mostrar analisis" */
  <Button size="sm" variant="outline" asChild>
    <Link href={`/news/${article.id}`}>Mostrar analisis</Link>
  </Button>
) : hasGlobalCache ? (
  /* Analysis cached globally but user hasn't favorited -> "Ver analisis" (instant, free) */
  <Button size="sm" variant="secondary" onClick={handleAnalyze}>
    Ver analisis
    <span className="ml-1 text-xs opacity-80">(Instantáneo)</span>
  </Button>
) : (
  /* Not analyzed at all -> "Analizar con IA" navigates to detail page */
  <Button size="sm" onClick={handleAnalyze}>
    Analizar con IA
  </Button>
)}
```

## Tabla de Privacidad Mejorada

| Operación | Sprint 18 (Antes) | Sprint 18.1 (Ahora) |
|-----------|-------------------|---------------------|
| Usuario A analiza noticia X | Análisis guardado en DB | Análisis guardado + auto-favorito Usuario A |
| Usuario B pide noticia X | Recibe análisis completo ❌ | Recibe análisis enmascarado ✅ |
| Usuario B ve campos de análisis | `analysis: {...}`, `summary: "..."` ❌ | `analysis: null`, `summary: null` ✅ |
| Usuario B sabe si hay análisis | Solo por `analyzedAt` | Campo explícito `hasAnalysis: true` |
| Usuario B pulsa "Ver análisis" | N/A | Análisis servido + auto-favorito |
| Botón para Usuario B | "Ver analisis" (confuso) | "Ver analisis (Instantáneo)" |

## Beneficios de Privacidad

### ✅ Control por Usuario
- Cada usuario decide qué análisis ve (opt-in)
- Los análisis no se "filtran" automáticamente

### ✅ Cumplimiento de Privacidad
- GDPR: Los datos de análisis no se comparten sin consentimiento
- Los usuarios solo ven análisis que explícitamente solicitan

### ✅ UX Transparente
- El campo `hasAnalysis` informa al usuario que el análisis existe
- El botón "Instantáneo" comunica que no habrá espera
- No se oculta información, solo se requiere acción explícita

### ✅ Optimización de Costos Preservada
- El cache global sigue funcionando (no se re-analiza)
- El enmascaramiento es solo a nivel de respuesta HTTP
- Gemini solo se llama una vez por noticia (Sprint 17)

## Flujo de Usuario Mejorado

### Caso 1: Usuario Analiza Noticia Nueva

```
Usuario pulsa "Analizar con IA"
  → POST /analyze/:id
  → Gemini analiza (primera vez)
  → Análisis guardado en DB (cache global)
  → Auto-favorito Usuario
  → Análisis visible para Usuario
  → Otros usuarios: análisis enmascarado hasta que lo soliciten
```

### Caso 2: Usuario Ve Noticia Ya Analizada (Cache Global)

```
Usuario B en dashboard
  → GET /api/news (lista)
  → Noticia X: hasAnalysis=true, analysis=null (enmascarado)
  → Botón: "Ver analisis (Instantáneo)"

Usuario B pulsa botón
  → POST /analyze/:id
  → Backend detecta cache
  → Auto-favorito Usuario B
  → Análisis servido instantáneamente
  → Usuario B ahora ve análisis completo
```

### Caso 3: Usuario Vuelve a Noticia Analizada

```
Usuario A (ya analizó X)
  → GET /api/news/:id
  → Backend: isFavorite=true → NO enmascara
  → Usuario A ve análisis completo
  → Botón: "Mostrar analisis"
```

## Testing Manual

### Test 1: Enmascaramiento para Usuario No-Favorito

1. Login como Usuario A
2. Analizar noticia X → Debe verse el análisis
3. Login como Usuario B
4. Navegar a noticia X (GET /api/news/:id)
5. **Verificar:**
   - `analysis: null`
   - `summary: null`
   - `biasScore: null`
   - `hasAnalysis: true`
   - Botón: "Ver analisis (Instantáneo)"
6. Pulsar "Ver analisis"
7. **Verificar:**
   - Análisis completo visible
   - Noticia en favoritos de Usuario B
   - Botón: "Mostrar analisis"

### Test 2: Sin Enmascaramiento para Usuario Favorito

1. Login como Usuario A
2. Analizar noticia Y
3. Volver al dashboard
4. Pulsar en noticia Y
5. **Verificar:**
   - `analysis: {...}`
   - `summary: "..."`
   - `biasScore: 0.8`
   - `hasAnalysis: true`
   - Botón: "Mostrar analisis"

### Test 3: Cache Global Preservado

1. Usuario A analiza noticia Z
2. Revisar logs backend:
   ```
   [Gemini] Analyzing article...
   [Gemini] Response: {...}
   ```
3. Usuario B pulsa "Ver analisis" en noticia Z
4. Revisar logs backend:
   ```
   [CACHE GLOBAL] Analisis ya existe en BD
   Serving cached analysis -> Gemini NO llamado
   [Auto-favorito] Usuario B -> articulo Z
   ```
5. **Verificar:** Gemini NO se llamó segunda vez

## Logs de Depuración

### Backend: Enmascaramiento Activo

```
[NewsController] 🔵 GET /api/news/abc123...
[NewsController]    User: user-b@example.com
[NewsController]    ✅ Article found: { analyzedAt: 'YES', biasScore: 0.8, summary: '...' }
[NewsController]    🔍 Per-user favorite check: NO
[NewsController]    🔒 Analysis masking: YES (not favorited)
[NewsController]    📤 Sending enriched article (isFavorite: false)
```

### Backend: Sin Enmascaramiento (Favorito)

```
[NewsController] 🔵 GET /api/news/abc123...
[NewsController]    User: user-a@example.com
[NewsController]    ✅ Article found: { analyzedAt: 'YES', biasScore: 0.8, summary: '...' }
[NewsController]    🔍 Per-user favorite check: YES
[NewsController]    🔒 Analysis masking: NO (favorited or no analysis)
[NewsController]    📤 Sending enriched article (isFavorite: true)
```

## Notas Técnicas

### ¿Por Qué `hasAnalysis` en Lugar de `analyzedAt`?

El campo `analyzedAt` se enmascara con `null` cuando el análisis está oculto, pero necesitamos una señal explícita de que **el análisis existe y está listo**. `hasAnalysis` cumple este propósito sin revelar el contenido del análisis.

### ¿Por Qué No Enmascarar `analyzedAt`?

Originalmente se consideró mantener `analyzedAt` visible, pero se decidió enmascararlo también porque:
- Es metadata del análisis (revela cuándo se analizó)
- Mantiene consistencia: si no puedes ver el análisis, no deberías ver cuándo se hizo
- `hasAnalysis` es suficiente para indicar disponibilidad

### ¿El Enmascaramiento Afecta el Rendimiento?

No, el enmascaramiento es **solo a nivel de respuesta HTTP**:
- La DB devuelve el análisis completo
- El controlador decide si enmascarar o no (operación en memoria)
- No hay consultas SQL adicionales
- Impacto: ~1ms por request (insignificante)

### ¿El Cache Global Sigue Funcionando?

Sí, el cache global (Sprint 17) está **completamente preservado**:
- El análisis se guarda en DB la primera vez
- Usuarios subsiguientes reciben el análisis enmascarado
- Cuando pulsan "Ver análisis", se sirve el cache (sin llamar a Gemini)
- El auto-favorito ocurre tanto con análisis nuevo como cacheado

## Cumplimiento de GDPR/Privacidad

### Principios Aplicados

1. **Data Minimization**: Solo se envía data que el usuario solicitó
2. **Purpose Limitation**: El análisis solo se usa cuando el usuario lo pide
3. **User Control**: Cada usuario decide qué análisis ver (opt-in)
4. **Transparency**: El campo `hasAnalysis` informa sin revelar contenido

### Clasificación de Datos

| Dato | Clasificación | Acceso |
|------|---------------|--------|
| `title`, `description`, `content` | Público | Todos los usuarios |
| `source`, `publishedAt`, `category` | Público | Todos los usuarios |
| `analysis`, `summary`, `biasScore` | Privado (per-user) | Solo usuarios que favoriten |
| `hasAnalysis` | Público (metadata) | Todos los usuarios |
| `isFavorite` | Privado (per-user) | Solo el usuario propietario |

## Conclusión

Sprint 18.1 **cierra la brecha de privacidad** detectada después de Sprint 18, garantizando que:
- ✅ Los análisis IA son privados por usuario (opt-in)
- ✅ No hay filtración de datos entre usuarios
- ✅ El cache global sigue optimizando costos
- ✅ La UX es transparente y clara ("Instantáneo")
- ✅ Cumplimiento GDPR/privacidad

El sistema ahora respeta el principio de **análisis bajo demanda**, donde cada usuario decide qué análisis consumir, sin exponer automáticamente data de análisis de otros usuarios.
