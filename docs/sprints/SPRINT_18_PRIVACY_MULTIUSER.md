# Sprint 18: Aislamiento Multi-Usuario y Privacidad de Datos

## Problema Critico Identificado

### Favoritos Globales (Violacion de Privacidad)
- El campo `Article.isFavorite` era un **booleano global** en la tabla `articles`
- Cuando un usuario marcaba un articulo como favorito, **TODOS los usuarios** lo veian como favorito
- El schema Prisma ya tenia una tabla `Favorite` (junction table `userId + articleId`) pero **no se estaba usando**
- El endpoint `PATCH /api/news/:id/favorite` no requeria autenticacion
- El frontend no enviaba token de autenticacion al gestionar favoritos

### Auto-Favorito Global en Analisis
- Cuando un usuario analizaba un articulo, se marcaba `isFavorite: true` en la tabla `Article` (global)
- Esto hacia que el articulo apareciera como favorito para **todos los usuarios**

### Flujo de Analisis Roto
- Al pulsar "Analizar con IA" en la tarjeta, se hacia `window.location.reload()` en vez de navegar a la pagina de analisis
- No se mostraba la pantalla de analisis ni se guardaba en favoritos del usuario

## Solucion Implementada

### Arquitectura Per-User Favorites

```
ANTES (Global - INSEGURO):
  Article.isFavorite = true  ->  Visible para TODOS los usuarios

AHORA (Per-User - SEGURO):
  Favorite(userId, articleId)  ->  Visible solo para ESE usuario
```

### Flujo Corregido

```
Usuario 1 pulsa "Analizar con IA" en tarjeta
  -> Navega a /news/[id]
  -> Pagina muestra boton "Analizar Veracidad"
  -> Click -> Llama API con token
  -> Backend analiza (o sirve cache global)
  -> Auto-favorito PER-USER en tabla Favorite
  -> Articulo aparece en SUS favoritos (no los de otros)
  -> Boton cambia a "Mostrar analisis" en el dashboard

Usuario 2 pulsa "Favoritos"
  -> Backend consulta tabla Favorite WHERE userId = user2
  -> Solo ve SUS favoritos, no los del usuario 1
```

## Archivos Modificados

### Backend (6 archivos)

#### 1. `backend/src/domain/repositories/news-article.repository.ts`
- Agregados 5 nuevos metodos per-user en la interfaz:
  - `toggleFavoriteForUser(userId, articleId): Promise<boolean>`
  - `addFavoriteForUser(userId, articleId): Promise<void>`
  - `getUserFavoriteArticleIds(userId, articleIds): Promise<Set<string>>`
  - `findFavoritesByUser(userId, limit, offset): Promise<NewsArticle[]>`
  - `countFavoritesByUser(userId): Promise<number>`
- `FindAllParams` ahora incluye `userId` opcional
- `countFiltered` acepta `userId`

#### 2. `backend/src/infrastructure/persistence/prisma-news-article.repository.ts`
- `findAll()`: Cuando `onlyFavorites=true` + `userId`, consulta la tabla `Favorite` junction
- `findAll()`: Cuando hay `userId`, enriquece articulos con `isFavorite` per-user via `enrichWithUserFavorites()`
- `findAll()`: Sin `userId`, todos los `isFavorite = false`
- Implementados los 5 metodos per-user usando `prisma.favorite` (upsert, delete, findMany)
- `buildWhereClause()` simplificado: ya no usa `isFavorite` global

#### 3. `backend/src/application/use-cases/toggle-favorite.usecase.ts`
- Input cambiado: `{ id }` -> `{ articleId, userId }`
- Usa `toggleFavoriteForUser(userId, articleId)` (junction table) en vez del global
- Valida que userId no este vacio

#### 4. `backend/src/infrastructure/http/controllers/news.controller.ts`
- `getNews`: Pasa `userId` de `req.user` al repositorio para enriquecimiento per-user
- `getNews`: Retorna 401 si piden favoritos sin autenticacion
- `getNewsById`: Enriquece con favorito per-user usando `getUserFavoriteArticleIds`
- `toggleFavorite`: Usa `req.user.uid` para toggle per-user

