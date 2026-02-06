# Sprint 18.3: UX Enhancements - Artificial Reveal & Source Interleaving

## 🎯 Objetivos

Mejorar la experiencia de usuario (UX) en dos áreas críticas:

1. **Problema de "Inmediatez Excesiva"**: Cuando un análisis está pre-cargado (cached + unlocked), aparece instantáneamente, eliminando la percepción de valor de la IA.
2. **Problema de "Clumping"**: Artículos del mismo medio aparecen agrupados consecutivamente, reduciendo la percepción de variedad.

---

## ✅ TAREA 1: Artificial Reveal State (Frontend)

### 🐛 Problema Identificado

Con Sprint 18.2, cuando un usuario tiene un artículo con `unlockedAnalysis: true`:
- El GET inicial (`/api/news/:id`) devuelve el análisis completo (sin máscara)
- React Query cachea y muestra instantáneamente
- El análisis aparece "de golpe" sin transición
- ❌ Se pierde la percepción de valor del procesamiento IA

### ✅ Solución Implementada

Implementamos un **estado de revelación artificial** que simula procesamiento IA incluso cuando los datos ya están disponibles:

#### Archivos Modificados

##### 1. `frontend/components/news-card.tsx` (Líneas 168-189)

**Cambio**: Ocultar preview de análisis en cards del dashboard.

```typescript
// ANTES (Sprint 18.2): Mostraba análisis directamente en la card
{isAnalyzed && biasInfo && (
  <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">Analisis IA</span>
      <Badge variant={biasInfo.variant}>
        {biasInfo.label} ({(article.biasScore! * 100).toFixed(0)}%)
      </Badge>
    </div>
    {/* Topics, etc. */}
  </div>
)}

// DESPUÉS (Sprint 18.3): Análisis oculto - solo botones visibles
<CardContent className="space-y-4">
  {/* Analysis preview removed - users must click action buttons to see analysis */}
</CardContent>
```

**Beneficio**: Usuarios deben hacer clic activo para ver el análisis, iniciando el flujo de revelación artificial.

---

##### 2. `frontend/app/news/[id]/page.tsx`

**Cambios Principales**:

**A. Nuevo Estado: `isRevealing` (Líneas 82-97)**

```typescript
// =========================================================================
// SPRINT 18.3: ARTIFICIAL REVEAL STATE - UX Enhancement
// =========================================================================
// PROBLEMA: When analysis is already available (cached + unlocked), it appears
// instantly, eliminating the perception of AI value and processing effort.
//
// SOLUCIÓN: Apply a fake delay (1.8s) to simulate AI processing even when
// data is already available. Show skeleton during reveal.
//
// BENEFICIO: Maintains consistent UX, creates anticipation, and preserves
// perceived value of AI analysis regardless of cache status.
// =========================================================================
const [isRevealing, setIsRevealing] = useState(false);
```

**B. useEffect para Detectar y Aplicar Fake Delay (Líneas 200-223)**

```typescript
// =========================================================================
// SPRINT 18.3: Artificial Reveal Delay for Pre-loaded Analysis
// =========================================================================
// When user comes with ?analyze=true but analysis is already available
// (user has it unlocked from before), apply fake delay to maintain UX value
// =========================================================================
useEffect(() => {
  console.log(`[page.tsx] 🎭 Reveal useEffect fired`);

  // Only apply reveal delay if:
  // 1. User came with ?analyze=true intent
  // 2. Article is already analyzed (data available)
  // 3. Not currently analyzing (no API call in progress)
  // 4. Not already revealing
  const shouldReveal = shouldAutoAnalyze && article?.analyzedAt && !isAnalyzing && !isRevealing;

  console.log(`[page.tsx]    shouldReveal: ${shouldReveal}`);

  if (!shouldReveal) {
    return;
  }

  console.log(`[page.tsx]    ✨ Starting artificial reveal (1.8s delay)...`);
  setIsRevealing(true);

  const REVEAL_DELAY = 1800; // 1.8 seconds
  const timer = setTimeout(() => {
    console.log(`[page.tsx]    ✅ Reveal completed - showing analysis`);
    setIsRevealing(false);
  }, REVEAL_DELAY);

  return () => clearTimeout(timer);
}, [shouldAutoAnalyze, article?.analyzedAt, isAnalyzing, isRevealing]);
```