#### 5. `backend/src/infrastructure/http/routes/news.routes.ts`
- `PATCH /:id/favorite` ahora requiere `authenticate` middleware
- `GET /` y `GET /:id` usan `optionalAuthenticate` para enriquecer con favoritos per-user

#### 6. `backend/src/application/use-cases/analyze-article.usecase.ts`
- **Eliminado**: Auto-favorito global (`isFavorite: true` en Article)
- **Agregado**: Auto-favorito per-user via `addFavoriteForUser(user.id, article.id)`
- Funciona tanto para analisis nuevo como para analisis servido desde cache

### Frontend (5 archivos)

#### 1. `frontend/lib/api.ts`
- `toggleFavorite(articleId, token)` - ahora requiere token (era sin auth)
- `fetchFavorites(limit, offset, token)` - token opcional (requerido para resultados)
- `fetchNews(limit, offset, token)` - token opcional (para enriquecer favoritos)
- `fetchNewsByCategory(category, limit, offset, token)` - token opcional
- `fetchNewsById(id, token)` - token opcional

#### 2. `frontend/components/news-card.tsx`
- `handleAnalyze`: Navega a `/news/[id]` en vez de `window.location.reload()`
- `handleToggleFavorite`: Obtiene token y lo pasa a `toggleFavorite`
- Boton muestra "Mostrar analisis" si `isFavorite && isAnalyzed` (usuario ya lo vio)
- Boton muestra "Ver analisis" si `isAnalyzed` pero no es favorito del usuario
- Boton muestra "Analizar con IA" si no esta analizado
- Eliminada importacion de `analyzeArticle` (ya no se analiza desde la tarjeta)

#### 3. `frontend/hooks/useNews.ts`
- Usa `useAuth()` para obtener token del contexto de autenticacion
- Pasa token a `fetchFavorites`, `fetchNews`, `fetchNewsByCategory`
- Token cacheado en `useRef` para evitar re-fetches innecesarios

#### 4. `frontend/hooks/useArticle.ts`
- Usa `useAuth()` para obtener token
- Pasa token a `fetchNewsById` para enriquecer con favorito per-user
- Simplificado `useInvalidateArticle` usando import directo de `useQueryClient`

#### 5. `frontend/app/news/[id]/page.tsx`
- Despues de analizar, invalida cache de `['news']` ademas de `['article']`
- Esto actualiza los botones en el dashboard al volver

## Tabla de Privacidad

| Operacion | Antes | Ahora |
|-----------|-------|-------|
| Ver favoritos | Todos ven los mismos | Cada usuario ve solo los suyos |
| Toggle favorito | Sin auth, global | Requiere auth, per-user |
| Auto-favorito al analizar | Global (todos) | Per-user (solo quien analiza) |
| Fetch noticias | Sin info de favoritos | Enriquecido con favoritos per-user |
| Fetch articulo individual | Sin info de favoritos | Enriquecido con favorito per-user |

## Notas Tecnicas

### Tabla Favorite (Junction Table)
```prisma
model Favorite {
  userId      String
  articleId   String
  createdAt   DateTime  @default(now())
  user        User      @relation(...)
  article     Article   @relation(...)
  @@id([userId, articleId])  // Clave primaria compuesta
  @@map("favorites")
}
```

### Campo `Article.isFavorite` (Deprecado)
- El campo `isFavorite` en la tabla `articles` ya NO se usa para la logica de negocio
- El repositorio ahora siempre sobreescribe `isFavorite` basandose en la tabla `Favorite`
- Se mantiene en el schema por compatibilidad pero no afecta al comportamiento

### Middleware de Autenticacion
- `authenticate`: Obligatorio - retorna 401 si no hay token valido
- `optionalAuthenticate`: Opcional - si hay token, enriquece con datos de usuario; si no, continua sin usuario
- Las rutas GET usan `optionalAuthenticate` para que funcionen sin login pero enriquezcan si hay login
- La ruta PATCH de favoritos usa `authenticate` (obligatorio)

## Testing Manual

### Test 1: Favoritos aislados por usuario
1. Login como Usuario A
2. Marcar articulo X como favorito
3. Ir a "Favoritos" -> Debe aparecer articulo X
4. Login como Usuario B
5. Ir a "Favoritos" -> NO debe aparecer articulo X
6. Marcar articulo Y como favorito
7. Ir a "Favoritos" -> Solo aparece articulo Y

### Test 2: Flujo de analisis
1. Login como Usuario A
2. En dashboard, click "Analizar con IA" en un articulo
3. Debe navegar a `/news/[id]`
4. En la pagina, click "Analizar Veracidad"
5. Debe mostrar spinner y luego el analisis
6. Articulo automaticamente en favoritos del Usuario A
7. Volver al dashboard -> Boton cambia a "Mostrar analisis"

### Test 3: Cache global de analisis
1. Usuario A analiza articulo X (llamada a Gemini)
2. Usuario B navega a articulo X
3. Debe ver el analisis cacheado (sin llamar a Gemini)
4. Articulo X se agrega a favoritos del Usuario B

### Test 4: Boton contextual en tarjetas
- No analizado: "Analizar con IA" (azul, navega a detalle)
- Analizado pero no en mis favoritos: "Ver analisis" (outline)
- Analizado y en mis favoritos: "Mostrar analisis" (outline)

## Bug Fix: Análisis no se guardaba en BD

### Problema detectado
Después de implementar Sprint 18, se detectó que los análisis IA se ejecutaban correctamente (Gemini respondía) pero **no se persistían en la base de datos**. Los logs mostraban:

```
[AnalyzeController] ✅ Use case returned result: { biasScore: 0.8, summary: '...' }
[NewsController] ✅ Article found: { analyzedAt: 'NO', biasScore: null, summary: 'NO' }
```

### Causa raíz
En `article-mapper.ts`, el método `toUpsertData()` tenía una optimización del Sprint 16 que **preservaba el análisis existente** en el bloque `update` para evitar sobrescribir análisis previos cuando un artículo aparecía en múltiples categorías RSS.

Sin embargo, esto **impedía guardar el análisis cuando se ejecutaba por primera vez**, ya que:
- RSS ingestion crea el artículo sin análisis
- `analyze-article.usecase` llama `repository.save()` con el análisis
- Prisma ejecuta `upsert` que encuentra el artículo existente
- El bloque `update` **NO actualizaba los campos de análisis**

### Solución implementada
**Archivo**: `backend/src/infrastructure/persistence/article-mapper.ts:58-76`

Cambio en el bloque `update` del `toUpsertData()`:

```typescript
update: {
  // Metadata
  title: article.title,
  description: article.description,
  // ...

  // ✅ FIX: Actualizar análisis IA si el dominio entity lo tiene
  // Si viene de RSS ingestion → estos campos son null → no se actualiza
  // Si viene de analyze-article → estos campos tienen valores → se guarda
  ...(article.analyzedAt && {
    summary: article.summary,
    biasScore: article.biasScore,
    analysis: article.analysis,
    analyzedAt: article.analyzedAt,
    internalReasoning: article.internalReasoning,
  }),

  updatedAt: new Date(),
}
```

**Spread condicional**: Solo incluye campos de análisis en `update` si `article.analyzedAt` existe. Esto preserva la optimización del Sprint 16 (no sobrescribir análisis) mientras permite guardar nuevos análisis.

### Verificación
Después del fix, los logs deben mostrar:
```
[AnalyzeController] ✅ Use case returned result: { biasScore: 0.8, summary: '...' }
[NewsController] ✅ Article found: { analyzedAt: 'YES', biasScore: 0.8, summary: '...' }
```