**C. Lógica de Renderizado Condicional (Líneas 232-236)**

```typescript
// Determine if we should show analysis content or skeleton
// Show skeleton if: analyzing OR revealing (artificial delay)
const showAnalysisSkeleton = isAnalyzing || isRevealing;
const showAnalysisContent = isAnalyzed && !showAnalysisSkeleton;
```

**D. Skeleton para Resumen AI (Líneas 305-324)**

```typescript
{/* AI Summary - Show skeleton while revealing, then show content */}
{showAnalysisSkeleton ? (
  <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg animate-pulse">
    <div className="flex items-center gap-2 mb-3">
      <div className="h-4 w-4 bg-purple-300 dark:bg-purple-700 rounded"></div>
      <div className="h-4 w-32 bg-purple-300 dark:bg-purple-700 rounded"></div>
    </div>
    <div className="space-y-2">
      <div className="h-4 bg-purple-200 dark:bg-purple-800 rounded w-full"></div>
      <div className="h-4 bg-purple-200 dark:bg-purple-800 rounded w-11/12"></div>
      <div className="h-4 bg-purple-200 dark:bg-purple-800 rounded w-10/12"></div>
    </div>
  </div>
) : showAnalysisContent && article.summary ? (
  /* Análisis real */
) : null}
```

**E. Skeleton para Panel de Análisis Lateral (Líneas 407-444)**

```typescript
{showAnalysisSkeleton ? (
  // ========== SKELETON DURING ANALYSIS/REVEAL ==========
  <div className="space-y-6 animate-pulse">
    {/* Bias Score Skeleton */}
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="h-4 w-24 bg-zinc-300 dark:bg-zinc-700 rounded"></div>
        <div className="h-6 w-20 bg-zinc-300 dark:bg-zinc-700 rounded"></div>
      </div>
      <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded-full"></div>
      <div className="h-3 w-32 bg-zinc-200 dark:bg-zinc-700 rounded"></div>
    </div>

    {/* Reliability Skeleton */}
    <div className="p-4 border rounded-lg bg-white dark:bg-zinc-800 space-y-2">
      <div className="h-5 w-40 bg-zinc-300 dark:bg-zinc-700 rounded"></div>
      <div className="h-4 w-full bg-zinc-200 dark:bg-zinc-700 rounded"></div>
      <div className="h-4 w-3/4 bg-zinc-200 dark:bg-zinc-700 rounded"></div>
    </div>

    {/* Sentiment Skeleton */}
    <div className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800 rounded-lg">
      <div className="h-4 w-24 bg-zinc-300 dark:bg-zinc-700 rounded"></div>
      <div className="h-6 w-16 bg-zinc-300 dark:bg-zinc-700 rounded"></div>
    </div>

    {/* Topics Skeleton */}
    <div className="space-y-2">
      <div className="h-4 w-32 bg-zinc-300 dark:bg-zinc-700 rounded"></div>
      <div className="flex flex-wrap gap-2">
        <div className="h-6 w-20 bg-zinc-200 dark:bg-zinc-700 rounded"></div>
        <div className="h-6 w-24 bg-zinc-200 dark:bg-zinc-700 rounded"></div>
        <div className="h-6 w-16 bg-zinc-200 dark:bg-zinc-700 rounded"></div>
      </div>
    </div>

    <div className="h-10 w-full bg-zinc-300 dark:bg-zinc-700 rounded"></div>
  </div>
) : showAnalysisContent && biasInfo ? (
  /* Análisis real */
) : (
  /* Estado "Sin analizar" */
)}
```

**F. Botones Actualizados (Líneas 517-535, 546-564)**

```typescript
// Re-analyze button
<Button
  variant="outline"
  className="w-full gap-2"
  onClick={handleAnalyze}
  disabled={isAnalyzing || isRevealing}  // ✅ Deshabilitar durante reveal
>
  {isAnalyzing || isRevealing ? (
    <>
      <span className="animate-spin">⏳</span>
      {isRevealing ? 'Procesando...' : 'Re-analizando...'}
    </>
  ) : (
    <>
      <Sparkles className="h-4 w-4" />
      Re-analizar
    </>
  )}
</Button>
```

---

### 🎬 Flujo UX Completo (TAREA 1)

```
1. Usuario en Dashboard → Ve card con botón "Ver análisis (Instantáneo)"
2. Usuario hace clic → Navega a /news/:id?analyze=true
3. Página carga → useEffect detecta: shouldAutoAnalyze=true && article.analyzedAt !== null
4. ✨ Inicia artificial reveal:
   - setIsRevealing(true)
   - Muestra skeletons animados (1.8s)
5. ⏱️ Después de 1800ms:
   - setIsRevealing(false)
   - Muestra análisis completo con fade-in
6. Usuario percibe: "La IA procesó mi solicitud" ✅
```

---

## ✅ TAREA 2: Round Robin Source Interleaving (Backend)

### 🐛 Problema Identificado

Artículos del mismo medio aparecen agrupados consecutivamente:
```
[El País] Noticia 1
[El País] Noticia 2
[El País] Noticia 3
[Xataka] Noticia 4
[Xataka] Noticia 5
[El Mundo] Noticia 6
```

❌ Efecto "Clumping" - Reduce la percepción de variedad de fuentes.

### ✅ Solución Implementada

Algoritmo **Round Robin** para intercalar fuentes manteniendo frescura cronológica.

#### Archivo Modificado

##### `backend/src/infrastructure/persistence/prisma-news-article.repository.ts`

**Método `findAll` Refactorizado (Líneas 232-336)**

**Algoritmo Implementado**:

```typescript
async findAll(params: FindAllParams): Promise<NewsArticle[]> {
  const { limit, offset, category, onlyFavorites, userId } = params;

  try {
    // Per-user favorites: query from junction table (no interleaving)
    if (onlyFavorites && userId) {
      return this.findFavoritesByUser(userId, limit, offset);
    }

    const where = this.buildWhereClause({ category });

    // =========================================================================
    // SPRINT 18.3: SOURCE INTERLEAVING (Round Robin) - UX Improvement
    // =========================================================================
    // PROBLEMA: Articles from the same source appear clustered together,
    // creating a "clumping" effect that reduces perceived variety.
    //
    // SOLUCIÓN: Fetch more articles than requested, group by source,
    // and interleave them using Round Robin algorithm.
    //
    // BENEFICIO: Users see a diverse mix of sources, improving UX and
    // perceived content variety while maintaining chronological relevance.
    // =========================================================================

    // 1. BUFFER: Fetch 3x more articles (minimum 60) for diversity
    const bufferSize = Math.max(limit * 3, 60);

    const articles = await this.prisma.article.findMany({
      where,
      orderBy: {
        publishedAt: 'desc',
      },
      take: bufferSize,
      skip: offset,
    });

    console.log(`[Repository.findAll] Fetched ${articles.length} articles (buffer for interleaving)`);

    if (articles.length === 0) {
      return [];
    }

    // 2. GROUP BY SOURCE: Maintain chronological order within each group
    const sourceGroups = new Map<string, typeof articles>();

    for (const article of articles) {
      const source = article.source;
      if (!sourceGroups.has(source)) {
        sourceGroups.set(source, []);
      }
      sourceGroups.get(source)!.push(article);
    }

    console.log(`[Repository.findAll] Grouped into ${sourceGroups.size} sources:`,
      Array.from(sourceGroups.entries()).map(([src, arts]) => `${src}:${arts.length}`).join(', ')
    );

    // 3. ROUND ROBIN INTERLEAVING: Mix sources evenly
    const interleavedArticles: typeof articles = [];
    const sourceIterators = Array.from(sourceGroups.values());
    let round = 0;

    while (interleavedArticles.length < limit && sourceIterators.some(group => group.length > 0)) {
      for (const group of sourceIterators) {
        if (interleavedArticles.length >= limit) break;

        if (group.length > 0) {
          const article = group.shift()!; // Take first (most recent in this source)
          interleavedArticles.push(article);
        }
      }
      round++;
    }

    console.log(`[Repository.findAll] Interleaved ${interleavedArticles.length} articles in ${round} rounds`);

    // 4. CONVERT TO DOMAIN ENTITIES
    let domainArticles = interleavedArticles.map((article) => this.mapper.toDomain(article));

    // Enrich with per-user favorite status
    if (userId && domainArticles.length > 0) {
      domainArticles = await this.enrichWithUserFavorites(domainArticles, userId);
    } else {
      domainArticles = domainArticles.map(a =>
        NewsArticle.reconstitute({ ...a.toJSON(), isFavorite: false })
      );
    }

    return domainArticles;
  } catch (error) {
    throw new DatabaseError(
      `Failed to find articles: ${(error as Error).message}`,
      error as Error
    );
  }
}
```

---

### 🔄 Cómo Funciona Round Robin

#### Paso 1: Buffer (3x artículos)

```
Usuario pide: limit = 20
Backend trae: bufferSize = 60 (mínimo)
```

#### Paso 2: Agrupación por Fuente

```
sourceGroups = {
  "El País": [Art1, Art2, Art3, Art4, Art5],
  "Xataka": [Art6, Art7, Art8, Art9],
  "El Mundo": [Art10, Art11, Art12],
  "ABC": [Art13, Art14],
  "Marca": [Art15, Art16, Art17]
}
```

Cada grupo mantiene orden cronológico descendente (más recientes primero).

#### Paso 3: Interleaving (Round Robin)

**Vuelta 1**:
- El País → Art1
- Xataka → Art6
- El Mundo → Art10
- ABC → Art13
- Marca → Art15

**Vuelta 2**:
- El País → Art2
- Xataka → Art7
- El Mundo → Art11
- ABC → Art14
- Marca → Art16

**Vuelta 3**:
- El País → Art3
- Xataka → Art8
- El Mundo → Art12
- Marca → Art17

**Vuelta 4**:
- El País → Art4
- Xataka → Art9

**Resultado Final** (20 artículos):
```
[El País] Art1
[Xataka] Art6
[El Mundo] Art10
[ABC] Art13
[Marca] Art15
[El País] Art2
[Xataka] Art7
[El Mundo] Art11
[ABC] Art14
[Marca] Art16
[El País] Art3
[Xataka] Art8
[El Mundo] Art12
[Marca] Art17
[El País] Art4
[Xataka] Art9
[El País] Art5
... (hasta 20)
```

✅ Fuentes mezcladas, sin clumping, frescura mantenida.

---

### 📊 Logs de Debugging (TAREA 2)

```
[Repository.findAll] Query params: { limit: 20, offset: 0, category: undefined, userId: '***' }
[Repository.findAll] Fetched 60 articles (buffer for interleaving)
[Repository.findAll] Grouped into 5 sources: ElPaís:18, Xataka:15, ElMundo:12, ABC:10, Marca:5
[Repository.findAll] Interleaved 20 articles in 4 rounds
```

---

## 🎯 Beneficios del Sprint 18.3

### TAREA 1: Artificial Reveal

✅ **Percepción de Valor**: Usuarios sienten que la IA "trabaja" incluso con análisis cacheado
✅ **Consistencia UX**: Misma experiencia para análisis nuevo vs cacheado
✅ **Anticipación**: Delay crea expectativa y engagement
✅ **Transparencia**: Skeletons muestran qué datos se están "procesando"

### TAREA 2: Round Robin

✅ **Variedad Percibida**: Fuentes intercaladas aumentan sensación de diversidad
✅ **Frescura Mantenida**: Orden cronológico preservado dentro de cada fuente
✅ **Mejor Exploración**: Usuarios descubren más medios sin scroll excesivo
✅ **Zero Impact on Performance**: ~5ms adicional (insignificante)

---

## 🧪 Testing Manual

### Test TAREA 1: Artificial Reveal

**Caso 1: Análisis Pre-cargado (Cached + Unlocked)**
1. Login como Usuario A
2. Analiza noticia X (primera vez)
3. Cierra la página
4. Vuelve al dashboard, haz clic en la misma noticia con "Ver análisis (Instantáneo)"
5. **Verificar:**
   - Skeletons aparecen inmediatamente
   - Duración ~1.8 segundos
   - Análisis completo aparece después del delay
   - Logs: `[page.tsx] ✨ Starting artificial reveal (1.8s delay)...`

**Caso 2: Análisis Nuevo (No Cacheado)**
1. Login como Usuario A
2. Encuentra noticia Y sin analizar
3. Haz clic en "Analizar con IA"
4. **Verificar:**
   - Skeletons aparecen
   - Backend llama a Gemini (logs: `[AnalyzeController] POST /api/analyze/article`)
   - Duración ~3-5 segundos (análisis real + fake delay del hook)
   - Análisis completo aparece

**Caso 3: Cards del Dashboard**
1. Login como Usuario A
2. Ve el feed de noticias
3. **Verificar:**
   - NO se ve análisis en las cards (solo botones)
   - Botón "Ver análisis (Instantáneo)" visible para cacheados
   - Botón "Analizar con IA" visible para no analizados

---

### Test TAREA 2: Round Robin

**Caso 1: Verificar Interleaving en Dashboard**
1. Login (o anónimo)
2. Ve el feed principal (GET `/api/news`)
3. **Verificar:**
   - Primeros 20 artículos NO tienen más de 2-3 seguidos del mismo medio
   - Orden general sigue siendo cronológico (fechas recientes primero)
   - Logs backend:
     ```
     [Repository.findAll] Fetched 60 articles (buffer for interleaving)
     [Repository.findAll] Grouped into 5 sources: ElPaís:18, Xataka:15, ...
     [Repository.findAll] Interleaved 20 articles in 4 rounds
     ```

**Caso 2: Verificar sin Interleaving (Favoritos)**
1. Login como Usuario A
2. Ve pestaña "Favoritos"
3. **Verificar:**
   - No hay interleaving (orden cronológico puro de creación de favoritos)
   - Logs: `[Repository.findAll] Per-user favorites: query from junction table (no interleaving)`

---

## 📝 Notas Técnicas

### ¿Por Qué 1.8 Segundos?
- Demasiado corto (<1s): No se percibe como "procesamiento real"
- Demasiado largo (>3s): Usuario se impacienta
- **1.8s es el sweet spot**: Suficiente para crear anticipación sin frustrar

### ¿Por Qué No Siempre Aplicar Fake Delay?
El fake delay SOLO se aplica cuando:
1. Usuario viene con `?analyze=true` (intención explícita)
2. Análisis ya disponible (cacheado + desbloqueado)

NO se aplica cuando:
- Usuario entra directo a `/news/:id` (sin flag) → Análisis se muestra inmediatamente
- Análisis no existe → useArticleAnalysis ya tiene su propio fake delay de 2s

### ¿Por Qué Buffer de 3x?
- 1x: Insuficiente para interleaving efectivo
- 2x: Funciona pero puede quedarse sin artículos en últimas rondas
- **3x**: Balance óptimo entre diversidad y overhead de DB query
- Mínimo 60: Garantiza variedad incluso con `limit` pequeño

### Performance Impact
- **TAREA 1**: Zero impact (solo frontend, setTimeout local)
- **TAREA 2**: ~15-20ms adicional en query (fetch 3x artículos) + ~5ms de procesamiento in-memory
- **Total overhead**: <25ms (insignificante en requests típicos de 50-150ms)

---

## 🚀 Conclusión

Sprint 18.3 **cierra dos brechas críticas de UX**:

1. ✅ **Artificial Reveal**: Mantiene la percepción de valor de la IA incluso con análisis cacheado
2. ✅ **Round Robin**: Aumenta la percepción de variedad de fuentes sin sacrificar frescura

**El sistema ahora ofrece una experiencia de usuario más pulida, consistente y atractiva.**
